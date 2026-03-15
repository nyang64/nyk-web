import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import type { Route } from "./+types/lp-manager";
import { useWallet } from "../hooks/useWallet";
import type { EIP6963ProviderDetail } from "../hooks/useWallet";
import { WalletPickerModal } from "../components/WalletPickerModal";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "LP Position Creator | NYK Labs" },
    {
      name: "description",
      content:
        "Create concentrated liquidity positions on Uniswap V3 or Aerodrome Slipstream on the BASE network.",
    },
  ];
}

// ─── Contract addresses ───────────────────────────────────────────────────────

const CHAIN = {
  BASE_MAINNET: 8453,
  BASE_SEPOLIA: 84532,
};

const UNISWAP_ADDRESSES: Record<number, { factory: string; nfpm: string }> = {
  [CHAIN.BASE_MAINNET]: {
    factory: "0x33128a8fC17869897dcE68Ed026d694621f6FDfD",
    nfpm: "0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1",
  },
  [CHAIN.BASE_SEPOLIA]: {
    factory: "0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24",
    nfpm: "0x27F971cb582BF9E50F397e4d29a5C7A34f11faA2",
  },
};

const AERODROME_ADDRESSES = {
  clFactory: "0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A",
  nfpm: "0x827922686190790b37229fd06084350E74485b72",
};

interface TokenConfig {
  symbol: string;
  decimals: number;
}

const TOKENS: Record<number, Record<string, TokenConfig & { address: string }>> = {
  [CHAIN.BASE_MAINNET]: {
    HLRR: {
      address: "0x5E1583d48bcFd60de77138ea195f3EFbe128405d",
      symbol: "HLRR",
      decimals: 8,
    },
    USDC: {
      address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      symbol: "USDC",
      decimals: 6,
    },
    WETH: {
      address: "0x4200000000000000000000000000000000000006",
      symbol: "WETH",
      decimals: 18,
    },
  },
  [CHAIN.BASE_SEPOLIA]: {
    HLRR: {
      address: "0x75f9A6289B40BA7b32C4D56300a53B208dD8E7F4",
      symbol: "HLRR",
      decimals: 8,
    },
    USDC: {
      address: "0x90BD93418b87A9690F79B7449c1aECe018Fb4376",
      symbol: "USDC",
      decimals: 6,
    },
    WETH: {
      address: "0x4200000000000000000000000000000000000006",
      symbol: "WETH",
      decimals: 18,
    },
  },
};

// ─── Fee tier / tick spacing mappings ────────────────────────────────────────

const UNISWAP_FEE_OPTIONS: { label: string; fee: number; tickSpacing: number }[] = [
  { label: "0.01%", fee: 100, tickSpacing: 1 },
  { label: "0.05%", fee: 500, tickSpacing: 10 },
  { label: "0.3%", fee: 3000, tickSpacing: 60 },
  { label: "1%", fee: 10000, tickSpacing: 200 },
];

const AERODROME_SPACING_OPTIONS: { label: string; spacing: number }[] = [
  { label: "1", spacing: 1 },
  { label: "50", spacing: 50 },
  { label: "100", spacing: 100 },
  { label: "200", spacing: 200 },
];

// ─── ABIs ─────────────────────────────────────────────────────────────────────

const ERC20_ABI = [
  "function balanceOf(address account) external view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
  "function symbol() external view returns (string)",
];

const NFPM_UNISWAP_ABI = [
  "function multicall(bytes[] calldata data) external payable returns (bytes[] memory results)",
  "function createAndInitializePoolIfNecessary(address token0, address token1, uint24 fee, uint160 sqrtPriceX96) external payable returns (address pool)",
  "function mint((address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address recipient, uint256 deadline)) external payable returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)",
];

const NFPM_AERODROME_ABI = [
  "function mint((address token0, address token1, int24 tickSpacing, int24 tickLower, int24 tickUpper, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address recipient, uint256 deadline, uint160 sqrtPriceX96)) external payable returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)",
];

// ─── Math helpers ─────────────────────────────────────────────────────────────

