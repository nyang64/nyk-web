import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import type { Route } from "./+types/nswap";
import { useWallet } from "../hooks/useWallet";
import type { EIP6963ProviderDetail } from "../hooks/useWallet";
import { WalletPickerModal } from "../components/WalletPickerModal";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "nSwap© | Swap USDC ↔ HLRR on Base | NykLabs" },
    {
      name: "description",
      content:
        "nSwap by NykLabs lets you swap USDC and HLRR (Hashed Lierre Token) directly via the Aerodrome concentrated liquidity pool on Base. Connect your wallet and trade instantly — no intermediaries, no custody.",
    },
    {
      name: "keywords",
      content:
        "nSwap, HLRR, Hashed Lierre, USDC, swap, Aerodrome, concentrated liquidity, Base, DeFi, token swap, NykLabs, on-chain swap, decentralized exchange",
    },
    { property: "og:title", content: "nSwap© | Swap USDC ↔ HLRR on Base | NykLabs" },
    {
      property: "og:description",
      content:
        "Swap USDC and HLRR (Hashed Lierre Token) on-chain via the Aerodrome CL pool on Base. A free, non-custodial swap tool by NykLabs.",
    },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "twitter:title", content: "nSwap© | Swap USDC ↔ HLRR on Base | NykLabs" },
    {
      name: "twitter:description",
      content:
        "Swap USDC and HLRR (Hashed Lierre Token) on-chain via the Aerodrome CL pool on Base. A free, non-custodial swap tool by NykLabs.",
    },
  ];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BASE_MAINNET_ID = 8453;

const USDC_ADDRESS  = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const HLRR_ADDRESS  = "0x5E1583d48bcFd60de77138ea195f3EFbe128405d";
const USDC_DECIMALS = 6;
const HLRR_DECIMALS = 8;

// Aerodrome Slipstream (CL) contracts on Base mainnet
const AERODROME_CL_FACTORY = "0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A";
const AERODROME_CL_ROUTER  = "0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5";
const AERODROME_CL_QUOTER  = "0x254cF9E1E6e233aa1AC962CB9B05b2cfeAaE15b0";

// Tick spacings to probe when finding the pool
const TICK_SPACINGS = [1, 50, 100, 200, 2000];

const BASE_META = {
  chainName: "Base",
  rpcUrls: ["https://mainnet.base.org"],
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  blockExplorerUrls: ["https://basescan.org"],
};

// ─── ABIs ─────────────────────────────────────────────────────────────────────

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
];

const FACTORY_ABI = [
  "function getPool(address tokenA, address tokenB, int24 tickSpacing) view returns (address pool)",
];

const POOL_ABI = [
  "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, bool unlocked)",
  "function token0() view returns (address)",
];

// Aerodrome Slipstream SwapRouter: uses tickSpacing instead of fee
const ROUTER_ABI = [
  "function exactInputSingle((address tokenIn, address tokenOut, int24 tickSpacing, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) params) payable returns (uint256 amountOut)",
];

// Aerodrome Slipstream QuoterV2: simulates swap to get accurate amountOut including price impact
const QUOTER_ABI = [
  "function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, int24 tickSpacing, uint160 sqrtPriceLimitX96) params) returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)",
];

// ─── Types ────────────────────────────────────────────────────────────────────

