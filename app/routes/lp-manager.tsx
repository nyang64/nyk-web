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

interface WalletToken {
  address: string;
  symbol: string;
  decimals: number;
  balance: string; // human-readable, e.g. "1234.56"
}

// Seed list per chain — only tokens with a non-zero balance will appear in the picker
const KNOWN_TOKENS: Partial<Record<number, Omit<WalletToken, "balance">[]>> = {
  [CHAIN.BASE_MAINNET]: [
    { address: "0x5E1583d48bcFd60de77138ea195f3EFbe128405d", symbol: "HLRR", decimals: 8 },
    { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", symbol: "USDC", decimals: 6 },
    { address: "0x4200000000000000000000000000000000000006", symbol: "WETH", decimals: 18 },
  ],
  [CHAIN.BASE_SEPOLIA]: [
    { address: "0x75f9A6289B40BA7b32C4D56300a53B208dD8E7F4", symbol: "HLRR", decimals: 8 },
    { address: "0x90BD93418b87A9690F79B7449c1aECe018Fb4376", symbol: "USDC", decimals: 6 },
    { address: "0x4200000000000000000000000000000000000006", symbol: "WETH", decimals: 18 },
  ],
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

const UNISWAP_FACTORY_ABI = [
  "function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)",
];

const UNISWAP_POOL_ABI = [
  "function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16, uint16, uint16, uint8, bool)",
];

const NFPM_AERODROME_ABI = [
  "function mint((address token0, address token1, int24 tickSpacing, int24 tickLower, int24 tickUpper, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address recipient, uint256 deadline, uint160 sqrtPriceX96)) external payable returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)",
];

const NFPM_APPROVE_ABI = [
  "function approve(address to, uint256 tokenId) external",
  "function ownerOf(uint256 tokenId) external view returns (address)",
];

// Used for closing a position: read liquidity, remove it, collect, burn
const NFPM_CLOSE_ABI = [
  "function positions(uint256 tokenId) external view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)",
  "function multicall(bytes[] calldata data) external payable returns (bytes[] memory results)",
  "function decreaseLiquidity((uint256 tokenId, uint128 liquidity, uint256 amount0Min, uint256 amount1Min, uint256 deadline) params) external payable returns (uint256 amount0, uint256 amount1)",
  "function collect((uint256 tokenId, address recipient, uint128 amount0Max, uint128 amount1Max) params) external payable returns (uint256 amount0, uint256 amount1)",
  "function burn(uint256 tokenId) external payable",
];

const LP_VAULT_ABI = [
  "function createLock(address manager, uint256 tokenId, uint256 unlockTime) external returns (uint256 lockIndex)",
  "function collectFees(address manager, uint256 lockIndex, address recipient) external",
  "function withdrawNFT(address manager, uint256 lockIndex) external",
  "function getLockRefsByOwner(address owner) external view returns (tuple(address manager, uint256 index)[] memory)",
  "function getLocksByOwner(address owner) external view returns (tuple(uint256 tokenId, uint256 unlockTime, address owner, bool active)[] memory)",
  "function timeUntilUnlock(address manager, uint256 lockIndex) external view returns (uint256)",
];

// Known vault deployments (LPVault contract)
const VAULT_ADDRESSES: Partial<Record<number, string>> = {
  [84532]: "0x35b27228E96159E6c0A7921faC733C6aE06b86d1", // Base Sepolia (LPVault.sol)
  [8453]:  "0x5AA450B8fE52eD43455a3Cd7cACe01e086AF3805", // Base Mainnet (LPVault.sol)
};

interface LockInfo {
  manager: string;
  lockIndex: number;
  tokenId: string;
  unlockTime: number; // unix seconds
  active: boolean;
}

type LockTxStatus =
  | { type: "idle" }
  | { type: "approving" }
  | { type: "locking" }
  | { type: "collecting"; lockIndex: number }
  | { type: "withdrawing"; lockIndex: number }
  | { type: "closing"; lockIndex: number }
  | { type: "success"; message: string }
  | { type: "error"; message: string };

// ─── Math helpers (imported from shared utility) ──────────────────────────────
import { priceToSqrtPriceX96, priceToTick, snapTick } from "../utils/lpMath";

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
    switchAccount: walletSwitchAccount,
    disconnectWallet: walletDisconnect,
  } = useWallet();

  // Protocol / form state
  const [protocol, setProtocol] = useState<Protocol>("uniswap");
  const [token0Addr, setToken0Addr] = useState<string>("");
  const [token1Addr, setToken1Addr] = useState<string>("");
  const [selectedFee, setSelectedFee] = useState(10000);
  const [selectedSpacing, setSelectedSpacing] = useState(200);
  const [startingPrice, setStartingPrice] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [amount0, setAmount0] = useState("");
  const [amount1, setAmount1] = useState("");

  // Wallet tokens (fetched dynamically, filtered to balance > 0)
  const [walletTokens, setWalletTokens] = useState<WalletToken[]>([]);
  const [customTokens, setCustomTokens] = useState<Omit<WalletToken, "balance">[]>([]);
  const [customTokenInput, setCustomTokenInput] = useState("");
  const [customTokenError, setCustomTokenError] = useState("");

  // Status
  const [txStatus, setTxStatus] = useState<TxStatus>({ type: "idle" });

  // Vault / lock state
  const [vaultAddress, setVaultAddress] = useState<string>("");
  const [lockNfpm, setLockNfpm] = useState<string>("");
  const [lockTokenId, setLockTokenId] = useState<string>("");
  const [lockUnlockDate, setLockUnlockDate] = useState<string>("");
  const [lockUnlockTime, setLockUnlockTime] = useState<string>("00:00");
  const [myLocks, setMyLocks] = useState<LockInfo[]>([]);
  const [lockTxStatus, setLockTxStatus] = useState<LockTxStatus>({ type: "idle" });

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

  const t0 = walletTokens.find((t) => t.address.toLowerCase() === token0Addr.toLowerCase());
  const t1 = walletTokens.find((t) => t.address.toLowerCase() === token1Addr.toLowerCase());
  const sameToken = !!token0Addr && token0Addr.toLowerCase() === token1Addr.toLowerCase();

  // Sorted pair (by address, as Uniswap requires). Price inputs are always expressed
  // as sorted1/sorted0 regardless of which token the user puts in the t0/t1 dropdowns.
  const sorted0 = t0 && t1
    ? (t0.address.toLowerCase() < t1.address.toLowerCase() ? t0 : t1)
    : t0 ?? null;
  const sorted1 = t0 && t1
    ? (t0.address.toLowerCase() < t1.address.toLowerCase() ? t1 : t0)
    : t1 ?? null;

  const tickSpacing =
    protocol === "aerodrome"
      ? selectedSpacing
      : UNISWAP_FEE_OPTIONS.find((o) => o.fee === selectedFee)?.tickSpacing ?? 200;

  // Computed sqrtPriceX96 preview — prices are always in sorted1/sorted0 terms
  const sqrtPricePreview = (() => {
    if (!sorted0 || !sorted1) return "";
    const p = parseFloat(startingPrice);
    if (!p || p <= 0) return "";
    try {
      return priceToSqrtPriceX96(p, sorted0.decimals, sorted1.decimals).toString();
    } catch {
      return "";
    }
  })();

  const minTickPreview = (() => {
    if (!sorted0 || !sorted1) return "";
    const p = parseFloat(minPrice);
    if (!p || p <= 0) return "";
    const raw = priceToTick(p, sorted0.decimals, sorted1.decimals);
    return snapTick(raw, tickSpacing, true).toString();
  })();

  const maxTickPreview = (() => {
    if (!sorted0 || !sorted1) return "";
    const p = parseFloat(maxPrice);
    if (!p || p <= 0) return "";
    const raw = priceToTick(p, sorted0.decimals, sorted1.decimals);
    return snapTick(raw, tickSpacing, false).toString();
  })();

  const basescanBase =
    chainId === CHAIN.BASE_MAINNET
      ? "https://basescan.org"
      : "https://sepolia.basescan.org";

  // ─── Wallet setup ────────────────────────────────────────────────────────────

  // Clear wallet tokens when wallet disconnects
  useEffect(() => {
    if (!connectedAddress) { setWalletTokens([]); setToken0Addr(""); setToken1Addr(""); }
  }, [connectedAddress]);

  // Clear success status when any LP creation form field changes
  useEffect(() => {
    setTxStatus((s) => (s.type === "success" ? { type: "idle" } : s));
    setLockTxStatus((s) => (s.type === "success" || s.type === "error" ? { type: "idle" } : s));
  }, [protocol, token0Addr, token1Addr, selectedFee, selectedSpacing, startingPrice, minPrice, maxPrice, amount0, amount1]);

  // Auto-populate vault address and lock NFPM when chain / protocol changes
  useEffect(() => {
    if (chainId) {
      setVaultAddress(VAULT_ADDRESSES[chainId] ?? "");
    }
    if (chainId && protocol) {
      const nfpmAddr =
        protocol === "uniswap"
          ? UNISWAP_ADDRESSES[chainId]?.nfpm ?? ""
          : AERODROME_ADDRESSES.nfpm;
      setLockNfpm(nfpmAddr);
    }
  }, [chainId, protocol]);

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

  const switchAccount = () => {
    setWalletTokens([]);
    setToken0Addr("");
    setToken1Addr("");
    walletSwitchAccount();
  };

  // ─── Wallet token discovery ───────────────────────────────────────────────────

  const fetchWalletTokens = useCallback(async () => {
    const ethereum = getEthereum();
    if (!ethereum || !connectedAddress || !chainId) return;
    const seed = KNOWN_TOKENS[chainId] ?? [];
    // Merge seed + user-added custom tokens, deduplicated by address
    const all = [
      ...seed,
      ...customTokens.filter(
        (c) => !seed.some((s) => s.address.toLowerCase() === c.address.toLowerCase())
      ),
    ];
    try {
      const provider = new ethers.BrowserProvider(ethereum);
      const results: WalletToken[] = [];
      await Promise.all(
        all.map(async (t) => {
          const isSeed = seed.some((s) => s.address.toLowerCase() === t.address.toLowerCase());
          try {
            const contract = new ethers.Contract(t.address, ERC20_ABI, provider);
            const bal: bigint = await contract.balanceOf(connectedAddress);
            // Always include seed tokens (even with 0 balance); custom tokens require balance > 0
            if (isSeed || bal > 0n) {
              results.push({ ...t, balance: ethers.formatUnits(bal, t.decimals) });
            }
          } catch {
            // For seed tokens, still include them even if balance check fails
            if (isSeed) results.push({ ...t, balance: "0" });
          }
        })
      );
      // Keep seed tokens in their defined order, custom tokens appended after
      results.sort((a, b) => {
        const ai = seed.findIndex((s) => s.address.toLowerCase() === a.address.toLowerCase());
        const bi = seed.findIndex((s) => s.address.toLowerCase() === b.address.toLowerCase());
        if (ai !== -1 && bi !== -1) return ai - bi;
        if (ai !== -1) return -1;
        if (bi !== -1) return 1;
        return 0;
      });
      setWalletTokens(results);
      // Auto-select only on initial load (addresses are empty) — never override
      // a user selection on a balance refresh, as that would clear the success message.
      setToken0Addr((prev) => prev || (results[0]?.address ?? ""));
      setToken1Addr((prev) => prev || (results[1]?.address ?? ""));
    } catch { /* silent */ }
  }, [connectedAddress, chainId, customTokens, getEthereum]);

  useEffect(() => {
    if (connectedAddress && chainId) fetchWalletTokens();
  }, [connectedAddress, chainId, fetchWalletTokens]);

  const handleAddCustomToken = async () => {
    setCustomTokenError("");
    const addr = customTokenInput.trim();
    if (!ethers.isAddress(addr)) {
      setCustomTokenError("Invalid address.");
      return;
    }
    if (walletTokens.some((t) => t.address.toLowerCase() === addr.toLowerCase())) {
      setCustomTokenError("Token already in list.");
      return;
    }
    const ethereum = getEthereum();
    if (!ethereum) return;
    try {
      const provider = new ethers.BrowserProvider(ethereum);
      const contract = new ethers.Contract(addr, ERC20_ABI, provider);
      const [symbol, decimals] = await Promise.all([
        contract.symbol() as Promise<string>,
        contract.decimals() as Promise<bigint>,
      ]);
      setCustomTokens((prev) => [...prev, { address: addr, symbol, decimals: Number(decimals) }]);
      setCustomTokenInput("");
    } catch {
      setCustomTokenError("Could not fetch token info. Is this a valid ERC-20?");
    }
  };

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

      if (!t0 || !t1) throw new Error("Token info not loaded. Select both tokens.");

      // Sort tokens by address (Uniswap requires token0 < token1)
      const localSorted0 = t0.address.toLowerCase() < t1.address.toLowerCase() ? t0 : t1;
      const localSorted1 = t0.address.toLowerCase() < t1.address.toLowerCase() ? t1 : t0;
      const wasSwapped = localSorted0.address.toLowerCase() !== t0.address.toLowerCase();

      // Prices are always entered as sorted1/sorted0 (e.g. USDC per HLRR) — no inversion.
      const humanPrice = parseFloat(startingPrice);
      const humanMin = parseFloat(minPrice);
      const humanMax = parseFloat(maxPrice);

      const sqrtPrice = priceToSqrtPriceX96(humanPrice, localSorted0.decimals, localSorted1.decimals);

      const rawTickLower = priceToTick(humanMin, localSorted0.decimals, localSorted1.decimals);
      const rawTickUpper = priceToTick(humanMax, localSorted0.decimals, localSorted1.decimals);

      const tickLower = snapTick(rawTickLower, tickSpacing, true);
      const tickUpper = snapTick(rawTickUpper, tickSpacing, false);

      if (tickLower >= tickUpper) {
        setTxStatus({ type: "error", message: "Min price must be less than Max price." });
        return;
      }

      // Pre-flight: if a pool already exists at this fee tier, verify its current
      // price falls inside the user's tick range.  createAndInitializePoolIfNecessary
      // is a no-op on an existing pool, so a wrong-priced pool would silently deposit
      // only one token (no HLRR if price > tickUpper, no USDC if price < tickLower).
      if (protocol === "uniswap") {
        const provider2 = new ethers.BrowserProvider(ethereum);
        const addrs = UNISWAP_ADDRESSES[chainId];
        if (addrs) {
          const factory = new ethers.Contract(addrs.factory, UNISWAP_FACTORY_ABI, provider2);
          const existingPool: string = await factory.getPool(
            localSorted0.address, localSorted1.address, selectedFee
          );
          if (existingPool !== ethers.ZeroAddress) {
            const pool = new ethers.Contract(existingPool, UNISWAP_POOL_ABI, provider2);
            const [, currentTick]: [bigint, number] = await pool.slot0();
            if (currentTick < tickLower || currentTick >= tickUpper) {
              const currentPrice = (1.0001 ** currentTick) * Math.pow(10, localSorted0.decimals - localSorted1.decimals);
              setTxStatus({
                type: "error",
                message:
                  `Pool already exists at tick ${currentTick} (≈$${currentPrice.toFixed(4)} ${localSorted1.symbol}/${localSorted0.symbol}), ` +
                  `which is OUTSIDE your range [$${humanMin}–$${humanMax}]. ` +
                  `Switch to a different fee tier (e.g. 1%) to create a fresh pool at the correct price.`,
              });
              return;
            }
          }
        }
      }

      const amt0Raw = ethers.parseUnits(
        wasSwapped ? amount1 : amount0,
        localSorted0.decimals
      );
      const amt1Raw = ethers.parseUnits(
        wasSwapped ? amount0 : amount1,
        localSorted1.decimals
      );

      const nfpmAddress =
        protocol === "uniswap"
          ? UNISWAP_ADDRESSES[chainId].nfpm
          : AERODROME_ADDRESSES.nfpm;

      // Approve 2% above desired to cover Uniswap's internal rounding — avoids STF.
      // Check against approval amount (not amt0Raw) so a stale exact-amount allowance
      // from a previous attempt doesn't cause us to skip re-approval.
      const approval0 = amt0Raw * 102n / 100n;
      const approval1 = amt1Raw * 102n / 100n;

      // Step 1: Approve token0
      setTxStatus({ type: "approving_token0" });
      const erc0 = new ethers.Contract(localSorted0.address, ERC20_ABI, signer);
      const allowance0: bigint = await erc0.allowance(connectedAddress, nfpmAddress);
      if (allowance0 < approval0) {
        const tx = await erc0.approve(nfpmAddress, approval0);
        await tx.wait(2);
      }

      // Step 2: Approve token1
      setTxStatus({ type: "approving_token1" });
      const erc1 = new ethers.Contract(localSorted1.address, ERC20_ABI, signer);
      const allowance1: bigint = await erc1.allowance(connectedAddress, nfpmAddress);
      if (allowance1 < approval1) {
        const tx = await erc1.approve(nfpmAddress, approval1);
        await tx.wait(2);
      }

      const deadline = Math.floor(Date.now() / 1000) + 1200; // 20 min

      let receipt: ethers.TransactionReceipt | null = null;

      if (protocol === "uniswap") {
        setTxStatus({ type: "creating_pool" });
        const nfpm = new ethers.Contract(nfpmAddress, NFPM_UNISWAP_ABI, signer);

        const iface = new ethers.Interface(NFPM_UNISWAP_ABI);

        const initCalldata = iface.encodeFunctionData("createAndInitializePoolIfNecessary", [
          localSorted0.address,
          localSorted1.address,
          selectedFee,
          sqrtPrice,
        ]);

        const mintCalldata = iface.encodeFunctionData("mint", [
          {
            token0: localSorted0.address,
            token1: localSorted1.address,
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
          token0: localSorted0.address,
          token1: localSorted1.address,
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
      if (tokenId !== "unknown") setLockTokenId(tokenId);
      fetchWalletTokens();
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

  // ─── Vault handlers ──────────────────────────────────────────────────────────

  const fetchMyLocks = useCallback(async () => {
    const ethereum = getEthereum();
    if (!ethereum || !connectedAddress || !vaultAddress) return;
    try {
      const provider = new ethers.BrowserProvider(ethereum);
      const vault = new ethers.Contract(vaultAddress, LP_VAULT_ABI, provider);
      const [refs, locks]: [
        { manager: string; index: bigint }[],
        { tokenId: bigint; unlockTime: bigint; owner: string; active: boolean }[]
      ] = await Promise.all([
        vault.getLockRefsByOwner(connectedAddress),
        vault.getLocksByOwner(connectedAddress),
      ]);
      setMyLocks(
        refs.map((ref, i) => ({
          manager: ref.manager,
          lockIndex: Number(ref.index),
          tokenId: locks[i].tokenId.toString(),
          unlockTime: Number(locks[i].unlockTime),
          active: locks[i].active,
        }))
      );
    } catch (err) {
      console.error("fetchMyLocks error:", err);
    }
  }, [connectedAddress, vaultAddress, getEthereum]);

  useEffect(() => {
    fetchMyLocks();
    const interval = setInterval(fetchMyLocks, 30_000);
    return () => clearInterval(interval);
  }, [fetchMyLocks]);

  const handleLockNFT = async () => {
    const ethereum = getEthereum();
    if (!ethereum || !connectedAddress) return;
    if (!lockNfpm) { setLockTxStatus({ type: "error", message: "NFPM address required." }); return; }
    if (!lockTokenId) { setLockTxStatus({ type: "error", message: "Token ID required." }); return; }
    if (!lockUnlockDate) { setLockTxStatus({ type: "error", message: "Unlock date required." }); return; }
    if (!vaultAddress) { setLockTxStatus({ type: "error", message: "Vault address required." }); return; }

    const unlockTimestamp = Math.floor(new Date(`${lockUnlockDate}T${lockUnlockTime || "00:00"}`).getTime() / 1000);
    if (unlockTimestamp <= Math.floor(Date.now() / 1000)) {
      setLockTxStatus({ type: "error", message: "Unlock date must be in the future." });
      return;
    }

    try {
      const provider = new ethers.BrowserProvider(ethereum);
      const signer = await provider.getSigner();

      // Step 1: approve NFPM to let vault pull the NFT
      setLockTxStatus({ type: "approving" });
      const nfpm = new ethers.Contract(lockNfpm, NFPM_APPROVE_ABI, signer);
      const approveTx = await nfpm.approve(vaultAddress, BigInt(lockTokenId));
      await approveTx.wait(2);

      // Step 2: createLock
      setLockTxStatus({ type: "locking" });
      const vault = new ethers.Contract(vaultAddress, LP_VAULT_ABI, signer);
      const lockTx = await vault.createLock(lockNfpm, BigInt(lockTokenId), BigInt(unlockTimestamp));
      const receipt = await lockTx.wait();
      if (!receipt || receipt.status === 0) throw new Error("Lock transaction reverted");

      setLockTxStatus({ type: "success", message: `NFT #${lockTokenId} locked until ${new Date(`${lockUnlockDate}T${lockUnlockTime || "00:00"}`).toLocaleString()}.` });
      setLockTokenId("");
      await fetchMyLocks();
    } catch (err: unknown) {
      const e = err as { code?: number | string; reason?: string; message?: string };
      if (e.code === 4001 || e.code === "ACTION_REJECTED") {
        setLockTxStatus({ type: "error", message: "Rejected by user." });
      } else {
        setLockTxStatus({ type: "error", message: e.reason ?? e.message ?? "Lock failed." });
      }
    }
  };

  const handleCollectFees = async (manager: string, lockIndex: number) => {
    const ethereum = getEthereum();
    if (!ethereum || !connectedAddress || !vaultAddress) return;
    try {
      setLockTxStatus({ type: "collecting", lockIndex });
      const provider = new ethers.BrowserProvider(ethereum);
      const signer = await provider.getSigner();
      const vault = new ethers.Contract(vaultAddress, LP_VAULT_ABI, signer);
      const tx = await vault.collectFees(manager, lockIndex, connectedAddress);
      await tx.wait();
      setLockTxStatus({ type: "success", message: "Fees collected to your wallet." });
      await fetchMyLocks();
    } catch (err: unknown) {
      const e = err as { code?: number | string; reason?: string; message?: string };
      if (e.code === 4001 || e.code === "ACTION_REJECTED") {
        setLockTxStatus({ type: "error", message: "Rejected by user." });
      } else {
        setLockTxStatus({ type: "error", message: e.reason ?? e.message ?? "Collect fees failed." });
      }
    }
  };

  const handleWithdrawNFT = async (manager: string, lockIndex: number) => {
    const ethereum = getEthereum();
    if (!ethereum || !connectedAddress || !vaultAddress) return;
    try {
      setLockTxStatus({ type: "withdrawing", lockIndex });
      const provider = new ethers.BrowserProvider(ethereum);
      const signer = await provider.getSigner();
      const vault = new ethers.Contract(vaultAddress, LP_VAULT_ABI, signer);
      const tx = await vault.withdrawNFT(manager, lockIndex);
      await tx.wait();
      setLockTxStatus({ type: "success", message: `NFT withdrawn back to your wallet.` });
      await fetchMyLocks();
    } catch (err: unknown) {
      const e = err as { code?: number | string; reason?: string; message?: string };
      if (e.code === 4001 || e.code === "ACTION_REJECTED") {
        setLockTxStatus({ type: "error", message: "Rejected by user." });
      } else {
        setLockTxStatus({ type: "error", message: e.reason ?? e.message ?? "Withdraw failed." });
      }
    }
  };

  const handleClosePosition = async (manager: string, lockIndex: number, tokenId: string) => {
    const ethereum = getEthereum();
    if (!ethereum || !connectedAddress || !vaultAddress) return;
    try {
      setLockTxStatus({ type: "closing", lockIndex });
      const provider = new ethers.BrowserProvider(ethereum);
      const signer = await provider.getSigner();

      // Step 1: withdraw NFT from vault back to wallet
      const vault = new ethers.Contract(vaultAddress, LP_VAULT_ABI, signer);
      const withdrawTx = await vault.withdrawNFT(manager, lockIndex);
      await withdrawTx.wait();

      // Step 2: read current liquidity
      const nfpm = new ethers.Contract(manager, NFPM_CLOSE_ABI, signer);
      const pos = await nfpm.positions(BigInt(tokenId));
      const liquidity: bigint = pos.liquidity;

      const deadline = Math.floor(Date.now() / 1000) + 1200;
      const MAX_U128 = 2n ** 128n - 1n;
      const iface = new ethers.Interface(NFPM_CLOSE_ABI);

      // Steps 3+4: decreaseLiquidity + collect in one multicall (single MetaMask
      // confirmation, atomic — same pattern as Uniswap's own UI).
      // Always include collect so any pre-existing tokensOwed (accrued fees) are
      // also swept to the wallet even if liquidity is already 0.
      const calls: string[] = [];
      if (liquidity > 0n) {
        calls.push(iface.encodeFunctionData("decreaseLiquidity", [{
          tokenId: BigInt(tokenId),
          liquidity,
          amount0Min: 0n,
          amount1Min: 0n,
          deadline,
        }]));
      }
      calls.push(iface.encodeFunctionData("collect", [{
        tokenId: BigInt(tokenId),
        recipient: connectedAddress,
        amount0Max: MAX_U128,
        amount1Max: MAX_U128,
      }]));
      const multicallTx = await nfpm.multicall(calls);
      await multicallTx.wait();

      // Step 5: burn the NFT (only succeeds when liquidity=0 and tokensOwed=0)
      const burnTx = await nfpm.burn(BigInt(tokenId));
      await burnTx.wait();

      setLockTxStatus({ type: "success", message: `Position #${tokenId} closed. Tokens returned to your wallet.` });
      await fetchMyLocks();
    } catch (err: unknown) {
      const e = err as { code?: number | string; reason?: string; message?: string };
      if (e.code === 4001 || e.code === "ACTION_REJECTED") {
        setLockTxStatus({ type: "error", message: "Rejected by user." });
      } else {
        setLockTxStatus({ type: "error", message: e.reason ?? e.message ?? "Close position failed." });
      }
    }
  };

  // ─── Validation ──────────────────────────────────────────────────────────────

  const formValid =
    !!connectedAddress &&
    isSupported &&
    !isAeroOnTestnet &&
    !!t0 && !!t1 &&
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
        return `Approving ${t0?.symbol ?? token0Addr.slice(0, 8)}...`;
      case "approving_token1":
        return `Approving ${t1?.symbol ?? token1Addr.slice(0, 8)}...`;
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
          {!connectedAddress ? (
            <button
              onClick={connectWallet}
              disabled={isSubmitting}
              style={{ ...S.btn, width: "auto", padding: "0.5rem 1.25rem", fontSize: "0.9rem" }}
            >
              Connect Wallet
            </button>
          ) : (
            <button
              onClick={switchAccount}
              disabled={isSubmitting}
              style={{ ...S.btn, width: "auto", padding: "0.4rem 1rem", fontSize: "0.8rem", background: "rgba(34,211,238,0.15)", border: "1px solid rgba(34,211,238,0.5)", color: "#22d3ee" }}
            >
              Switch Account
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
          {walletTokens.length === 0 && connectedAddress && isSupported && (
            <p style={{ ...S.hint, marginBottom: "0.75rem" }}>
              No tokens with balance found in wallet. Add a token address below.
            </p>
          )}
          <div style={S.row}>
            {/* Token0 */}
            <div>
              <label style={S.label}>Token 0</label>
              <select
                style={S.select}
                value={token0Addr}
                onChange={(e) => setToken0Addr(e.target.value)}
                disabled={walletTokens.length === 0}
              >
                {walletTokens.length === 0 && <option value="">— no tokens —</option>}
                {walletTokens.map((t) => (
                  <option key={t.address} value={t.address}>
                    {t.symbol} ({parseFloat(t.balance).toFixed(4)})
                  </option>
                ))}
              </select>
            </div>
            {/* Token1 */}
            <div>
              <label style={S.label}>Token 1</label>
              <select
                style={S.select}
                value={token1Addr}
                onChange={(e) => setToken1Addr(e.target.value)}
                disabled={walletTokens.length === 0}
              >
                {walletTokens.length === 0 && <option value="">— no tokens —</option>}
                {walletTokens.map((t) => (
                  <option key={t.address} value={t.address}>
                    {t.symbol} ({parseFloat(t.balance).toFixed(4)})
                  </option>
                ))}
              </select>
            </div>
          </div>
          {sameToken && (
            <p style={{ color: "#ef4444", fontSize: "0.8rem", marginTop: "0.5rem" }}>
              Token 0 and Token 1 must be different.
            </p>
          )}
          {/* Add custom token */}
          <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
            <div style={{ flex: 1 }}>
              <input
                style={{ ...S.input, marginBottom: 0 }}
                placeholder="Token not listed? Paste its contract address (0x…)"
                value={customTokenInput}
                onChange={(e) => { setCustomTokenInput(e.target.value); setCustomTokenError(""); }}
                onKeyDown={(e) => e.key === "Enter" && handleAddCustomToken()}
              />
              {customTokenError && (
                <p style={{ color: "#ef4444", fontSize: "0.78rem", marginTop: "0.25rem" }}>{customTokenError}</p>
              )}
            </div>
            <button
              type="button"
              onClick={handleAddCustomToken}
              disabled={!customTokenInput.trim() || !connectedAddress}
              style={{ ...S.btn, width: "auto", padding: "0.5rem 1rem", fontSize: "0.85rem", marginTop: 0,
                background: customTokenInput.trim() && connectedAddress ? "var(--accent)" : "rgba(255,255,255,0.05)",
                color: customTokenInput.trim() && connectedAddress ? "#0f172a" : "#4b5563",
              }}
            >
              Add
            </button>
          </div>
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
            {sorted1?.symbol ?? "Token1"} per {sorted0?.symbol ?? "Token0"}
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
                Min Price ({sorted1?.symbol ?? "T1"}/{sorted0?.symbol ?? "T0"})
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
                Max Price ({sorted1?.symbol ?? "T1"}/{sorted0?.symbol ?? "T0"})
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
              <label style={S.label}>{t0?.symbol ?? "Token 0"} amount</label>
              <input
                type="number"
                min="0"
                step="any"
                style={S.input}
                placeholder="0.0"
                value={amount0}
                onChange={(e) => setAmount0(e.target.value)}
              />
              {t0 && (
                <p style={S.hint}>Wallet: {parseFloat(t0.balance).toFixed(4)} {t0.symbol}</p>
              )}
            </div>
            <div>
              <label style={S.label}>{t1?.symbol ?? "Token 1"} amount</label>
              <input
                type="number"
                min="0"
                step="any"
                style={S.input}
                placeholder="0.0"
                value={amount1}
                onChange={(e) => setAmount1(e.target.value)}
              />
              {t1 && (
                <p style={S.hint}>Wallet: {parseFloat(t1.balance).toFixed(4)} {t1.symbol}</p>
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
            <br />
            <span style={{ fontSize: "0.78rem", color: "#6b7280", fontFamily: "monospace", wordBreak: "break-all" }}>
              Tx: {txStatus.txHash}
            </span>
          </div>
        )}

        {txStatus.type === "error" && (
          <div className="error-message" style={{ marginTop: "1rem" }}>
            {txStatus.message}
          </div>
        )}

        {/* ── Divider ── */}
        <hr style={{ border: "none", borderTop: "1px solid rgba(255,255,255,0.08)", margin: "1.5rem 0" }} />

        {/* ── Lock LP Position ── */}
        <div style={S.card}>
          <p style={{ ...S.sectionTitle, fontSize: "1.1rem", marginBottom: "1.25rem" }}>
            Lock LP Position
          </p>
          <p style={{ fontSize: "0.85rem", color: "#9ca3af", marginBottom: "1.25rem" }}>
            Lock your LP NFT into the vault to prevent it from being flagged as unlocked liquidity. You can still collect trading fees while it is locked.
          </p>

          {/* NFPM */}
          <div style={{ marginBottom: "1rem" }}>
            <label style={S.label}>NFPM Address <span style={{ color: "#6b7280" }}>(auto-filled from protocol)</span></label>
            <input
              style={S.input}
              value={lockNfpm}
              onChange={(e) => setLockNfpm(e.target.value)}
              placeholder="0x..."
            />
          </div>

          {/* Token ID */}
          <div style={{ marginBottom: "1rem" }}>
            <label style={S.label}>LP NFT Token ID</label>
            <input
              style={S.input}
              type="number"
              value={lockTokenId}
              onChange={(e) => setLockTokenId(e.target.value)}
              placeholder="e.g. 12345  (shown in success message after creating above)"
            />
          </div>

          {/* Unlock date */}
          <div style={{ marginBottom: "1rem" }}>
            <label style={S.label}>Unlock Date &amp; Time (24h)</label>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <input
                style={{ ...S.input, flex: 2 }}
                type="date"
                value={lockUnlockDate}
                onChange={(e) => setLockUnlockDate(e.target.value)}
              />
              <input
                style={{ ...S.input, flex: 1 }}
                type="time"
                step="60"
                value={lockUnlockTime}
                onChange={(e) => setLockUnlockTime(e.target.value)}
              />
            </div>
            {lockUnlockDate && (() => {
              const ts = new Date(`${lockUnlockDate}T${lockUnlockTime || "00:00"}`);
              const isPast = ts.getTime() <= Date.now();
              return (
                <div style={{ fontSize: "0.78rem", marginTop: "0.3rem", color: isPast ? "#ef4444" : "#6b7280" }}>
                  {isPast
                    ? "⚠ Unlock date is in the past — choose a future date."
                    : `Locks until: ${ts.toLocaleString()}`}
                </div>
              );
            })()}
          </div>

          {/* Vault address */}
          <div style={{ marginBottom: "1.25rem" }}>
            <label style={S.label}>Vault Contract Address</label>
            <input
              style={S.input}
              value={vaultAddress}
              onChange={(e) => setVaultAddress(e.target.value)}
              placeholder="0x...  (deploy LPVault.sol and paste address)"
            />
            {!vaultAddress && (
              <div style={{ fontSize: "0.78rem", color: "#f59e0b", marginTop: "0.3rem" }}>
                LPVault not deployed on this network yet — deploy contracts/LPTimeLock.sol first.
              </div>
            )}
          </div>

          <button
            onClick={handleLockNFT}
            disabled={
              !connectedAddress || !lockNfpm || !lockTokenId || !lockUnlockDate || !vaultAddress ||
              lockTxStatus.type === "approving" || lockTxStatus.type === "locking" ||
              (!!lockUnlockDate && new Date(`${lockUnlockDate}T${lockUnlockTime || "00:00"}`).getTime() <= Date.now())
            }
            style={{
              width: "100%",
              padding: "0.875rem",
              background: (!connectedAddress || !lockNfpm || !lockTokenId || !lockUnlockDate || !vaultAddress)
                ? "#374151" : "#7c3aed",
              color: "white",
              border: "none",
              borderRadius: 8,
              fontSize: "1rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {lockTxStatus.type === "approving"
              ? "Approving NFT transfer..."
              : lockTxStatus.type === "locking"
              ? "Locking in vault..."
              : "Approve & Lock"}
          </button>

          {lockTxStatus.type === "success" && (
            <div style={{ marginTop: "1rem", padding: "0.85rem 1rem", background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.4)", borderRadius: 8, color: "#6ee7b7", fontSize: "0.9rem" }}>
              {lockTxStatus.message}
            </div>
          )}
          {lockTxStatus.type === "error" && (
            <div className="error-message" style={{ marginTop: "1rem" }}>
              {lockTxStatus.message}
            </div>
          )}
        </div>

        {/* ── My Locked Positions ── */}
        <div style={S.card}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
            <p style={{ ...S.sectionTitle, fontSize: "1.1rem", margin: 0 }}>My Locked Positions</p>
            <button
              onClick={fetchMyLocks}
              disabled={!connectedAddress || !vaultAddress}
              style={{
                padding: "0.35rem 0.85rem",
                background: "rgba(34,211,238,0.08)",
                border: "1px solid rgba(34,211,238,0.35)",
                borderRadius: 6,
                color: "var(--accent)",
                fontSize: "0.8rem",
                cursor: "pointer",
              }}
            >
              Refresh
            </button>
          </div>

          {!vaultAddress && (
            <div style={{ color: "#6b7280", fontSize: "0.9rem" }}>Enter a vault address above to view locks.</div>
          )}

          {vaultAddress && !connectedAddress && (
            <div style={{ color: "#6b7280", fontSize: "0.9rem" }}>Connect wallet to view your locks.</div>
          )}

          {vaultAddress && connectedAddress && myLocks.length === 0 && (
            <div style={{ color: "#6b7280", fontSize: "0.9rem" }}>No locked positions found.</div>
          )}

          {myLocks.map((lock, i) => {
            const now = Math.floor(Date.now() / 1000);
            const isUnlocked = lock.unlockTime <= now;
            const secondsLeft = lock.unlockTime - now;
            const daysLeft = Math.floor(secondsLeft / 86400);
            const hoursLeft = Math.floor((secondsLeft % 86400) / 3600);
            const minutesLeft = Math.floor((secondsLeft % 3600) / 60);
            const countdownLabel = daysLeft > 0
              ? `${daysLeft}d ${hoursLeft}h remaining`
              : hoursLeft > 0
              ? `${hoursLeft}h ${minutesLeft}m remaining`
              : minutesLeft > 0
              ? `${minutesLeft}m remaining`
              : secondsLeft > 0
              ? "< 1m remaining"
              : "Unlocked";
            const isCollecting = lockTxStatus.type === "collecting" && lockTxStatus.lockIndex === lock.lockIndex;
            const isWithdrawing = lockTxStatus.type === "withdrawing" && lockTxStatus.lockIndex === lock.lockIndex;
            const isClosing = lockTxStatus.type === "closing" && lockTxStatus.lockIndex === lock.lockIndex;
            const isBusy = isCollecting || isWithdrawing || isClosing;

            return (
              <div
                key={`${lock.manager}-${lock.lockIndex}`}
                style={{
                  padding: "1rem",
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 8,
                  marginBottom: "0.75rem",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.75rem" }}>
                  <div>
                    <div style={{ fontWeight: 600, color: "var(--text)" }}>NFT #{lock.tokenId}</div>
                    <div style={{ fontSize: "0.78rem", color: "#6b7280", marginTop: "0.2rem" }}>
                      NFPM: {lock.manager.slice(0, 8)}…{lock.manager.slice(-6)}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "0.85rem", color: isUnlocked ? "#6ee7b7" : "#fbbf24" }}>
                      {isUnlocked ? "✅ Unlocked" : `🔒 ${countdownLabel}`}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#6b7280", marginTop: "0.2rem" }}>
                      {new Date(lock.unlockTime * 1000).toLocaleString()}
                    </div>
                  </div>
                </div>

                {lock.active && (
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    <button
                      onClick={() => handleCollectFees(lock.manager, lock.lockIndex)}
                      disabled={isBusy}
                      style={{
                        flex: 1,
                        padding: "0.5rem 0.75rem",
                        background: "rgba(34,211,238,0.08)",
                        border: "1px solid rgba(34,211,238,0.3)",
                        borderRadius: 6,
                        color: "#67e8f9",
                        fontSize: "0.85rem",
                        cursor: isBusy ? "not-allowed" : "pointer",
                        fontWeight: 500,
                      }}
                    >
                      {isCollecting ? "Collecting…" : "Collect Fees"}
                    </button>
                    <button
                      onClick={() => handleWithdrawNFT(lock.manager, lock.lockIndex)}
                      disabled={!isUnlocked || isBusy}
                      title={!isUnlocked ? "Still locked" : "Withdraw NFT to your wallet"}
                      style={{
                        flex: 1,
                        padding: "0.5rem 0.75rem",
                        background: isUnlocked ? "rgba(124,58,237,0.15)" : "rgba(255,255,255,0.03)",
                        border: `1px solid ${isUnlocked ? "rgba(124,58,237,0.5)" : "rgba(255,255,255,0.08)"}`,
                        borderRadius: 6,
                        color: isUnlocked ? "#c4b5fd" : "#4b5563",
                        fontSize: "0.85rem",
                        cursor: isUnlocked && !isBusy ? "pointer" : "not-allowed",
                        fontWeight: 500,
                      }}
                    >
                      {isWithdrawing ? "Withdrawing…" : "Withdraw NFT"}
                    </button>
                    {isUnlocked && (
                      <button
                        onClick={() => handleClosePosition(lock.manager, lock.lockIndex, lock.tokenId)}
                        disabled={isBusy}
                        title="Remove all liquidity, collect tokens, and burn the NFT"
                        style={{
                          flex: 1,
                          padding: "0.5rem 0.75rem",
                          background: isBusy ? "rgba(255,255,255,0.03)" : "rgba(239,68,68,0.12)",
                          border: `1px solid ${isBusy ? "rgba(255,255,255,0.08)" : "rgba(239,68,68,0.4)"}`,
                          borderRadius: 6,
                          color: isBusy ? "#4b5563" : "#fca5a5",
                          fontSize: "0.85rem",
                          cursor: isBusy ? "not-allowed" : "pointer",
                          fontWeight: 500,
                        }}
                      >
                        {isClosing ? "Closing…" : "Close Position"}
                      </button>
                    )}
                  </div>
                )}

                {!lock.active && (
                  <div style={{ fontSize: "0.82rem", color: "#6b7280" }}>Withdrawn</div>
                )}
              </div>
            );
          })}

          {(lockTxStatus.type === "collecting" || lockTxStatus.type === "withdrawing") && (
            <div style={{ color: "#67e8f9", fontSize: "0.85rem", marginTop: "0.5rem" }}>
              {lockTxStatus.type === "collecting" ? "Collecting fees…" : "Withdrawing NFT…"}
            </div>
          )}
        </div>

      </div>
    </main>
  );
}