function sqrtBigInt(n: bigint): bigint {
  if (n < 0n) throw new RangeError("Square root of negative bigint");
  if (n === 0n) return 0n;
  let x = n;
  let y = (x + 1n) / 2n;
  while (y < x) {
    x = y;
    y = (x + n / x) / 2n;
  }
  return x;
}

function priceToSqrtPriceX96(
  humanPrice: number,
  token0Dec: number,
  token1Dec: number
): bigint {
  // pool_price = humanPrice * 10^token1Dec / 10^token0Dec
  // sqrtPriceX96 = sqrt(pool_price) * 2^96
  // We scale up to avoid floating point loss: use 1e18 precision internally
  const PRECISION = 10n ** 18n;
  const Q96 = 2n ** 96n;

  const decAdj = token1Dec - token0Dec;
  // pool_price * PRECISION = humanPrice * 10^decAdj * PRECISION
  // Represent as rational: numerator / denominator
  let num: bigint;
  let den: bigint;
  // Work with humanPrice as integer * 1e18
  const priceScaled = BigInt(Math.round(humanPrice * 1e18));
  if (decAdj >= 0) {
    num = priceScaled * 10n ** BigInt(decAdj) * PRECISION;
    den = 10n ** 18n;
  } else {
    num = priceScaled * PRECISION;
    den = 10n ** 18n * 10n ** BigInt(-decAdj);
  }
  // sqrtPriceX96 = sqrt(num / den) * Q96 = sqrt(num * Q96^2 / den)
  const insideSqrt = (num * Q96 * Q96) / den;
  return sqrtBigInt(insideSqrt);
}

function priceToTick(humanPrice: number, token0Dec: number, token1Dec: number): number {
  // pool_price = humanPrice * 10^(token1Dec - token0Dec)
  const poolPrice = humanPrice * Math.pow(10, token1Dec - token0Dec);
  if (poolPrice <= 0) return 0;
  return Math.floor(Math.log(poolPrice) / Math.log(1.0001));
}

function snapTick(tick: number, spacing: number, isLower: boolean): number {
  const rounded = Math.round(tick / spacing) * spacing;
  if (isLower) {
    return tick < rounded ? rounded - spacing : rounded;
  } else {
    return tick > rounded ? rounded + spacing : rounded;
  }
}

// ─── Token key type ───────────────────────────────────────────────────────────

type TokenKey = "HLRR" | "USDC" | "WETH";
type Protocol = "uniswap" | "aerodrome";

type TxStatus =
  | { type: "idle" }
  | { type: "connecting" }
  | { type: "approving_token0" }
  | { type: "approving_token1" }
  | { type: "creating_pool" }
  | { type: "minting" }
  | { type: "success"; txHash: string; tokenId: string }
  | { type: "error"; message: string };

// ─── Component ────────────────────────────────────────────────────────────────