type TxStatus =
  | { type: "idle" }
  | { type: "pending"; msg: string; hash?: string }
  | { type: "success"; msg: string; hash?: string }
  | { type: "error"; msg: string };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function truncateAddr(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function fmtBalance(raw: bigint, decimals: number, precision = 4): string {
  const divisor = BigInt(10) ** BigInt(decimals);
  const whole = raw / divisor;
  const frac  = raw % divisor;
  const fracStr = frac.toString().padStart(decimals, "0").slice(0, precision);
  return `${whole}.${fracStr}`;
}

/** Spot price: USDC per 1 HLRR (display-only float). */
function spotPriceUsdcPerHlrr(sqrtPriceX96: bigint, token0IsHlrr: boolean): number {
  const sqrtP = Number(sqrtPriceX96);
  const Q96   = 2 ** 96;
  const rawPrice = (sqrtP / Q96) ** 2; // token1_raw per token0_raw

  if (token0IsHlrr) {
    // token0=HLRR(8), token1=USDC(6) → rawPrice = USDC_raw/HLRR_raw
    // human USDC per HLRR = rawPrice × 10^8 / 10^6 = rawPrice × 100
    return rawPrice * 100;
  } else {
    // token0=USDC(6), token1=HLRR(8) → rawPrice = HLRR_raw/USDC_raw
    // human USDC per HLRR = 100 / rawPrice
    return 100 / rawPrice;
  }
}

/** Estimate output (BigInt raw) from input (BigInt raw) using current sqrtPriceX96. */
function estimateOut(
  amountInRaw:  bigint,
  sqrtPriceX96: bigint,
  tokenInIsToken0: boolean,
): bigint {
  const Q192 = BigInt(2) ** BigInt(192);
  const sp2  = sqrtPriceX96 * sqrtPriceX96;
  if (tokenInIsToken0) {
    // selling token0, receiving token1 → out ≈ in × sp² / Q192
    return (amountInRaw * sp2) / Q192;
  } else {
    // selling token1, receiving token0 → out ≈ in × Q192 / sp²
    return (amountInRaw * Q192) / sp2;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function NSwap() {
  const {
    connectedAddress,
    chainId,
    discoveredWallets,
    showWalletPicker,
    setShowWalletPicker,
    getEthereum,
    connectWallet,
    connectWithProvider,
    switchAccount,
    switchNetwork,
    disconnectWallet,
  } = useWallet();

  // buyMode: true = USDC → HLRR, false = HLRR → USDC
  const [buyMode,          setBuyMode]          = useState(true);
  const [amountIn,         setAmountIn]         = useState("");
  const [estimatedOut,     setEstimatedOut]     = useState<string | null>(null);
  const [estimatedOutRaw,  setEstimatedOutRaw]  = useState<bigint | null>(null);
  const [quoteLoading,     setQuoteLoading]     = useState(false);
  const [slippage,         setSlippage]         = useState("0.5");

  // Pool discovery
  const [poolAddress,    setPoolAddress]    = useState<string | null>(null);
  const [tickSpacing,    setTickSpacing]    = useState<number | null>(null);
  const [sqrtPriceX96,  setSqrtPriceX96]  = useState<bigint | null>(null);
  const [token0IsHlrr,  setToken0IsHlrr]  = useState<boolean | null>(null);

  // Balances
  const [usdcBalance, setUsdcBalance] = useState<bigint | null>(null);
  const [hlrrBalance, setHlrrBalance] = useState<bigint | null>(null);

  const [txStatus, setTxStatus] = useState<TxStatus>({ type: "idle" });

  const isOnBase  = chainId === BASE_MAINNET_ID;
  const tokenInSym  = buyMode ? "USDC" : "HLRR";
  const tokenOutSym = buyMode ? "HLRR" : "USDC";
  const tokenInDec  = buyMode ? USDC_DECIMALS : HLRR_DECIMALS;
  const tokenOutDec = buyMode ? HLRR_DECIMALS : USDC_DECIMALS;
  const tokenInAddr  = buyMode ? USDC_ADDRESS : HLRR_ADDRESS;
  const tokenOutAddr = buyMode ? HLRR_ADDRESS : USDC_ADDRESS;
  const balanceIn   = buyMode ? usdcBalance : hlrrBalance;

  // ── Find Aerodrome CL pool ─────────────────────────────────────────────────

  const findPool = useCallback(async () => {
    const eth = getEthereum();
    if (!eth || chainId !== BASE_MAINNET_ID) return;

    try {
      const provider = new ethers.BrowserProvider(eth as any);
      const factory  = new ethers.Contract(AERODROME_CL_FACTORY, FACTORY_ABI, provider);

      for (const ts of TICK_SPACINGS) {
        const addr: string = await factory.getPool(USDC_ADDRESS, HLRR_ADDRESS, ts);
        if (addr && addr !== ethers.ZeroAddress) {
          setPoolAddress(addr);
          setTickSpacing(ts);

          const pool = new ethers.Contract(addr, POOL_ABI, provider);
          const [slot0Data, t0]: [any[], string] = await Promise.all([
            pool.slot0(),
            pool.token0(),
          ]);

          setSqrtPriceX96(BigInt(slot0Data[0].toString()));
          setToken0IsHlrr(t0.toLowerCase() === HLRR_ADDRESS.toLowerCase());
          return;
        }
      }
    } catch (err: any) {
      console.error("findPool:", err);
    }
  }, [getEthereum, chainId]);

  // ── Fetch token balances ───────────────────────────────────────────────────

  const fetchBalances = useCallback(async () => {
    if (!connectedAddress) { setUsdcBalance(null); setHlrrBalance(null); return; }
    const eth = getEthereum();
    if (!eth || chainId !== BASE_MAINNET_ID) return;
    try {
      const provider = new ethers.BrowserProvider(eth as any);
      const usdc = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, provider);
      const hlrr = new ethers.Contract(HLRR_ADDRESS, ERC20_ABI, provider);
      const [ub, hb] = await Promise.all([
        usdc.balanceOf(connectedAddress) as Promise<bigint>,
        hlrr.balanceOf(connectedAddress) as Promise<bigint>,
      ]);
      setUsdcBalance(ub);
      setHlrrBalance(hb);
    } catch (err: any) {
      console.error("fetchBalances:", err);
    }
  }, [connectedAddress, getEthereum, chainId]);

  useEffect(() => {
    if (chainId === BASE_MAINNET_ID) {
      findPool();
      fetchBalances();
    }
  }, [chainId, connectedAddress, findPool, fetchBalances]);

  // ── Estimate output via Quoter (accounts for price impact) ────────────────

  useEffect(() => {
    if (!amountIn || !parseFloat(amountIn) || !poolAddress || tickSpacing === null) {
      setEstimatedOut(null);
      setEstimatedOutRaw(null);
      setQuoteLoading(false);
      return;
    }
    const eth = getEthereum();
    if (!eth || chainId !== BASE_MAINNET_ID) return;

    setQuoteLoading(true);
    const timer = setTimeout(async () => {
      try {
        const provider = new ethers.BrowserProvider(eth as any);
        const quoter = new ethers.Contract(AERODROME_CL_QUOTER, QUOTER_ABI, provider);
        const amountInRaw = ethers.parseUnits(amountIn, tokenInDec);
        const [amountOut] = await quoter.quoteExactInputSingle.staticCall({
          tokenIn:           tokenInAddr,
          tokenOut:          tokenOutAddr,
          amountIn:          amountInRaw,
          tickSpacing,
          sqrtPriceLimitX96: BigInt(0),
        });
        const outRaw = BigInt(amountOut.toString());
        setEstimatedOutRaw(outRaw);
        setEstimatedOut(fmtBalance(outRaw, tokenOutDec, 6));
      } catch (err) {
        // Fallback: spot-price estimate (no price impact, shown with warning)
        console.warn("Quoter unavailable, using spot estimate:", err);
        if (sqrtPriceX96 !== null && token0IsHlrr !== null) {
          try {
            const amountInRaw = ethers.parseUnits(amountIn, tokenInDec);
            const tokenInIsToken0 = buyMode ? !token0IsHlrr : token0IsHlrr;
            const outRaw = estimateOut(amountInRaw, sqrtPriceX96, tokenInIsToken0);
            setEstimatedOutRaw(outRaw);
            setEstimatedOut(fmtBalance(outRaw, tokenOutDec, 6));
          } catch {
            setEstimatedOut(null);
            setEstimatedOutRaw(null);
          }
        } else {
          setEstimatedOut(null);
          setEstimatedOutRaw(null);
        }
      } finally {
        setQuoteLoading(false);
      }
    }, 500);

    return () => { clearTimeout(timer); setQuoteLoading(false); };
  }, [amountIn, poolAddress, tickSpacing, tokenInAddr, tokenOutAddr, tokenInDec, tokenOutDec, buyMode, sqrtPriceX96, token0IsHlrr, getEthereum, chainId]);

  // ── Connect / network helpers ──────────────────────────────────────────────

  const handleConnect = useCallback(async () => {
    setTxStatus({ type: "idle" });
    try {
      await connectWallet();
    } catch (err: any) {
      setTxStatus({ type: "error", msg: err.message ?? "Failed to connect wallet" });
    }
  }, [connectWallet]);

  const handleSwitchToBase = useCallback(async () => {
    try {
      await switchNetwork(BASE_MAINNET_ID);
    } catch (err: any) {
      if (err?.code === 4902) {
        const eth = getEthereum();
        if (!eth) return;
        await eth.request({
          method: "wallet_addEthereumChain",
          params: [{ chainId: "0x2105", ...BASE_META }],
        });
      }
    }
  }, [switchNetwork, getEthereum]);

  // ── Swap ──────────────────────────────────────────────────────────────────

  const handleSwap = useCallback(async () => {
    if (!connectedAddress || !poolAddress || tickSpacing === null || !amountIn || !parseFloat(amountIn)) return;
    const eth = getEthereum();
    if (!eth) return;

    setTxStatus({ type: "pending", msg: "Preparing swap…" });

    try {
      const provider    = new ethers.BrowserProvider(eth as any);
      const signer      = await provider.getSigner();
      const amountInRaw = ethers.parseUnits(amountIn, tokenInDec);

      // Check & set allowance
      const erc20     = new ethers.Contract(tokenInAddr, ERC20_ABI, signer);
      const allowance: bigint = await erc20.allowance(connectedAddress, AERODROME_CL_ROUTER);
      if (allowance < amountInRaw) {
        setTxStatus({ type: "pending", msg: `Approving ${tokenInSym}…` });
        const tx = await erc20.approve(AERODROME_CL_ROUTER, ethers.MaxUint256);
        await tx.wait();
      }

      // Re-quote live at swap time so amountOutMin reflects current tick state,
      // not a potentially stale estimate from the UI (prevents silent revert when
      // the swap amount crosses a tick boundary since the last quote).
      setTxStatus({ type: "pending", msg: "Fetching live quote…" });
      let liveOutRaw: bigint | null = null;
      try {
        const quoter = new ethers.Contract(AERODROME_CL_QUOTER, QUOTER_ABI, provider);
        const [amountOut] = await quoter.quoteExactInputSingle.staticCall({
          tokenIn:           tokenInAddr,
          tokenOut:          tokenOutAddr,
          amountIn:          amountInRaw,
          tickSpacing,
          sqrtPriceLimitX96: BigInt(0),
        });
        liveOutRaw = BigInt(amountOut.toString());
      } catch {
        // Quoter unavailable — fall back to cached UI estimate
        liveOutRaw = estimatedOutRaw;
      }

      // Compute minimum output using live quote (avoids re-parsing precision loss)
      let amountOutMin = BigInt(0);
      const baseOutRaw = liveOutRaw ?? estimatedOutRaw;
      if (baseOutRaw !== null && baseOutRaw > BigInt(0)) {
        const slippageBps = Math.round(parseFloat(slippage) * 100);
        amountOutMin = (baseOutRaw * BigInt(10000 - slippageBps)) / BigInt(10000);
      }

      setTxStatus({ type: "pending", msg: "Waiting for wallet confirmation…" });

      const router   = new ethers.Contract(AERODROME_CL_ROUTER, ROUTER_ABI, signer);
      const deadline = Math.floor(Date.now() / 1000) + 1200; // 20 min

      const tx = await router.exactInputSingle({
        tokenIn:            tokenInAddr,
        tokenOut:           tokenOutAddr,
        tickSpacing,
        recipient:          connectedAddress,
        deadline,
        amountIn:           amountInRaw,
        amountOutMinimum:   amountOutMin,
        sqrtPriceLimitX96:  BigInt(0),
      });

      // Show tx hash immediately — visible on Basescan even before confirmation
      setTxStatus({ type: "pending", msg: "Waiting for confirmation…", hash: tx.hash });

      // Race tx.wait() against a 90s timeout so we never hang indefinitely
      const WAIT_TIMEOUT = 90_000;
      let receipt: any;
      try {
        receipt = await Promise.race([
          tx.wait(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("__timeout__")), WAIT_TIMEOUT)
          ),
        ]);
      } catch (waitErr: any) {
        if (waitErr?.message === "__timeout__") {
          // Tx was submitted; we just couldn't confirm it in time.
          // Treat as success so user can check Basescan and we refresh state.
          setTxStatus({
            type: "success",
            msg: "Swap submitted — confirmation is taking longer than usual. Check Basescan for status.",
            hash: tx.hash,
          });
          setAmountIn("");
          setEstimatedOut(null);
          setTimeout(fetchBalances, 5000);
          return;
        }
        throw waitErr; // real on-chain revert or network error
      }

      setTxStatus({
        type: "success",
        msg:  `Swapped ${amountIn} ${tokenInSym} → ${estimatedOut ?? "?"} ${tokenOutSym}`,
        hash: receipt.hash,
      });

      setAmountIn("");
      setEstimatedOut(null);
      await fetchBalances();
      await findPool(); // refresh price
    } catch (err: any) {
      let msg: string;
      if (err?.code === "CALL_EXCEPTION" && err?.action === "estimateGas") {
        msg = "Swap would fail on-chain — the price likely moved beyond your slippage tolerance. Try increasing slippage % and swap again.";
      } else {
        msg = err?.reason ?? err?.data?.message ?? err?.message ?? "Transaction failed";
      }
      setTxStatus({ type: "error", msg });
    }
  }, [
    connectedAddress, poolAddress, tickSpacing, amountIn, tokenInAddr, tokenOutAddr,
    tokenInDec, tokenOutDec, tokenInSym, tokenOutSym, estimatedOut, estimatedOutRaw, slippage,
    getEthereum, fetchBalances, findPool,
  ]);

  // ── Computed display values ────────────────────────────────────────────────

  const spotPrice = sqrtPriceX96 !== null && token0IsHlrr !== null
    ? spotPriceUsdcPerHlrr(sqrtPriceX96, token0IsHlrr)
    : null;

  const balanceInsufficient =
    balanceIn !== null &&
    amountIn &&
    parseFloat(amountIn) > 0 &&
    (() => {
      try { return ethers.parseUnits(amountIn, tokenInDec) > balanceIn; }
      catch { return false; }
    })();

  const canSwap =
    !!connectedAddress &&
    isOnBase &&
    !!poolAddress &&
    !!amountIn &&
    parseFloat(amountIn) > 0 &&
    !balanceInsufficient &&
    !quoteLoading &&
    txStatus.type !== "pending";

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <main style={{ maxWidth: "480px", width: "100%", margin: "0 auto", padding: "2rem 1rem", flexDirection: "column", alignItems: "stretch" }}>
      {/* Header */}
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.6rem", fontWeight: 700, color: "var(--accent)", marginBottom: "0.25rem" }}>
          nSwap©
        </h1>
        <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
          Swap USDC ↔ HLRR via the Aerodrome CL pool on Base
        </p>
      </div>

      {/* Wallet bar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "rgba(34,211,238,0.06)", border: "1px solid rgba(34,211,238,0.2)",
        borderRadius: "10px", padding: "0.75rem 1rem", marginBottom: "1.25rem",
      }}>
        {connectedAddress ? (
          <>
            <span style={{ color: "var(--text)", fontSize: "0.9rem" }}>
              {truncateAddr(connectedAddress)}
              {chainId && (
                <span style={{ color: "var(--muted)", marginLeft: "0.5rem", fontSize: "0.8rem" }}>
                  {isOnBase ? "Base" : `chain ${chainId}`}
                </span>
              )}
            </span>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                onClick={switchAccount}
                style={btnStyle("ghost")}
              >
                Switch
              </button>
              <button
                onClick={() => { disconnectWallet(); setUsdcBalance(null); setHlrrBalance(null); }}
                style={btnStyle("ghost")}
              >
                Disconnect
              </button>
            </div>
          </>
        ) : (
          <>
            <span style={{ color: "var(--muted)", fontSize: "0.9rem" }}>No wallet connected</span>
            <button onClick={handleConnect} style={btnStyle("primary")}>
              Connect Wallet
            </button>
          </>
        )}
      </div>

      {/* Wrong network warning */}
      {connectedAddress && !isOnBase && (
        <div style={{
          background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.4)",
          borderRadius: "8px", padding: "0.75rem 1rem", marginBottom: "1.25rem",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span style={{ color: "#fbbf24", fontSize: "0.9rem" }}>nSwap requires Base mainnet</span>
          <button onClick={handleSwitchToBase} style={btnStyle("warning")}>
            Switch to Base
          </button>
        </div>
      )}

      {/* Swap card */}
      <div style={{
        background: "rgba(15,23,42,0.8)", border: "1px solid rgba(34,211,238,0.25)",
        borderRadius: "16px", padding: "1.5rem",
      }}>
        {/* Spot price */}
        {spotPrice !== null && (
          <div style={{ textAlign: "center", marginBottom: "1.25rem", color: "var(--muted)", fontSize: "0.85rem" }}>
            Pool price: 1 HLRR = {spotPrice < 0.0001 ? spotPrice.toExponential(4) : spotPrice.toFixed(6)} USDC
            {tickSpacing !== null && (
              <span style={{ marginLeft: "0.5rem", opacity: 0.7 }}>(tick spacing {tickSpacing})</span>
            )}
          </div>
        )}
        {isOnBase && !poolAddress && connectedAddress && (
          <div style={{ textAlign: "center", marginBottom: "1.25rem", color: "var(--muted)", fontSize: "0.85rem" }}>
            Searching for USDC/HLRR pool…
          </div>
        )}
        {isOnBase && !poolAddress && !connectedAddress && (
          <div style={{ textAlign: "center", marginBottom: "1.25rem", color: "var(--muted)", fontSize: "0.85rem" }}>
            Connect wallet to load pool
          </div>
        )}

        {/* Token In */}
        <div style={tokenBoxStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
            <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>Sell</span>
            {balanceIn !== null && (
              <button
                onClick={() => setAmountIn(fmtBalance(balanceIn, tokenInDec, 6))}
                style={{ background: "none", border: "none", color: "var(--accent)", fontSize: "0.8rem", cursor: "pointer", padding: 0 }}
              >
                Balance: {fmtBalance(balanceIn, tokenInDec, 4)} {tokenInSym}
              </button>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div style={tokenBadge}>{tokenInSym}</div>
            <input
              type="number"
              min="0"
              step="any"
              placeholder="0.00"
              value={amountIn}
              onChange={(e) => setAmountIn(e.target.value)}
              style={inputStyle}
            />
          </div>
          {balanceInsufficient && (
            <div style={{ color: "#f87171", fontSize: "0.78rem", marginTop: "0.4rem" }}>
              Insufficient {tokenInSym} balance
            </div>
          )}
        </div>

        {/* Arrow / flip button */}
        <div style={{ display: "flex", justifyContent: "center", margin: "0.75rem 0" }}>
          <button
            onClick={() => { setBuyMode((m) => !m); setAmountIn(""); setEstimatedOut(null); setEstimatedOutRaw(null); }}
            title="Flip swap direction"
            style={{
              background: "rgba(34,211,238,0.1)", border: "1px solid rgba(34,211,238,0.3)",
              borderRadius: "50%", width: "36px", height: "36px", display: "flex",
              alignItems: "center", justifyContent: "center", cursor: "pointer",
              color: "var(--accent)", fontSize: "1.1rem", transition: "background 0.2s",
            }}
            onMouseOver={(e) => (e.currentTarget.style.background = "rgba(34,211,238,0.2)")}
            onMouseOut={(e)  => (e.currentTarget.style.background = "rgba(34,211,238,0.1)")}
          >
            ↕
          </button>
        </div>

        {/* Token Out */}
        <div style={{ ...tokenBoxStyle, opacity: 0.85 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
            <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>Receive (estimated)</span>
            {(buyMode ? hlrrBalance : usdcBalance) !== null && (
              <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>
                Balance: {fmtBalance((buyMode ? hlrrBalance : usdcBalance)!, tokenOutDec, 4)} {tokenOutSym}
              </span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div style={tokenBadge}>{tokenOutSym}</div>
            <div style={{ ...inputStyle, color: estimatedOut ? "var(--text)" : "var(--muted)", cursor: "default" }}>
              {quoteLoading ? "…" : (estimatedOut ?? "—")}
            </div>
          </div>
        </div>

        {/* Slippage */}
        <div style={{ marginTop: "1rem", display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
          <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>Slippage:</span>
          {["0.5", "1", "2"].map((s) => (
            <button
              key={s}
              onClick={() => setSlippage(s)}
              style={{
                padding: "0.25rem 0.6rem", borderRadius: "6px", fontSize: "0.8rem", cursor: "pointer",
                border: slippage === s ? "1px solid var(--accent)" : "1px solid rgba(34,211,238,0.2)",
                background: slippage === s ? "rgba(34,211,238,0.15)" : "transparent",
                color: slippage === s ? "var(--accent)" : "var(--muted)",
              }}
            >
              {s}%
            </button>
          ))}
        </div>

        {/* Swap button */}
        <button
          onClick={handleSwap}
          disabled={!canSwap}
          style={{
            marginTop: "1.25rem", width: "100%", padding: "0.875rem",
            borderRadius: "10px", fontSize: "1rem", fontWeight: 700,
            cursor: canSwap ? "pointer" : "not-allowed",
            background: canSwap ? "var(--accent)" : "rgba(34,211,238,0.15)",
            color: canSwap ? "#0f172a" : "var(--muted)",
            border: "none", transition: "opacity 0.2s",
          }}
        >
          {!isOnBase && connectedAddress
            ? "Switch to Base"
            : balanceInsufficient
            ? `Insufficient ${tokenInSym}`
            : txStatus.type === "pending"
            ? "Processing…"
            : quoteLoading
            ? "Getting quote…"
            : buyMode
            ? "Buy HLRR"
            : "Sell HLRR"}
        </button>

        {/* TX Status */}
        {txStatus.type !== "idle" && (
          <div style={{
            marginTop: "1rem", padding: "0.75rem 1rem", borderRadius: "8px", fontSize: "0.875rem",
            background: txStatus.type === "success"
              ? "rgba(34,197,94,0.12)"
              : txStatus.type === "error"
              ? "rgba(239,68,68,0.12)"
              : "rgba(34,211,238,0.08)",
            border: `1px solid ${txStatus.type === "success" ? "rgba(34,197,94,0.4)" : txStatus.type === "error" ? "rgba(239,68,68,0.4)" : "rgba(34,211,238,0.2)"}`,
            color: txStatus.type === "success" ? "#4ade80" : txStatus.type === "error" ? "#f87171" : "var(--accent)",
          }}>
            {txStatus.msg}
            {(txStatus.type === "success" || txStatus.type === "pending") && (txStatus as any).hash && (
              <a
                href={`https://basescan.org/tx/${(txStatus as any).hash}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: "block", marginTop: "0.25rem", color: "var(--accent)", fontSize: "0.8rem" }}
              >
                View on Basescan ↗
              </a>
            )}
            {txStatus.type !== "pending" && (
              <button
                onClick={() => setTxStatus({ type: "idle" })}
                style={{ display: "block", marginTop: "0.4rem", background: "none", border: "none", color: "var(--muted)", fontSize: "0.8rem", cursor: "pointer", padding: 0 }}
              >
                Dismiss
              </button>
            )}
          </div>
        )}
      </div>

      {/* Pool info */}
      {poolAddress && (
        <div style={{ marginTop: "1rem", color: "var(--muted)", fontSize: "0.78rem", textAlign: "center" }}>
          Pool:{" "}
          <a
            href={`https://basescan.org/address/${poolAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--accent)" }}
          >
            {truncateAddr(poolAddress)}
          </a>
          {" · "}
          <a
            href={`https://aerodrome.finance/swap?from=${USDC_ADDRESS}&to=${HLRR_ADDRESS}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--accent)" }}
          >
            Aerodrome ↗
          </a>
        </div>
      )}

      {/* Wallet picker modal */}
      {showWalletPicker && (
        <WalletPickerModal
          wallets={discoveredWallets}
          onSelect={async (detail: EIP6963ProviderDetail) => {
            try {
              await connectWithProvider(detail);
            } catch (err: any) {
              setTxStatus({ type: "error", msg: err.message ?? "Wallet connection failed" });
            }
          }}
          onClose={() => setShowWalletPicker(false)}
        />
      )}
    </main>
  );
}

// ─── Micro style helpers ───────────────────────────────────────────────────────

const tokenBoxStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(34,211,238,0.15)",
  borderRadius: "10px",
  padding: "0.875rem 1rem",
};

const tokenBadge: React.CSSProperties = {
  flexShrink: 0,
  background: "rgba(34,211,238,0.12)",
  border: "1px solid rgba(34,211,238,0.25)",
  borderRadius: "8px",
  padding: "0.4rem 0.7rem",
  fontWeight: 700,
  fontSize: "0.9rem",
  color: "var(--accent)",
  minWidth: "60px",
  textAlign: "center",
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  background: "transparent",
  border: "none",
  outline: "none",
  color: "var(--text)",
  fontSize: "1.25rem",
  fontWeight: 600,
  width: "100%",
  padding: "0.25rem 0",
};

function btnStyle(variant: "primary" | "ghost" | "warning"): React.CSSProperties {
  const base: React.CSSProperties = {
    border: "1px solid", borderRadius: "6px", cursor: "pointer",
    fontSize: "0.82rem", fontWeight: 600, padding: "0.3rem 0.75rem",
    transition: "opacity 0.2s",
  };
  if (variant === "primary") {
    return { ...base, background: "var(--accent)", color: "#0f172a", borderColor: "var(--accent)" };
  }
  if (variant === "warning") {
    return { ...base, background: "transparent", color: "#fbbf24", borderColor: "#fbbf24" };
  }
  return { ...base, background: "transparent", color: "var(--muted)", borderColor: "rgba(34,211,238,0.2)" };
}
