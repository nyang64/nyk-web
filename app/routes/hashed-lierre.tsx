import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { useWallet } from "../hooks/useWallet";
import type { Route } from "./+types/hashed-lierre";

const HLRR_TOKEN_ADDRESS = import.meta.env.VITE_HLRR_TOKEN_ADDRESS as string;
const TREASURY_ADDRESS = import.meta.env.VITE_TREASURY_ADDRESS;
const BASE_MAINNET_ID = 8453;

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Hashed Lierre Token (HLRR) - NYK Labs" },
    { name: "description", content: "Hashed Lierre Token (HLRR) is a blockchain utility token by NYK Labs. Explore tokenomics, distribution model, smart contract details, and ecosystem use cases." },
  ];
}

// ─── ABI ──────────────────────────────────────────────────────────────────────

const HLRR_ABI = [
  "function balanceOf(address) external view returns (uint256)",
  "function getUserStats(address user) external view returns (uint256 stakedAmount, uint256 pendingRewards, uint256 stakingDuration, uint256 estimatedYearlyReward, bool canUnstake)",
  "function getTimeUntilUnstake(address user) external view returns (uint256)",
  "function apr() external view returns (uint256)",
  "function stake(uint256 amount) external",
  "function claimReward() external",
  "function unstake(uint256 amount) external",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtHlrr(n: bigint, decimals = 4): string {
  const divisor = 100_000_000n;
  const whole = n / divisor;
  const frac = n % divisor;
  const fracStr = frac.toString().padStart(8, "0").slice(0, decimals).replace(/0+$/, "");
  return fracStr ? `${whole.toLocaleString()}.${fracStr}` : whole.toLocaleString();
}

function fmtLockStatus(seconds: bigint): string {
  if (seconds <= 0n) return "Unlocked";
  const days = seconds / 86400n;
  const hours = (seconds % 86400n) / 3600n;
  if (days > 0n) return `Locked — ${days}d ${hours}h remaining`;
  const mins = (seconds % 3600n) / 60n;
  return `Locked — ${hours}h ${mins}m remaining`;
}

function truncateAddr(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface StakingInfo {
  walletBalance: bigint;
  stakedAmount: bigint;
  pendingRewards: bigint;
  estimatedYearlyReward: bigint;
  canUnstake: boolean;
  timeUntilUnstake: bigint;
  currentApr: bigint;
}

type TxStatus = { type: "idle" } | { type: "pending"; msg: string } | { type: "success"; msg: string } | { type: "error"; msg: string };

// ─── Component ────────────────────────────────────────────────────────────────

export default function HashedLierre() {
  const {
    connectedAddress, chainId, discoveredWallets, showWalletPicker,
    setShowWalletPicker, getEthereum, connectWallet, connectWithProvider,
    switchAccount, disconnectWallet, switchNetwork,
  } = useWallet();

  const [stakingInfo, setStakingInfo] = useState<StakingInfo | null>(null);
  const [infoLoading, setInfoLoading] = useState(false);
  const [stakeInput, setStakeInput] = useState("");
  const [unstakeInput, setUnstakeInput] = useState("");
  const [stakeTx, setStakeTx] = useState<TxStatus>({ type: "idle" });
  const [unstakeTx, setUnstakeTx] = useState<TxStatus>({ type: "idle" });

  const onBase = chainId === BASE_MAINNET_ID;

  // ── Load staking info ──────────────────────────────────────────────────────
  const loadStakingInfo = useCallback(async () => {
    if (!connectedAddress || !onBase) { setStakingInfo(null); return; }
    const ethereum = getEthereum();
    if (!ethereum) return;
    setInfoLoading(true);
    try {
      const provider = new ethers.BrowserProvider(ethereum as ethers.Eip1193Provider);
      const contract = new ethers.Contract(HLRR_TOKEN_ADDRESS, HLRR_ABI, provider);
      const [balance, stats, timeLeft, aprVal] = await Promise.all([
        contract.balanceOf(connectedAddress) as Promise<bigint>,
        contract.getUserStats(connectedAddress) as Promise<[bigint, bigint, bigint, bigint, boolean]>,
        contract.getTimeUntilUnstake(connectedAddress) as Promise<bigint>,
        contract.apr() as Promise<bigint>,
      ]);
      setStakingInfo({
        walletBalance: balance,
        stakedAmount: stats[0],
        pendingRewards: stats[1],
        estimatedYearlyReward: stats[3],
        canUnstake: stats[4],
        timeUntilUnstake: timeLeft,
        currentApr: aprVal,
      });
    } catch (e) {
      console.error("loadStakingInfo:", e);
    } finally {
      setInfoLoading(false);
    }
  }, [connectedAddress, onBase, getEthereum]);

  useEffect(() => { loadStakingInfo(); }, [loadStakingInfo]);

  const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

  // ── Stake ──────────────────────────────────────────────────────────────────
  const handleStake = async () => {
    if (!stakeInput || !connectedAddress) return;
    const ethereum = getEthereum();
    if (!ethereum) return;
    try {
      setStakeTx({ type: "pending", msg: "Confirm in wallet…" });
      const provider = new ethers.BrowserProvider(ethereum as ethers.Eip1193Provider);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(HLRR_TOKEN_ADDRESS, HLRR_ABI, signer);
      const amount = ethers.parseUnits(stakeInput.trim(), 8);
      const tx = await contract.stake(amount);
      setStakeTx({ type: "pending", msg: "Waiting for confirmation…" });
      await tx.wait();
      setStakeTx({ type: "success", msg: `Staked ${stakeInput} HLRR successfully!` });
      setStakeInput("");
      await delay(1500);
      await loadStakingInfo();
    } catch (e: unknown) {
      const err = e as { reason?: string; message?: string };
      setStakeTx({ type: "error", msg: err?.reason || err?.message || "Transaction failed" });
    }
  };

  // ── Unstake Partial ───────────────────────────────────────────────────────
  const handleUnstakePartial = async () => {
    if (!unstakeInput || !connectedAddress || !stakingInfo) return;
    const ethereum = getEthereum();
    if (!ethereum) return;
    try {
      const amount = ethers.parseUnits(unstakeInput.trim(), 8);
      if (amount <= 0n || amount > stakingInfo.stakedAmount) {
        setUnstakeTx({ type: "error", msg: `Amount must be between 0 and ${fmtHlrr(stakingInfo.stakedAmount)} HLRR (your staked balance)` });
        return;
      }
      setUnstakeTx({ type: "pending", msg: "Confirm in wallet…" });
      const provider = new ethers.BrowserProvider(ethereum as ethers.Eip1193Provider);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(HLRR_TOKEN_ADDRESS, HLRR_ABI, signer);
      const tx = await contract.unstake(amount);
      setUnstakeTx({ type: "pending", msg: "Waiting for confirmation…" });
      await tx.wait();
      setUnstakeTx({ type: "success", msg: `Unstaked ${unstakeInput} HLRR to your wallet.` });
      setUnstakeInput("");
      await delay(1500);
      await loadStakingInfo();
    } catch (e: unknown) {
      const err = e as { reason?: string; message?: string };
      setUnstakeTx({ type: "error", msg: err?.reason || err?.message || "Transaction failed" });
    }
  };

  // ── Unstake All ────────────────────────────────────────────────────────────
  const handleUnstakeAll = async () => {
    if (!connectedAddress || !stakingInfo || stakingInfo.stakedAmount === 0n) return;
    const ethereum = getEthereum();
    if (!ethereum) return;
    try {
      const provider = new ethers.BrowserProvider(ethereum as ethers.Eip1193Provider);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(HLRR_TOKEN_ADDRESS, HLRR_ABI, signer);

      let finalStaked = stakingInfo.stakedAmount;

      // Step 1: compound pending rewards if any
      if (stakingInfo.pendingRewards > 0n) {
        setUnstakeTx({ type: "pending", msg: "Step 1/2 — Compounding rewards, confirm in wallet…" });
        const claimTx = await contract.claimReward();
        await claimTx.wait();
        // Re-read so we unstake the compounded total
        const stats = await contract.getUserStats(connectedAddress) as [bigint, bigint, bigint, bigint, boolean];
        finalStaked = stats[0];
      }

      // Step 2: unstake
      const steps = stakingInfo.pendingRewards > 0n ? "Step 2/2 — " : "";
      setUnstakeTx({ type: "pending", msg: `${steps}Unstaking ${fmtHlrr(finalStaked)} HLRR, confirm in wallet…` });
      const unstakeTxRes = await contract.unstake(finalStaked);
      await unstakeTxRes.wait();
      setUnstakeTx({ type: "success", msg: `Successfully returned ${fmtHlrr(finalStaked)} HLRR to your wallet!` });
      await delay(1500);
      await loadStakingInfo();
    } catch (e: unknown) {
      const err = e as { reason?: string; message?: string };
      setUnstakeTx({ type: "error", msg: err?.reason || err?.message || "Transaction failed" });
    }
  };

  const totalIfUnstaked = stakingInfo
    ? stakingInfo.stakedAmount + stakingInfo.pendingRewards
    : 0n;

  return (
    <main>
      <section className="card">
        <h2 className="hlrr-title">
          <img src="/HLRR.svg" alt="HLRR Logo" className="hlrr-logo" />
          Hashed Lierre Token (HLRR)
        </h2>

        <div className="intro">
          <img src="/HLRR.svg" alt="HLRR Logo" className="hlrr-logo-large" />
          <p>
            Hashed Lierre (HLRR) is a utility and access token that powers the NYK Labs platform.
            It is used to unlock features, access developer tools and services, participate in ecosystem programs,
            and coordinate activity across applications built by NYK Labs. The token is not intended to be a
            security or financial instrument and does not represent ownership, equity, or any claim on the
            assets, profits, or operations of NYK Labs.
          </p>
        </div>

        <div className="address-section">
          <h3>Token Contract Addresses</h3>
          <div className="address-grid">
            <div className="address-card">
              <span className="address-label">Token Address (BASE Network):</span>
              <code className="address-value">{HLRR_TOKEN_ADDRESS}</code>
            </div>
            <div className="address-card">
              <span className="address-label">Treasury Address:</span>
              <code className="address-value">{TREASURY_ADDRESS}</code>
            </div>
          </div>
        </div>

        <h3>Smart Contract</h3>
        <div className="contract-section">
          <div className="verified-badge">
            <span className="verified-icon">✓</span>
            <span>Source Verified &amp; Published on Sourcify</span>
          </div>
          <a
            href="https://solidityscan.com/quickscan/0x5e1583d48bcfd60de77138ea195f3efbe128405d/blockscout/base?ref=blockscout"
            target="_blank"
            rel="noopener noreferrer"
            className="security-score-badge"
          >
            <span className="security-score-label">Security Score</span>
            <span className="security-score-value">89.7%</span>
            <span className="security-score-source">SolidityScan via Blockscout</span>
          </a>

          <div className="explorer-links">
            <a href="https://repo.sourcify.dev/8453/0x5E1583d48bcFd60de77138ea195f3EFbe128405d" target="_blank" rel="noopener noreferrer" className="explorer-link">
              <span className="explorer-link-label">Sourcify</span>
              <span className="explorer-link-desc">Verified source code</span>
            </a>
            <a href="https://base.blockscout.com/address/0x5E1583d48bcFd60de77138ea195f3EFbe128405d?tab=contract" target="_blank" rel="noopener noreferrer" className="explorer-link">
              <span className="explorer-link-label">Blockscout</span>
              <span className="explorer-link-desc">Contract &amp; ABI</span>
            </a>
            <a href="https://basescan.org/address/0x5E1583d48bcFd60de77138ea195f3EFbe128405d" target="_blank" rel="noopener noreferrer" className="explorer-link">
              <span className="explorer-link-label">Basescan</span>
              <span className="explorer-link-desc">Transactions &amp; holders</span>
            </a>
          </div>
        </div>

        {/* ── STAKING PANEL ─────────────────────────────────────────────── */}
        <h3>HLRR Staking</h3>

        {/* Wallet bar */}
        <div className="stk-wallet-bar">
          {!connectedAddress ? (
            <button className="stk-btn-primary" onClick={async () => {
              try { await connectWallet(); } catch (e: unknown) {
                const err = e as { message?: string };
                console.error(err?.message);
              }
            }}>
              Connect Wallet (Base Mainnet)
            </button>
          ) : (
            <div className="stk-wallet-connected">
              <div className="stk-wallet-info">
                <span className="stk-addr">{truncateAddr(connectedAddress)}</span>
                <span className={`stk-network ${onBase ? "ok" : "bad"}`}>
                  {onBase ? "Base Mainnet" : `Wrong network (id ${chainId})`}
                </span>
              </div>
              <div className="stk-wallet-actions">
                {!onBase && (
                  <button className="stk-btn-warn" onClick={() => switchNetwork(BASE_MAINNET_ID).catch(() => {})}>
                    Switch to Base
                  </button>
                )}
                <button className="stk-btn-ghost" onClick={switchAccount}>Switch Account</button>
                <button className="stk-btn-ghost" onClick={disconnectWallet}>Disconnect</button>
              </div>
            </div>
          )}
        </div>

        {/* Wallet picker */}
        {showWalletPicker && (
          <div className="stk-wallet-picker">
            <p className="stk-picker-title">Choose wallet</p>
            {discoveredWallets.map((w) => (
              <button key={w.info.uuid} className="stk-picker-btn" onClick={() => connectWithProvider(w)}>
                {w.info.icon && <img src={w.info.icon} alt="" className="stk-wallet-icon" />}
                {w.info.name}
              </button>
            ))}
            <button className="stk-btn-ghost" style={{ marginTop: "0.5rem" }} onClick={() => setShowWalletPicker(false)}>Cancel</button>
          </div>
        )}

        {/* Staking UI — only when connected to Base */}
        {connectedAddress && onBase && (
          <div className="stk-panel">

            {/* Position card */}
            <div className="stk-position-card">
              <div className="stk-position-title">Your Position</div>
              {infoLoading ? (
                <div className="stk-loading">Loading…</div>
              ) : stakingInfo ? (
                <div className="stk-stats-grid">
                  <div className="stk-stat">
                    <span className="stk-stat-label">Wallet balance</span>
                    <span className="stk-stat-value">{fmtHlrr(stakingInfo.walletBalance)} HLRR</span>
                  </div>
                  <div className="stk-stat">
                    <span className="stk-stat-label">Staked balance</span>
                    <span className="stk-stat-value">{fmtHlrr(stakingInfo.stakedAmount)} HLRR</span>
                  </div>
                  <div className="stk-stat">
                    <span className="stk-stat-label">Accrued rewards</span>
                    <span className="stk-stat-value accent">{fmtHlrr(stakingInfo.pendingRewards)} HLRR</span>
                  </div>
                  <div className="stk-stat">
                    <span className="stk-stat-label">Total if unstaked now</span>
                    <span className="stk-stat-value highlight">{fmtHlrr(totalIfUnstaked)} HLRR</span>
                  </div>
                  <div className="stk-stat">
                    <span className="stk-stat-label">Lock status</span>
                    <span className={`stk-stat-value ${stakingInfo.canUnstake ? "ok" : "warn"}`}>
                      {fmtLockStatus(stakingInfo.timeUntilUnstake)}
                    </span>
                  </div>
                  <div className="stk-stat">
                    <span className="stk-stat-label">Current APR</span>
                    <span className="stk-stat-value">{(Number(stakingInfo.currentApr) / 100).toFixed(0)}%</span>
                  </div>
                  <div className="stk-stat">
                    <span className="stk-stat-label">Est. yearly reward</span>
                    <span className="stk-stat-value">{fmtHlrr(stakingInfo.estimatedYearlyReward)} HLRR</span>
                  </div>
                </div>
              ) : (
                <div className="stk-loading">No position data</div>
              )}
              <button className="stk-refresh-btn" onClick={loadStakingInfo} disabled={infoLoading}>
                {infoLoading ? "Refreshing…" : "Refresh"}
              </button>
            </div>

            {/* Stake section */}
            <div className="stk-action-card">
              <div className="stk-action-title">Stake HLRR</div>
              <p className="stk-action-note">Minimum 100 HLRR. 14-day lock from first stake.</p>
              <div className="stk-input-row">
                <input
                  type="number"
                  className="stk-input"
                  placeholder="Amount (e.g. 1000)"
                  value={stakeInput}
                  min="100"
                  step="any"
                  onChange={(e) => { setStakeInput(e.target.value); setStakeTx({ type: "idle" }); }}
                />
                {stakingInfo && (
                  <button className="stk-btn-max" onClick={() => {
                    setStakeInput(fmtHlrr(stakingInfo.walletBalance, 8).replace(/,/g, ""));
                    setStakeTx({ type: "idle" });
                  }}>Max</button>
                )}
              </div>
              <button
                className="stk-btn-primary"
                disabled={!stakeInput || stakeTx.type === "pending"}
                onClick={handleStake}
              >
                {stakeTx.type === "pending" ? "Staking…" : "Stake HLRR"}
              </button>
              {stakeTx.type !== "idle" && (
                <div className={`stk-status ${stakeTx.type}`}>{stakeTx.msg}</div>
              )}
            </div>

            {/* Unstake section */}
            <div className="stk-action-card">
              <div className="stk-action-title">Unstake</div>

              {stakingInfo && !stakingInfo.canUnstake && stakingInfo.stakedAmount > 0n && (
                <div className="stk-status warn" style={{ marginBottom: "0.5rem" }}>
                  {fmtLockStatus(stakingInfo.timeUntilUnstake)} — unstake available after 14 days from first stake.
                </div>
              )}

              {/* Partial unstake */}
              <div className="stk-unstake-sub">
                <p className="stk-action-note">
                  Partial — enter an amount up to your staked balance ({stakingInfo ? fmtHlrr(stakingInfo.stakedAmount) : "—"} HLRR).
                  Accrued rewards continue on remaining stake.
                </p>
                <div className="stk-input-row">
                  <input
                    type="number"
                    className="stk-input"
                    placeholder="Amount to unstake"
                    value={unstakeInput}
                    min="0"
                    step="any"
                    onChange={(e) => { setUnstakeInput(e.target.value); setUnstakeTx({ type: "idle" }); }}
                  />
                  {stakingInfo && (
                    <button className="stk-btn-max" onClick={() => {
                      setUnstakeInput(fmtHlrr(stakingInfo.stakedAmount, 8).replace(/,/g, ""));
                      setUnstakeTx({ type: "idle" });
                    }}>Max</button>
                  )}
                </div>
                <button
                  className="stk-btn-danger"
                  disabled={!unstakeInput || !stakingInfo?.canUnstake || unstakeTx.type === "pending"}
                  onClick={handleUnstakePartial}
                >
                  {unstakeTx.type === "pending" ? "Processing…" : "Unstake Amount"}
                </button>
              </div>

              <div className="stk-divider">— or —</div>

              {/* Unstake all */}
              <div className="stk-unstake-sub">
                <p className="stk-action-note">
                  Unstake all — compounds all accrued rewards then returns full balance to wallet.
                  {stakingInfo && stakingInfo.pendingRewards > 0n && " Requires 2 wallet confirmations."}
                </p>
                {stakingInfo && totalIfUnstaked > 0n && (
                  <div className="stk-unstake-summary">
                    You will receive <strong>{fmtHlrr(totalIfUnstaked)} HLRR</strong>
                    {stakingInfo.pendingRewards > 0n && (
                      <span className="stk-reward-breakdown">
                        &nbsp;({fmtHlrr(stakingInfo.stakedAmount)} staked + {fmtHlrr(stakingInfo.pendingRewards)} rewards)
                      </span>
                    )}
                  </div>
                )}
                <button
                  className="stk-btn-danger"
                  disabled={
                    !stakingInfo ||
                    stakingInfo.stakedAmount === 0n ||
                    !stakingInfo.canUnstake ||
                    unstakeTx.type === "pending"
                  }
                  onClick={handleUnstakeAll}
                >
                  {unstakeTx.type === "pending" ? "Processing…" : "Unstake All & Claim Rewards"}
                </button>
              </div>

              {unstakeTx.type !== "idle" && (
                <div className={`stk-status ${unstakeTx.type}`}>{unstakeTx.msg}</div>
              )}
            </div>

          </div>
        )}

        {/* ── TOKENOMICS ────────────────────────────────────────────────── */}
        <h3>Token Utility</h3>
        <div className="utility-section">
          <p style={{ marginBottom: "1.5rem", lineHeight: "1.7" }}>
            The value of HLRR is derived solely from its utility within the NYK Labs ecosystem.
            Over time, the token will support community governance, reputation, and incentive mechanisms
            designed to align builders, users, and contributors.
          </p>
          <ul className="utility-list">
            <li><strong>Platform Access:</strong> Unlock features and services within the NYK Labs ecosystem</li>
            <li><strong>Developer Tools:</strong> Access specialized tools and APIs for building applications</li>
            <li><strong>Ecosystem Programs:</strong> Participate in community initiatives and programs</li>
            <li><strong>Governance:</strong> Vote on protocol upgrades and community proposals</li>
            <li><strong>Staking Rewards:</strong> Earn passive income by staking HLRR tokens</li>
            <li><strong>Scarcity:</strong> Fixed maximum supply of 120M tokens</li>
          </ul>
        </div>

        <h3>Tokenomics</h3>
        <div className="tokenomics-grid">
          <div className="tokenomics-card">
            <div className="token-stat">
              <span className="stat-label">Maximum Supply</span>
              <span className="stat-value">120,000,000 HLRR</span>
              <span className="stat-note">Hard cap - no additional tokens will ever be minted</span>
            </div>
          </div>
          <div className="tokenomics-card">
            <div className="token-stat">
              <span className="stat-label">Initial Mint</span>
              <span className="stat-value">80,000,000 HLRR</span>
              <span className="stat-note">Circulating supply on BASE (66.7% of maximum supply)</span>
            </div>
          </div>
          <div className="tokenomics-card">
            <div className="token-stat">
              <span className="stat-label">Staking Reserve</span>
              <span className="stat-value">40,000,000 HLRR</span>
              <span className="stat-note">33.3% reserved for organic growth rewards</span>
            </div>
          </div>
        </div>

        <h3>Staking Rewards Schedule</h3>
        <div className="staking-info">
          <div className="apr-timeline">
            <div className="apr-item"><span className="year">Year 1-2</span><span className="apr-rate">12% APR</span></div>
            <div className="apr-item"><span className="year">Year 3</span><span className="apr-rate">10% APR</span></div>
            <div className="apr-item"><span className="year">Year 4</span><span className="apr-rate">8% APR</span></div>
            <div className="apr-item"><span className="year">Year 5</span><span className="apr-rate">6% APR</span></div>
            <div className="apr-item"><span className="year">Year 6+</span><span className="apr-rate">4% APR</span></div>
          </div>
          <p className="staking-note">
            <strong>Note:</strong> Staking rewards continue until the 40M reserve is depleted and maximum
            supply of 120M is reached. After reaching max supply, HLRR holders benefit solely from organic
            price appreciation driven by company growth.
          </p>
        </div>

        <h3>Token Distribution</h3>
        <div className="distribution-chart">
          <div className="dist-item airdrop">
            <div className="dist-header"><span className="dist-icon">🎁</span><span className="dist-title">Airdrop &amp; Presale</span></div>
            <div className="dist-amount">10,000,000 HLRR</div>
            <div className="dist-percent">8.3% of max supply</div>
            <div className="dist-description">Combined allocation for community airdrop and presale. Early presale at discounted price of $0.075/HLRR; price may increase over time, targeting $1M+ USDC raise.</div>
          </div>
          <div className="dist-item developers">
            <div className="dist-header"><span className="dist-icon">👨‍💻</span><span className="dist-title">Developers</span></div>
            <div className="dist-amount">20,000,000 HLRR</div>
            <div className="dist-percent">16.7% of max supply</div>
            <div className="dist-description">Team allocation for ongoing development and innovation</div>
          </div>
          <div className="dist-item investors">
            <div className="dist-header"><span className="dist-icon">💼</span><span className="dist-title">Investors</span></div>
            <div className="dist-amount">20,000,000 HLRR</div>
            <div className="dist-percent">16.7% of max supply</div>
            <div className="dist-description">Early-stage funding for platform development and growth</div>
          </div>
          <div className="dist-item treasury">
            <div className="dist-header"><span className="dist-icon">🏦</span><span className="dist-title">Treasury</span></div>
            <div className="dist-amount">30,000,000 HLRR</div>
            <div className="dist-percent">25% of max supply</div>
            <div className="dist-description">Company reserves for strategic initiatives and partnerships</div>
          </div>
          <div className="dist-item staking">
            <div className="dist-header"><span className="dist-icon">💎</span><span className="dist-title">Staking Rewards</span></div>
            <div className="dist-amount">40,000,000 HLRR</div>
            <div className="dist-percent">33.3% of max supply</div>
            <div className="dist-description">Reserved for staking rewards to incentivize long-term holders</div>
          </div>
        </div>

        <div className="summary-box">
          <h3>Distribution Summary</h3>
          <div className="summary-stats">
            <div className="summary-row">
              <span>Initial Mint (Circulating on BASE)</span>
              <span className="summary-value">80,000,000 HLRR (66.7%)</span>
            </div>
            <div className="summary-row">
              <span>Staking Reserve (Released via rewards)</span>
              <span className="summary-value">40,000,000 HLRR (33.3%)</span>
            </div>
            <div className="summary-row summary-row-staked">
              <div className="summary-staked-main">
                <span>Current Staked</span>
                <div className="summary-staked-breakdown">
                  <span>Treasury (30M owned): <strong>30M staked — 100%</strong></span>
                  <span>Developer &amp; Investor (40M owned): <strong>70%+ staked</strong></span>
                </div>
              </div>
              <span className="summary-value">60,000,000+ HLRR</span>
            </div>
            <div className="summary-row">
              <span>Active Circulation</span>
              <span className="summary-value">&lt;20,000,000 HLRR</span>
            </div>
            <div className="summary-row total">
              <span>Total Maximum Supply</span>
              <span className="summary-value">120,000,000 HLRR (100%)</span>
            </div>
          </div>
          <div style={{ marginTop: "1.5rem", padding: "1rem", background: "rgba(34, 211, 238, 0.05)", borderRadius: "6px", fontSize: "0.9rem", lineHeight: "1.6" }}>
            <strong style={{ color: "var(--accent)" }}>Note:</strong> The 80M initial mint is allocated as: Airdrop &amp; Presale (10M combined), Developers (20M), Investors (20M), and Treasury (30M).
          </div>
        </div>

        <div className="cta-section">
          <h3>Get Started</h3>
          <p>Register for the airdrop and become an early HLRR holder.</p>
          <a href="/registration" className="cta-button">Register for Airdrop →</a>
        </div>
      </section>

      <style>{`
        /* ── Existing styles ──────────────────────────────────────────────── */
        .hlrr-title { display: flex; align-items: center; gap: 0.75rem; }
        .hlrr-logo { width: 2rem; height: 2rem; object-fit: contain; }
        .intro { display: flex; align-items: center; gap: 2rem; background: rgba(34,211,238,0.1); border-left: 4px solid var(--accent); padding: 1.5rem; margin-bottom: 2rem; border-radius: 0 8px 8px 0; }
        .intro p { margin: 0; font-size: 1.1rem; line-height: 1.7; flex: 1; }
        .hlrr-logo-large { width: 120px; height: 120px; object-fit: contain; flex-shrink: 0; }
        @media (max-width: 480px) { .intro { flex-direction: column; } .hlrr-logo-large { width: 80px; height: 80px; } }
        .address-section { margin: 2rem 0; }
        .address-section h3 { color: var(--accent); font-size: 1.3rem; margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 2px solid rgba(34,211,238,0.3); }
        .address-grid { display: flex; flex-direction: column; gap: 1rem; }
        .address-card { background: rgba(17,24,39,0.6); border: 1px solid rgba(34,211,238,0.3); border-radius: 8px; padding: 1.25rem; display: flex; flex-direction: column; gap: 0.75rem; }
        .address-label { font-size: 0.9rem; color: var(--accent); font-weight: 600; }
        .address-value { font-family: 'Courier New', monospace; font-size: 0.95rem; color: var(--text); background: rgba(0,0,0,0.3); padding: 0.75rem; border-radius: 4px; word-break: break-all; border: 1px solid rgba(255,255,255,0.1); }
        h3 { color: var(--accent); font-size: 1.5rem; margin-top: 2.5rem; margin-bottom: 1.5rem; padding-bottom: 0.5rem; border-bottom: 2px solid rgba(34,211,238,0.3); }
        .contract-section { margin: 1.5rem 0 2rem; display: flex; flex-direction: column; gap: 1.25rem; }
        .verified-badge { display: inline-flex; align-items: center; gap: 0.6rem; background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.4); color: #4ade80; padding: 0.6rem 1.1rem; border-radius: 6px; font-size: 0.95rem; font-weight: 600; width: fit-content; }
        .verified-icon { font-size: 1.1rem; font-weight: 700; }
        .security-score-badge { display: inline-flex; align-items: center; gap: 0.75rem; background: rgba(17,24,39,0.6); border: 1px solid rgba(34,197,94,0.35); border-radius: 8px; padding: 0.85rem 1.4rem; text-decoration: none; width: fit-content; transition: border-color 0.2s, box-shadow 0.2s; }
        .security-score-badge:hover { border-color: #4ade80; box-shadow: 0 4px 12px rgba(34,197,94,0.2); }
        .security-score-label { font-size: 0.85rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; }
        .security-score-value { font-size: 1.5rem; font-weight: 700; color: #4ade80; }
        .security-score-source { font-size: 0.8rem; color: var(--muted); }
        .explorer-links { display: flex; flex-wrap: wrap; gap: 1rem; }
        .explorer-link { display: flex; flex-direction: column; gap: 0.25rem; background: rgba(17,24,39,0.6); border: 1px solid rgba(34,211,238,0.3); border-radius: 8px; padding: 1rem 1.4rem; text-decoration: none; transition: border-color 0.2s, box-shadow 0.2s; min-width: 160px; }
        .explorer-link:hover { border-color: var(--accent); box-shadow: 0 4px 12px rgba(34,211,238,0.2); }
        .explorer-link-label { font-size: 1rem; font-weight: 700; color: var(--accent); }
        .explorer-link-desc { font-size: 0.82rem; color: var(--muted); }
        .utility-section { margin: 1.5rem 0; }
        .utility-list { list-style: none; padding: 0; }
        .utility-list li { padding: 1rem; margin-bottom: 1rem; background: rgba(34,211,238,0.05); border-left: 3px solid var(--accent); border-radius: 0 6px 6px 0; }
        .utility-list li strong { color: var(--accent); display: block; margin-bottom: 0.5rem; font-size: 1.1rem; }
        .tokenomics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem; margin: 2rem 0; }
        .tokenomics-card { background: rgba(34,211,238,0.08); border: 1px solid rgba(34,211,238,0.3); border-radius: 12px; padding: 1.5rem; }
        .token-stat { display: flex; flex-direction: column; gap: 0.5rem; }
        .stat-label { font-size: 0.9rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; }
        .stat-value { font-size: 1.8rem; font-weight: 700; color: var(--accent); }
        .stat-note { font-size: 0.85rem; color: var(--muted); line-height: 1.4; }
        .staking-info { background: rgba(17,24,39,0.5); padding: 2rem; border-radius: 12px; margin: 1.5rem 0; }
        .apr-timeline { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.5rem; }
        .apr-item { display: flex; flex-direction: column; align-items: center; padding: 1rem; background: rgba(34,211,238,0.1); border-radius: 8px; min-width: 120px; }
        .year { font-size: 0.85rem; color: var(--muted); margin-bottom: 0.5rem; }
        .apr-rate { font-size: 1.5rem; font-weight: 700; color: var(--accent); }
        .staking-note { font-size: 0.95rem; line-height: 1.6; color: var(--text); padding: 1rem; background: rgba(34,211,238,0.05); border-radius: 6px; }
        .summary-row-staked { align-items: flex-start; }
        .summary-staked-main { display: flex; flex-direction: column; gap: 0.4rem; }
        .summary-staked-breakdown { display: flex; flex-direction: column; gap: 0.15rem; font-size: 0.82rem; color: var(--muted); padding-left: 0.75rem; border-left: 2px solid rgba(34,211,238,0.3); }
        .summary-staked-breakdown strong { color: var(--accent); }
        .distribution-chart { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem; margin: 2rem 0; }
        .dist-item { background: rgba(17,24,39,0.6); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 1.5rem; transition: transform 0.2s, box-shadow 0.2s; }
        .dist-item:hover { transform: translateY(-2px); box-shadow: 0 8px 16px rgba(34,211,238,0.2); }
        .dist-header { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem; }
        .dist-icon { font-size: 1.8rem; }
        .dist-title { font-size: 1.1rem; font-weight: 600; color: var(--accent); }
        .dist-amount { font-size: 1.5rem; font-weight: 700; color: var(--text); margin-bottom: 0.25rem; }
        .dist-percent { font-size: 0.9rem; color: var(--accent); margin-bottom: 0.75rem; }
        .dist-description { font-size: 0.9rem; color: var(--muted); line-height: 1.5; }
        .summary-box { background: rgba(34,211,238,0.08); border: 2px solid rgba(34,211,238,0.3); border-radius: 12px; padding: 2rem; margin: 2.5rem 0; }
        .summary-box h3 { margin-top: 0; border: none; padding: 0; }
        .summary-stats { display: flex; flex-direction: column; gap: 1rem; }
        .summary-row { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 0; border-bottom: 1px solid rgba(255,255,255,0.1); }
        .summary-row.total { border-bottom: none; border-top: 2px solid var(--accent); padding-top: 1rem; margin-top: 0.5rem; font-weight: 600; }
        .summary-value { color: var(--accent); font-weight: 600; }
        .cta-section { background: linear-gradient(135deg, rgba(34,211,238,0.15), rgba(34,211,238,0.05)); border: 1px solid rgba(34,211,238,0.3); border-radius: 12px; padding: 2rem; margin-top: 3rem; text-align: center; }
        .cta-section h3 { margin-top: 0; border: none; }
        .cta-section p { font-size: 1.1rem; margin-bottom: 1.5rem; }
        .cta-button { display: inline-block; background: var(--accent); color: #0f172a; padding: 1rem 2.5rem; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 1.1rem; transition: all 0.3s; }
        .cta-button:hover { background: #06b6d4; transform: translateY(-2px); box-shadow: 0 8px 16px rgba(34,211,238,0.3); }

        /* ── Staking panel styles ──────────────────────────────────────── */
        .stk-wallet-bar { margin: 1rem 0 1.5rem; }
        .stk-wallet-connected { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.75rem; background: rgba(17,24,39,0.6); border: 1px solid rgba(34,211,238,0.3); border-radius: 8px; padding: 0.85rem 1.25rem; }
        .stk-wallet-info { display: flex; align-items: center; gap: 1rem; }
        .stk-addr { font-family: 'Courier New', monospace; font-size: 0.95rem; color: var(--text); }
        .stk-network { font-size: 0.82rem; font-weight: 600; padding: 0.2rem 0.6rem; border-radius: 4px; }
        .stk-network.ok { background: rgba(34,197,94,0.15); color: #4ade80; }
        .stk-network.bad { background: rgba(239,68,68,0.15); color: #f87171; }
        .stk-wallet-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }
        .stk-panel { display: flex; flex-direction: column; gap: 1.5rem; margin: 1rem 0 2rem; }
        .stk-position-card { background: rgba(34,211,238,0.05); border: 1px solid rgba(34,211,238,0.25); border-radius: 12px; padding: 1.5rem; }
        .stk-position-title { font-size: 1.05rem; font-weight: 600; color: var(--accent); margin-bottom: 1.25rem; }
        .stk-stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.25rem; }
        .stk-stat { display: flex; flex-direction: column; gap: 0.3rem; padding: 0.85rem 1rem; background: rgba(17,24,39,0.5); border-radius: 8px; border: 1px solid rgba(255,255,255,0.06); }
        .stk-stat-label { font-size: 0.78rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; }
        .stk-stat-value { font-size: 1rem; font-weight: 600; color: var(--text); }
        .stk-stat-value.accent { color: var(--accent); }
        .stk-stat-value.highlight { color: #fbbf24; }
        .stk-stat-value.ok { color: #4ade80; }
        .stk-stat-value.warn { color: #fb923c; }
        .stk-loading { color: var(--muted); font-size: 0.9rem; padding: 0.5rem 0; }
        .stk-refresh-btn { background: transparent; border: 1px solid rgba(34,211,238,0.3); color: var(--accent); padding: 0.4rem 1rem; border-radius: 6px; font-size: 0.85rem; cursor: pointer; transition: border-color 0.2s; }
        .stk-refresh-btn:hover:not(:disabled) { border-color: var(--accent); }
        .stk-refresh-btn:disabled { opacity: 0.5; cursor: default; }
        .stk-action-card { background: rgba(17,24,39,0.5); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem; }
        .stk-action-title { font-size: 1.05rem; font-weight: 600; color: var(--accent); }
        .stk-action-note { font-size: 0.88rem; color: var(--muted); margin: 0; }
        .stk-input-row { display: flex; gap: 0.5rem; }
        .stk-input { flex: 1; background: rgba(17,24,39,0.8); border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; padding: 0.65rem 0.9rem; color: var(--text); font-size: 1rem; outline: none; transition: border-color 0.2s; }
        .stk-input:focus { border-color: var(--accent); }
        .stk-input::placeholder { color: var(--muted); }
        .stk-btn-primary { background: var(--accent); color: #0f172a; border: none; border-radius: 6px; padding: 0.65rem 1.5rem; font-size: 0.95rem; font-weight: 600; cursor: pointer; transition: background 0.2s, opacity 0.2s; }
        .stk-btn-primary:hover:not(:disabled) { background: #06b6d4; }
        .stk-btn-primary:disabled { opacity: 0.5; cursor: default; }
        .stk-btn-danger { background: rgba(239,68,68,0.15); color: #f87171; border: 1px solid rgba(239,68,68,0.4); border-radius: 6px; padding: 0.65rem 1.5rem; font-size: 0.95rem; font-weight: 600; cursor: pointer; transition: background 0.2s, opacity 0.2s; }
        .stk-btn-danger:hover:not(:disabled) { background: rgba(239,68,68,0.25); }
        .stk-btn-danger:disabled { opacity: 0.4; cursor: default; }
        .stk-btn-warn { background: rgba(251,146,60,0.15); color: #fb923c; border: 1px solid rgba(251,146,60,0.4); border-radius: 6px; padding: 0.4rem 0.9rem; font-size: 0.85rem; font-weight: 600; cursor: pointer; }
        .stk-btn-ghost { background: transparent; color: var(--muted); border: 1px solid rgba(255,255,255,0.12); border-radius: 6px; padding: 0.4rem 0.9rem; font-size: 0.85rem; cursor: pointer; transition: border-color 0.2s, color 0.2s; }
        .stk-btn-ghost:hover { border-color: rgba(255,255,255,0.3); color: var(--text); }
        .stk-btn-max { background: rgba(34,211,238,0.1); color: var(--accent); border: 1px solid rgba(34,211,238,0.3); border-radius: 6px; padding: 0.65rem 0.9rem; font-size: 0.85rem; font-weight: 600; cursor: pointer; white-space: nowrap; }
        .stk-btn-max:hover { background: rgba(34,211,238,0.2); }
        .stk-unstake-sub { display: flex; flex-direction: column; gap: 0.75rem; }
        .stk-divider { text-align: center; color: var(--muted); font-size: 0.85rem; padding: 0.5rem 0; }
        .stk-unstake-summary { background: rgba(34,211,238,0.06); border: 1px solid rgba(34,211,238,0.2); border-radius: 6px; padding: 0.85rem 1rem; font-size: 0.95rem; color: var(--text); }
        .stk-unstake-summary strong { color: #fbbf24; }
        .stk-reward-breakdown { font-size: 0.85rem; color: var(--muted); }
        .stk-status { border-radius: 6px; padding: 0.65rem 1rem; font-size: 0.9rem; margin-top: 0.25rem; }
        .stk-status.pending { background: rgba(251,191,36,0.1); color: #fbbf24; border: 1px solid rgba(251,191,36,0.3); }
        .stk-status.success { background: rgba(34,197,94,0.1); color: #4ade80; border: 1px solid rgba(34,197,94,0.3); }
        .stk-status.error { background: rgba(239,68,68,0.1); color: #f87171; border: 1px solid rgba(239,68,68,0.3); }
        .stk-status.warn { background: rgba(251,146,60,0.1); color: #fb923c; border: 1px solid rgba(251,146,60,0.3); }
        .stk-wallet-picker { background: rgba(17,24,39,0.9); border: 1px solid rgba(34,211,238,0.3); border-radius: 10px; padding: 1.25rem; margin-bottom: 1rem; display: flex; flex-direction: column; gap: 0.5rem; max-width: 320px; }
        .stk-picker-title { font-size: 0.9rem; color: var(--muted); margin: 0 0 0.25rem; }
        .stk-picker-btn { display: flex; align-items: center; gap: 0.75rem; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; padding: 0.7rem 1rem; color: var(--text); font-size: 0.95rem; cursor: pointer; transition: border-color 0.2s; }
        .stk-picker-btn:hover { border-color: var(--accent); }
        .stk-wallet-icon { width: 22px; height: 22px; border-radius: 4px; }

        @media (max-width: 768px) {
          .tokenomics-grid, .distribution-chart { grid-template-columns: 1fr; }
          .apr-timeline { flex-direction: column; }
          .apr-item { width: 100%; }
          .summary-row { flex-direction: column; align-items: flex-start; gap: 0.5rem; }
          .stk-wallet-connected { flex-direction: column; align-items: flex-start; }
          .stk-stats-grid { grid-template-columns: 1fr 1fr; }
        }
        @media (max-width: 480px) {
          .stk-stats-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </main>
  );
}