export default function LpManager() {
  // Wallet
  const {
    connectedAddress,
    chainId,
    discoveredWallets,
    showWalletPicker,
    setShowWalletPicker,
    getEthereum,
    connectWithProvider: walletConnectWithProvider,
    connectWallet: walletConnect,
  } = useWallet();

  // Protocol / form state
  const [protocol, setProtocol] = useState<Protocol>("uniswap");
  const [token0Key, setToken0Key] = useState<TokenKey>("HLRR");
  const [token1Key, setToken1Key] = useState<TokenKey>("USDC");
  const [selectedFee, setSelectedFee] = useState(10000);
  const [selectedSpacing, setSelectedSpacing] = useState(200);
  const [startingPrice, setStartingPrice] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [amount0, setAmount0] = useState("");
  const [amount1, setAmount1] = useState("");

  // Balances
  const [balances, setBalances] = useState<Partial<Record<TokenKey, string>>>({});

  // Status
  const [txStatus, setTxStatus] = useState<TxStatus>({ type: "idle" });

  // ─── Derived values ──────────────────────────────────────────────────────────

  const networkName =
    chainId === CHAIN.BASE_MAINNET
      ? "Base Mainnet"
      : chainId === CHAIN.BASE_SEPOLIA
      ? "Base Sepolia"
      : chainId !== null
      ? "Unsupported Network"
      : null;

  const isSupported = chainId === CHAIN.BASE_MAINNET || chainId === CHAIN.BASE_SEPOLIA;
  const isAeroOnTestnet = protocol === "aerodrome" && chainId === CHAIN.BASE_SEPOLIA;

  const tokens = chainId ? TOKENS[chainId] ?? TOKENS[CHAIN.BASE_MAINNET] : TOKENS[CHAIN.BASE_MAINNET];
  const TOKEN_KEYS: TokenKey[] = ["HLRR", "USDC", "WETH"];

  const t0 = tokens[token0Key];
  const t1 = tokens[token1Key];
  const sameToken = token0Key === token1Key;

  const tickSpacing =
    protocol === "aerodrome"
      ? selectedSpacing
      : UNISWAP_FEE_OPTIONS.find((o) => o.fee === selectedFee)?.tickSpacing ?? 200;

  // Computed sqrtPriceX96 preview
  const sqrtPricePreview = (() => {
    const p = parseFloat(startingPrice);
    if (!p || p <= 0) return "";
    try {
      return priceToSqrtPriceX96(p, t0.decimals, t1.decimals).toString();
    } catch {
      return "";
    }
  })();

  const minTickPreview = (() => {
    const p = parseFloat(minPrice);
    if (!p || p <= 0) return "";
    const raw = priceToTick(p, t0.decimals, t1.decimals);
    return snapTick(raw, tickSpacing, true).toString();
  })();

  const maxTickPreview = (() => {
    const p = parseFloat(maxPrice);
    if (!p || p <= 0) return "";
    const raw = priceToTick(p, t0.decimals, t1.decimals);
    return snapTick(raw, tickSpacing, false).toString();
  })();

  const basescanBase =
    chainId === CHAIN.BASE_MAINNET
      ? "https://basescan.org"
      : "https://sepolia.basescan.org";

  // ─── Wallet setup ────────────────────────────────────────────────────────────

  // Clear balances when wallet disconnects
  useEffect(() => {
    if (!connectedAddress) setBalances({});
  }, [connectedAddress]);

  const connectWithProvider = async (detail: EIP6963ProviderDetail) => {
    setTxStatus({ type: "connecting" });
    try {
      await walletConnectWithProvider(detail);
      setTxStatus({ type: "idle" });
    } catch (err: unknown) {
      const e = err as { code?: number };
      setTxStatus({
        type: "error",
        message: e.code === 4001 ? "Connection rejected." : "Failed to connect wallet.",
      });
    }
  };

  const connectWallet = async () => {
    setTxStatus({ type: "connecting" });
    try {
      await walletConnect();
      setTxStatus({ type: "idle" });
    } catch (err: unknown) {
      const e = err as { code?: number; message?: string };
      setTxStatus({
        type: "error",
        message: e.code === 4001 ? "Connection rejected." : (e.message || "Failed to connect wallet."),
      });
    }
  };

  // ─── Balance fetching ────────────────────────────────────────────────────────

  const fetchBalances = useCallback(async () => {
    const ethereum = getEthereum();
    if (!ethereum || !connectedAddress || !chainId) return;
    const tokenMap = TOKENS[chainId];
    if (!tokenMap) return;
    try {
      const provider = new ethers.BrowserProvider(ethereum);
      const results: Partial<Record<TokenKey, string>> = {};
      await Promise.all(
        TOKEN_KEYS.map(async (key) => {
          try {
            const t = tokenMap[key];
            const contract = new ethers.Contract(t.address, ERC20_ABI, provider);
            const bal: bigint = await contract.balanceOf(connectedAddress);
            results[key] = ethers.formatUnits(bal, t.decimals);
          } catch {
            results[key] = "—";
          }
        })
      );
      setBalances(results);
    } catch {
      // silent
    }
  }, [connectedAddress, chainId, getEthereum]);

  useEffect(() => {
    if (connectedAddress && chainId) {
      fetchBalances();
    }
  }, [connectedAddress, chainId, fetchBalances]);

  // ─── Create LP ───────────────────────────────────────────────────────────────

  const handleCreateLP = async () => {
    const ethereum = getEthereum();
    if (!ethereum || !connectedAddress || !chainId) return;

    if (!startingPrice || !minPrice || !maxPrice || !amount0 || !amount1) {
      setTxStatus({ type: "error", message: "Please fill in all fields." });
      return;
    }
    if (sameToken) {
      setTxStatus({ type: "error", message: "Token0 and Token1 must be different." });
      return;
    }
    if (!isSupported) {
      setTxStatus({ type: "error", message: "Unsupported network. Connect to Base Mainnet or Base Sepolia." });
      return;
    }
    if (isAeroOnTestnet) {
      setTxStatus({ type: "error", message: "Aerodrome Slipstream is only available on Base Mainnet." });
      return;
    }

    try {
      const provider = new ethers.BrowserProvider(ethereum);
      const signer = await provider.getSigner();

      // Sort tokens by address (token0 < token1)
      const raw0 = { key: token0Key, ...t0 };
      const raw1 = { key: token1Key, ...t1 };

      const sorted0 = raw0.address.toLowerCase() < raw1.address.toLowerCase() ? raw0 : raw1;
      const sorted1 = raw0.address.toLowerCase() < raw1.address.toLowerCase() ? raw1 : raw0;
      const wasSwapped = sorted0.key !== token0Key;

      // Recalculate prices/ticks using sorted order
      const humanPrice = parseFloat(startingPrice);
      const humanMin = parseFloat(minPrice);
      const humanMax = parseFloat(maxPrice);

      const sqrtPrice = priceToSqrtPriceX96(
        wasSwapped ? 1 / humanPrice : humanPrice,
        sorted0.decimals,
        sorted1.decimals
      );

      const rawTickLower = priceToTick(
        wasSwapped ? 1 / humanMax : humanMin,
        sorted0.decimals,
        sorted1.decimals
      );
      const rawTickUpper = priceToTick(
        wasSwapped ? 1 / humanMin : humanMax,
        sorted0.decimals,
        sorted1.decimals
      );

      const tickLower = snapTick(rawTickLower, tickSpacing, true);
      const tickUpper = snapTick(rawTickUpper, tickSpacing, false);

      if (tickLower >= tickUpper) {
        setTxStatus({ type: "error", message: "Min price must be less than Max price." });
        return;
      }

      const amt0Raw = ethers.parseUnits(
        wasSwapped ? amount1 : amount0,
        sorted0.decimals
      );
      const amt1Raw = ethers.parseUnits(
        wasSwapped ? amount0 : amount1,
        sorted1.decimals
      );

      const nfpmAddress =
        protocol === "uniswap"
          ? UNISWAP_ADDRESSES[chainId].nfpm
          : AERODROME_ADDRESSES.nfpm;

      // Step 1: Approve token0
      setTxStatus({ type: "approving_token0" });
      const erc0 = new ethers.Contract(sorted0.address, ERC20_ABI, signer);
      const allowance0: bigint = await erc0.allowance(connectedAddress, nfpmAddress);
      if (allowance0 < amt0Raw) {
        const tx = await erc0.approve(nfpmAddress, amt0Raw);
        await tx.wait();
      }

      // Step 2: Approve token1
      setTxStatus({ type: "approving_token1" });
      const erc1 = new ethers.Contract(sorted1.address, ERC20_ABI, signer);
      const allowance1: bigint = await erc1.allowance(connectedAddress, nfpmAddress);
      if (allowance1 < amt1Raw) {
        const tx = await erc1.approve(nfpmAddress, amt1Raw);
        await tx.wait();
      }

      const deadline = Math.floor(Date.now() / 1000) + 1200; // 20 min

      let receipt: ethers.TransactionReceipt | null = null;

      if (protocol === "uniswap") {
        setTxStatus({ type: "creating_pool" });
        const nfpm = new ethers.Contract(nfpmAddress, NFPM_UNISWAP_ABI, signer);

        const iface = new ethers.Interface(NFPM_UNISWAP_ABI);

        const initCalldata = iface.encodeFunctionData("createAndInitializePoolIfNecessary", [
          sorted0.address,
          sorted1.address,
          selectedFee,
          sqrtPrice,
        ]);

        const mintCalldata = iface.encodeFunctionData("mint", [
          {
            token0: sorted0.address,
            token1: sorted1.address,
            fee: selectedFee,
            tickLower,
            tickUpper,
            amount0Desired: amt0Raw,
            amount1Desired: amt1Raw,
            amount0Min: 0n,
            amount1Min: 0n,
            recipient: connectedAddress,
            deadline,
          },
        ]);

        setTxStatus({ type: "minting" });
        const tx = await nfpm.multicall([initCalldata, mintCalldata]);
        receipt = await tx.wait();
      } else {
        // Aerodrome Slipstream
        setTxStatus({ type: "minting" });
        const nfpm = new ethers.Contract(nfpmAddress, NFPM_AERODROME_ABI, signer);
        const tx = await nfpm.mint({
          token0: sorted0.address,
          token1: sorted1.address,
          tickSpacing,
          tickLower,
          tickUpper,
          amount0Desired: amt0Raw,
          amount1Desired: amt1Raw,
          amount0Min: 0n,
          amount1Min: 0n,
          recipient: connectedAddress,
          deadline,
          sqrtPriceX96: sqrtPrice,
        });
        receipt = await tx.wait();
      }

      if (!receipt) throw new Error("Transaction failed: no receipt");
      if (receipt.status === 0) throw new Error("Transaction reverted on-chain");

      // Parse tokenId from Transfer event (from address(0) = mint)
      let tokenId = "unknown";
      for (const log of receipt.logs) {
        // Transfer(address,address,uint256): topic[0] = keccak256, topic[1] = from, topic[2] = to, topic[3] = tokenId
        if (
          log.topics.length === 4 &&
          log.topics[1] === "0x0000000000000000000000000000000000000000000000000000000000000000"
        ) {
          tokenId = BigInt(log.topics[3]).toString();
          break;
        }
      }

      setTxStatus({ type: "success", txHash: receipt.hash, tokenId });
      setAmount0("");
      setAmount1("");
      fetchBalances();
    } catch (err: unknown) {
      const e = err as { code?: number | string; reason?: string; message?: string };
      if (e.code === 4001 || e.code === "ACTION_REJECTED") {
        setTxStatus({ type: "error", message: "Transaction rejected by user." });
      } else {
        setTxStatus({
          type: "error",
          message: e.reason ?? e.message ?? "Transaction failed.",
        });
      }
    }
  };

  // ─── Validation ──────────────────────────────────────────────────────────────

  const formValid =
    !!connectedAddress &&
    isSupported &&
    !isAeroOnTestnet &&
    !sameToken &&
    !!startingPrice &&
    parseFloat(startingPrice) > 0 &&
    !!minPrice &&
    parseFloat(minPrice) > 0 &&
    !!maxPrice &&
    parseFloat(maxPrice) > 0 &&
    parseFloat(minPrice) < parseFloat(maxPrice) &&
    !!amount0 &&
    parseFloat(amount0) > 0 &&
    !!amount1 &&
    parseFloat(amount1) > 0;

  const isSubmitting =
    txStatus.type === "approving_token0" ||
    txStatus.type === "approving_token1" ||
    txStatus.type === "creating_pool" ||
    txStatus.type === "minting" ||
    txStatus.type === "connecting";

  // ─── Status label ─────────────────────────────────────────────────────────────

  const statusLabel = () => {
    switch (txStatus.type) {
      case "connecting":
        return "Connecting wallet...";
      case "approving_token0":
        return `Approving ${token0Key}...`;
      case "approving_token1":
        return `Approving ${token1Key}...`;
      case "creating_pool":
        return "Creating pool (if needed)...";
      case "minting":
        return "Minting LP position...";
      default:
        return "";
    }
  };

  // ─── Styles (inline, matching dark theme) ────────────────────────────────────

  const S = {
    page: {
      maxWidth: 680,
      margin: "0 auto",
      width: "100%",
    } as React.CSSProperties,
    card: {
      background: "var(--card)",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: 12,
      padding: "1.75rem",
      marginBottom: "1.25rem",
    } as React.CSSProperties,
    label: {
      fontSize: "0.8rem",
      color: "#9ca3af",
      marginBottom: "0.4rem",
      display: "block",
    } as React.CSSProperties,
    input: {
      width: "100%",
      padding: "0.65rem 0.75rem",
      background: "rgba(255,255,255,0.05)",
      border: "1px solid #374151",
      borderRadius: 8,
      color: "var(--text)",
      fontSize: "0.95rem",
      outline: "none",
    } as React.CSSProperties,
    select: {
      width: "100%",
      padding: "0.65rem 0.75rem",
      background: "#1a2235",
      border: "1px solid #374151",
      borderRadius: 8,
      color: "var(--text)",
      fontSize: "0.95rem",
      outline: "none",
    } as React.CSSProperties,
    hint: {
      fontSize: "0.75rem",
      color: "#6b7280",
      fontFamily: "monospace",
      marginTop: "0.3rem",
      wordBreak: "break-all" as const,
    } as React.CSSProperties,
    btn: {
      width: "100%",
      padding: "0.875rem 1.5rem",
      background: "var(--accent)",
      color: "#0f172a",
      border: "none",
      borderRadius: 8,
      fontWeight: 700,
      fontSize: "1rem",
      cursor: "pointer",
      opacity: 1,
      transition: "opacity 0.2s",
    } as React.CSSProperties,
    btnDisabled: {
      opacity: 0.4,
      cursor: "not-allowed",
    } as React.CSSProperties,
    row: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: "1rem",
    } as React.CSSProperties,
    protocolTab: (active: boolean): React.CSSProperties => ({
      padding: "0.5rem 1.25rem",
      borderRadius: 20,
      border: "1px solid",
      borderColor: active ? "var(--accent)" : "rgba(255,255,255,0.15)",
      background: active ? "var(--accent)" : "transparent",
      color: active ? "#0f172a" : "var(--text)",
      fontWeight: active ? 700 : 500,
      cursor: "pointer",
      fontSize: "0.9rem",
      transition: "all 0.2s",
    }),
    radioRow: {
      display: "flex",
      flexWrap: "wrap" as const,
      gap: "0.5rem",
      marginTop: "0.5rem",
    } as React.CSSProperties,
    radioBtn: (active: boolean): React.CSSProperties => ({
      padding: "0.35rem 0.85rem",
      borderRadius: 6,
      border: "1px solid",
      borderColor: active ? "var(--accent)" : "rgba(255,255,255,0.15)",
      background: active ? "rgba(34,211,238,0.12)" : "transparent",
      color: active ? "var(--accent)" : "#9ca3af",
      cursor: "pointer",
      fontSize: "0.85rem",
      fontWeight: active ? 600 : 400,
      transition: "all 0.15s",
    }),
    badge: (color: string): React.CSSProperties => ({
      display: "inline-block",
      padding: "0.25rem 0.65rem",
      borderRadius: 20,
      background: `${color}22`,
      border: `1px solid ${color}`,
      color: color,
      fontSize: "0.75rem",
      fontWeight: 600,
      letterSpacing: "0.03em",
    }),
    sectionTitle: {
      fontSize: "0.95rem",
      fontWeight: 600,
      color: "var(--text)",
      marginBottom: "0.75rem",
    } as React.CSSProperties,
  };

  return (
    <main style={{ padding: "3rem 1.5rem" }}>
      <div style={S.page}>
        {/* Header */}
        <div style={{ marginBottom: "2rem" }}>
          <h1 style={{ fontSize: "1.8rem", color: "var(--accent)", fontWeight: 700 }}>
            LP Position Creator
          </h1>
          <p style={{ color: "#9ca3af", marginTop: "0.4rem" }}>
            Create concentrated liquidity positions on Uniswap V3 or Aerodrome Slipstream
          </p>
        </div>

        {/* Wallet picker modal */}
        {showWalletPicker && (
          <WalletPickerModal
            wallets={discoveredWallets}
            onSelect={connectWithProvider}
            onClose={() => setShowWalletPicker(false)}
          />
        )}

        {/* Wallet + Network bar */}
        <div style={{ ...S.card, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
            {connectedAddress ? (
              <>
                <span
                  style={S.badge(
                    chainId === CHAIN.BASE_MAINNET
                      ? "#22d3ee"
                      : chainId === CHAIN.BASE_SEPOLIA
                      ? "#a78bfa"
                      : "#ef4444"
                  )}
                >
                  {networkName ?? "Unknown"}
                </span>
                <span style={{ fontSize: "0.85rem", color: "#9ca3af" }}>
                  {connectedAddress.slice(0, 6)}...{connectedAddress.slice(-4)}
                </span>
              </>
            ) : (
              <span style={{ fontSize: "0.85rem", color: "#9ca3af" }}>No wallet connected</span>
            )}
          </div>
          {!connectedAddress && (
            <button
              onClick={connectWallet}
              disabled={isSubmitting}
              style={{ ...S.btn, width: "auto", padding: "0.5rem 1.25rem", fontSize: "0.9rem" }}
            >
              Connect Wallet
            </button>
          )}
        </div>

        {/* Unsupported network warning */}
        {connectedAddress && !isSupported && (
          <div className="error-message" style={{ marginBottom: "1.25rem" }}>
            Unsupported network. Please switch to Base Mainnet (8453) or Base Sepolia (84532).
          </div>
        )}

        {/* Aerodrome + Testnet warning */}
        {isAeroOnTestnet && (
          <div
            style={{
              background: "rgba(251,191,36,0.08)",
              border: "1px solid rgba(251,191,36,0.4)",
              borderRadius: 10,
              padding: "0.9rem 1rem",
              marginBottom: "1.25rem",
              color: "#fbbf24",
              fontSize: "0.9rem",
            }}
          >
            <strong>Aerodrome Slipstream is not available on Base Sepolia.</strong> Switch to Base
            Mainnet or select Uniswap V3 to continue.
          </div>
        )}

        {/* Protocol selector */}
        <div style={S.card}>
          <p style={S.sectionTitle}>Protocol</p>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button style={S.protocolTab(protocol === "uniswap")} onClick={() => setProtocol("uniswap")}>
              Uniswap V3
            </button>
            <button style={S.protocolTab(protocol === "aerodrome")} onClick={() => setProtocol("aerodrome")}>
              Aerodrome Slipstream
            </button>
          </div>
        </div>

        {/* Token pair */}
        <div style={S.card}>
          <p style={S.sectionTitle}>Token Pair</p>
          <div style={S.row}>
            {/* Token0 */}
            <div>
              <label style={S.label}>Token 0</label>
              <select
                style={S.select}
                value={token0Key}
                onChange={(e) => setToken0Key(e.target.value as TokenKey)}
              >
                {TOKEN_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
              {balances[token0Key] !== undefined && (
                <p style={{ ...S.hint, marginTop: "0.4rem" }}>
                  Balance: {parseFloat(balances[token0Key] ?? "0").toFixed(4)} {token0Key}
                </p>
              )}
            </div>
            {/* Token1 */}
            <div>
              <label style={S.label}>Token 1</label>
              <select
                style={S.select}
                value={token1Key}
                onChange={(e) => setToken1Key(e.target.value as TokenKey)}
              >
                {TOKEN_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
              {balances[token1Key] !== undefined && (
                <p style={{ ...S.hint, marginTop: "0.4rem" }}>
                  Balance: {parseFloat(balances[token1Key] ?? "0").toFixed(4)} {token1Key}
                </p>
              )}
            </div>
          </div>
          {sameToken && (
            <p style={{ color: "#ef4444", fontSize: "0.8rem", marginTop: "0.5rem" }}>
              Token0 and Token1 must be different.
            </p>
          )}
        </div>

        {/* Fee tier / tick spacing */}
        <div style={S.card}>
          {protocol === "uniswap" ? (
            <>
              <p style={S.sectionTitle}>Fee Tier</p>
              <div style={S.radioRow}>
                {UNISWAP_FEE_OPTIONS.map((opt) => (
                  <button
                    key={opt.fee}
                    style={S.radioBtn(selectedFee === opt.fee)}
                    onClick={() => setSelectedFee(opt.fee)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p style={{ ...S.hint, marginTop: "0.5rem" }}>
                Tick spacing: {UNISWAP_FEE_OPTIONS.find((o) => o.fee === selectedFee)?.tickSpacing}
              </p>
            </>
          ) : (
            <>
              <p style={S.sectionTitle}>Tick Spacing</p>
              <div style={S.radioRow}>
                {AERODROME_SPACING_OPTIONS.map((opt) => (
                  <button
                    key={opt.spacing}
                    style={S.radioBtn(selectedSpacing === opt.spacing)}
                    onClick={() => setSelectedSpacing(opt.spacing)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Starting price */}
        <div style={S.card}>
          <p style={S.sectionTitle}>Starting Price</p>
          <label style={S.label}>
            {token1Key} per {token0Key}
          </label>
          <input
            type="number"
            min="0"
            step="any"
            style={S.input}
            placeholder="e.g. 0.075"
            value={startingPrice}
            onChange={(e) => setStartingPrice(e.target.value)}
          />
          {sqrtPricePreview && (
            <p style={S.hint}>sqrtPriceX96: {sqrtPricePreview}</p>
          )}
        </div>

        {/* Price range */}
        <div style={S.card}>
          <p style={S.sectionTitle}>Price Range</p>
          <div style={S.row}>
            <div>
              <label style={S.label}>
                Min Price ({token1Key}/{token0Key})
              </label>
              <input
                type="number"
                min="0"
                step="any"
                style={S.input}
                placeholder="e.g. 0.01"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
              />
              {minTickPreview && <p style={S.hint}>tickLower: {minTickPreview}</p>}
            </div>
            <div>
              <label style={S.label}>
                Max Price ({token1Key}/{token0Key})
              </label>
              <input
                type="number"
                min="0"
                step="any"
                style={S.input}
                placeholder="e.g. 10.0"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
              />
              {maxTickPreview && <p style={S.hint}>tickUpper: {maxTickPreview}</p>}
            </div>
          </div>
          {minPrice && maxPrice && parseFloat(minPrice) >= parseFloat(maxPrice) && (
            <p style={{ color: "#ef4444", fontSize: "0.8rem", marginTop: "0.5rem" }}>
              Min price must be less than max price.
            </p>
          )}
        </div>

        {/* Amounts */}
        <div style={S.card}>
          <p style={S.sectionTitle}>Deposit Amounts</p>
          <div style={S.row}>
            <div>
              <label style={S.label}>{token0Key} amount</label>
              <input
                type="number"
                min="0"
                step="any"
                style={S.input}
                placeholder="0.0"
                value={amount0}
                onChange={(e) => setAmount0(e.target.value)}
              />
              {balances[token0Key] !== undefined && (
                <p style={S.hint}>
                  Wallet: {parseFloat(balances[token0Key] ?? "0").toFixed(4)} {token0Key}
                </p>
              )}
            </div>
            <div>
              <label style={S.label}>{token1Key} amount</label>
              <input
                type="number"
                min="0"
                step="any"
                style={S.input}
                placeholder="0.0"
                value={amount1}
                onChange={(e) => setAmount1(e.target.value)}
              />
              {balances[token1Key] !== undefined && (
                <p style={S.hint}>
                  Wallet: {parseFloat(balances[token1Key] ?? "0").toFixed(4)} {token1Key}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Create button */}
        <button
          onClick={handleCreateLP}
          disabled={!formValid || isSubmitting}
          style={{
            ...S.btn,
            ...(!formValid || isSubmitting ? S.btnDisabled : {}),
          }}
        >
          {isSubmitting ? statusLabel() : "Create LP Position"}
        </button>

        {/* Status */}
        {isSubmitting && (
          <div
            style={{
              marginTop: "1rem",
              padding: "0.75rem",
              background: "rgba(34,211,238,0.07)",
              border: "1px solid rgba(34,211,238,0.25)",
              borderRadius: 8,
              color: "var(--accent)",
              fontSize: "0.9rem",
            }}
          >
            {statusLabel()}
          </div>
        )}

        {txStatus.type === "success" && (
          <div className="success-message" style={{ marginTop: "1rem" }}>
            <strong>Position created!</strong> NFT ID: {txStatus.tokenId}
            <br />
            <a
              href={`${basescanBase}/tx/${txStatus.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--accent)", textDecoration: "underline", fontSize: "0.85rem" }}
            >
              View on BaseScan →
            </a>
          </div>
        )}

        {txStatus.type === "error" && (
          <div className="error-message" style={{ marginTop: "1rem" }}>
            {txStatus.message}
          </div>
        )}
      </div>
    </main>
  );
}
