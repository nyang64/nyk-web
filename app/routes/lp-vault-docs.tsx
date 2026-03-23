import type { Route } from "./+types/lp-vault-docs";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "About nLock | NYK Labs" },
    {
      name: "description",
      content:
        "Learn how nLock by NykLabs works: non-custodial LP NFT position locking, supported networks and protocols, pool initialization, lock/close flow, and deployed contract addresses.",
    },
  ];
}

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
};

export default function LpVaultDocs() {
  return (
    <main style={{ padding: "3rem 1.5rem" }}>
      <div style={S.page}>
        <div style={S.card}>
          <h2 style={{ fontSize: "1.1rem", color: "var(--accent)", fontWeight: 600, marginBottom: "0.75rem" }}>
            About nLock
          </h2>
          <p style={{ color: "var(--text)", fontSize: "0.9rem", lineHeight: "1.7", marginBottom: "1rem" }}>
            nLock vaults are non-custodial smart contracts that accept a Uniswap V3-style NFT position
            and lock it for a configurable duration. During the lock period the original owner can still collect
            trading fees at any time; only the NFT itself (representing the liquidity) is held by the vault until
            the unlock time passes. This design lets protocols and teams demonstrate long-term liquidity commitment
            without surrendering fee revenue.
          </p>

          {/* Vault deployments */}
          <h3 style={{ fontSize: "0.95rem", color: "var(--text)", fontWeight: 600, marginBottom: "0.6rem" }}>
            Deployed Vault Contracts
          </h3>
          <div style={{ overflowX: "auto", marginBottom: "1.25rem" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                  {["Network", "Chain ID", "Contract Address", "Source"].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "0.4rem 0.75rem", color: "var(--muted)", fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {([
                  { net: "Ethereum",         chainId: 1,        addr: "0x5028410b2a9dDF94b36aF1124a3393f96873e1e4", explorer: "https://etherscan.io",                     sourcify: "https://repo.sourcify.dev/contracts/full_match/1/0x5028410b2a9dDF94b36aF1124a3393f96873e1e4/" },
                  { net: "Eth Sepolia",      chainId: 11155111, addr: "0x17b64a028Ae5aF7B19b418739d9C46805c78ED54", explorer: "https://sepolia.etherscan.io",              sourcify: "https://repo.sourcify.dev/contracts/full_match/11155111/0x17b64a028Ae5aF7B19b418739d9C46805c78ED54/" },
                  { net: "Base Mainnet",     chainId: 8453,     addr: "0x5AA450B8fE52eD43455a3Cd7cACe01e086AF3805", explorer: "https://basescan.org",                      sourcify: "https://repo.sourcify.dev/contracts/full_match/8453/0x5AA450B8fE52eD43455a3Cd7cACe01e086AF3805/" },
                  { net: "Base Sepolia",     chainId: 84532,    addr: "0x35b27228E96159E6c0A7921faC733C6aE06b86d1", explorer: "https://sepolia.basescan.org",               sourcify: "https://repo.sourcify.dev/contracts/full_match/84532/0x35b27228E96159E6c0A7921faC733C6aE06b86d1/" },
                  { net: "Arbitrum One",     chainId: 42161,    addr: "0x1B0c30f168D6Ef5F8203C915D191280e8Fe039Fa", explorer: "https://arbiscan.io",                       sourcify: "https://repo.sourcify.dev/contracts/full_match/42161/0x1B0c30f168D6Ef5F8203C915D191280e8Fe039Fa/" },
                  { net: "Arbitrum Sepolia", chainId: 421614,   addr: "0x5028410b2a9dDF94b36aF1124a3393f96873e1e4", explorer: "https://sepolia.arbiscan.io",                sourcify: "https://repo.sourcify.dev/contracts/full_match/421614/0x5028410b2a9dDF94b36aF1124a3393f96873e1e4/" },
                  { net: "OP Mainnet",       chainId: 10,       addr: "0x5028410b2a9dDF94b36aF1124a3393f96873e1e4", explorer: "https://optimistic.etherscan.io",            sourcify: "https://repo.sourcify.dev/contracts/full_match/10/0x5028410b2a9dDF94b36aF1124a3393f96873e1e4/" },
                  { net: "OP Sepolia",       chainId: 11155420, addr: "0x5028410b2a9dDF94b36aF1124a3393f96873e1e4", explorer: "https://sepolia-optimistic.etherscan.io",    sourcify: "https://repo.sourcify.dev/contracts/full_match/11155420/0x5028410b2a9dDF94b36aF1124a3393f96873e1e4/" },
                  { net: "BNB Chain",        chainId: 56,       addr: "0x27e99baA94E143E17A4Ec09334639329eEA901bb", explorer: "https://bscscan.com",                       sourcify: "https://repo.sourcify.dev/contracts/full_match/56/0x27e99baA94E143E17A4Ec09334639329eEA901bb/" },
                  { net: "BNB Testnet",      chainId: 97,       addr: "0x5028410b2a9dDF94b36aF1124a3393f96873e1e4", explorer: "https://testnet.bscscan.com",                sourcify: "https://repo.sourcify.dev/contracts/full_match/97/0x5028410b2a9dDF94b36aF1124a3393f96873e1e4/" },
                  { net: "Polygon",          chainId: 137,      addr: "0x5028410b2a9dDF94b36aF1124a3393f96873e1e4", explorer: "https://polygonscan.com",                   sourcify: "https://repo.sourcify.dev/contracts/full_match/137/0x5028410b2a9dDF94b36aF1124a3393f96873e1e4/" },
                ] as { net: string; chainId: number; addr: string; explorer: string; sourcify: string }[]).map(({ net, chainId, addr, explorer, sourcify }) => (
                  <tr key={chainId} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <td style={{ padding: "0.45rem 0.75rem", color: "var(--text)" }}>{net}</td>
                    <td style={{ padding: "0.45rem 0.75rem", color: "var(--muted)" }}>{chainId}</td>
                    <td style={{ padding: "0.45rem 0.75rem", fontFamily: "monospace" }}>
                      <a href={`${explorer}/address/${addr}`} target="_blank" rel="noopener noreferrer"
                        style={{ color: "var(--accent)", textDecoration: "none", wordBreak: "break-all" }}>
                        {addr}
                      </a>
                    </td>
                    <td style={{ padding: "0.45rem 0.75rem" }}>
                      <a href={sourcify} target="_blank" rel="noopener noreferrer"
                        style={{ color: "#a78bfa", textDecoration: "none", fontSize: "0.8rem", whiteSpace: "nowrap" }}>
                        Sourcify ↗
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Network / Protocol support */}
          <h3 style={{ fontSize: "0.95rem", color: "var(--text)", fontWeight: 600, marginBottom: "0.6rem" }}>
            Supported Networks &amp; Protocols
          </h3>
          <div style={{ overflowX: "auto", marginBottom: "1.25rem" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                  {["Network", "Uniswap V3", "PancakeSwap V3", "Aerodrome", "Velodrome"].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "0.4rem 0.75rem", color: "var(--muted)", fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {([
                  { net: "Ethereum",         uni: true,  pcs: true,  aero: false, velo: false },
                  { net: "Eth Sepolia",      uni: true,  pcs: true,  aero: false, velo: false },
                  { net: "Base Mainnet",     uni: true,  pcs: true,  aero: true,  velo: false },
                  { net: "Base Sepolia",     uni: true,  pcs: false, aero: false, velo: false },
                  { net: "Arbitrum One",     uni: true,  pcs: true,  aero: false, velo: false },
                  { net: "Arbitrum Sepolia", uni: true,  pcs: false, aero: false, velo: false },
                  { net: "OP Mainnet",       uni: true,  pcs: false, aero: false, velo: true  },
                  { net: "OP Sepolia",       uni: true,  pcs: false, aero: false, velo: false },
                  { net: "BNB Chain",        uni: true,  pcs: true,  aero: false, velo: false },
                  { net: "BNB Testnet",      uni: false, pcs: true,  aero: false, velo: false },
                  { net: "Polygon",          uni: true,  pcs: false, aero: false, velo: false },
                ] as { net: string; uni: boolean; pcs: boolean; aero: boolean; velo: boolean }[]).map(({ net, uni, pcs, aero, velo }) => {
                  const tick = (v: boolean) => v
                    ? <span style={{ color: "#10b981" }}>✓</span>
                    : <span style={{ color: "rgba(255,255,255,0.15)" }}>—</span>;
                  return (
                    <tr key={net} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      <td style={{ padding: "0.45rem 0.75rem", color: "var(--text)" }}>{net}</td>
                      <td style={{ padding: "0.45rem 0.75rem" }}>{tick(uni)}</td>
                      <td style={{ padding: "0.45rem 0.75rem" }}>{tick(pcs)}</td>
                      <td style={{ padding: "0.45rem 0.75rem" }}>{tick(aero)}</td>
                      <td style={{ padding: "0.45rem 0.75rem" }}>{tick(velo)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Protocol initialization */}
          <h3 style={{ fontSize: "0.95rem", color: "var(--text)", fontWeight: 600, marginBottom: "0.75rem" }}>
            How Pools &amp; Positions Are Initialized
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", fontSize: "0.88rem", color: "var(--text)", lineHeight: "1.65" }}>

            <div style={{ background: "rgba(34,211,238,0.05)", border: "1px solid rgba(34,211,238,0.15)", borderRadius: "8px", padding: "0.9rem 1.1rem" }}>
              <div style={{ fontWeight: 600, color: "var(--text)", marginBottom: "0.35rem" }}>Uniswap V3 &amp; PancakeSwap V3</div>
              <p style={{ margin: 0 }}>
                Both protocols identify a pool by <strong style={{ color: "var(--text)" }}>token pair + fee tier</strong>.
                Uniswap V3 fee tiers are <code style={{ color: "var(--accent)" }}>0.01%</code>, <code style={{ color: "var(--accent)" }}>0.05%</code>,{" "}
                <code style={{ color: "var(--accent)" }}>0.3%</code>, and <code style={{ color: "var(--accent)" }}>1%</code>.
                PancakeSwap V3 replaces the 0.3% tier with <code style={{ color: "var(--accent)" }}>0.25%</code> — each is a separate pool.
                When a pool does not yet exist it is created and seeded with a <strong style={{ color: "var(--text)" }}>starting price</strong> (encoded as
                a square-root price in Q64.96 fixed-point format). A position is then minted by specifying a{" "}
                <strong style={{ color: "var(--text)" }}>lower and upper tick</strong> (the price range) plus the desired token amounts.
                The protocol deposits the exact ratio demanded by the range; any surplus of one token is returned to the caller.
                Tokens are transferred from the connected wallet directly into the pool — no intermediate custody.
              </p>
            </div>

            <div style={{ background: "rgba(167,139,250,0.05)", border: "1px solid rgba(167,139,250,0.2)", borderRadius: "8px", padding: "0.9rem 1.1rem" }}>
              <div style={{ fontWeight: 600, color: "var(--text)", marginBottom: "0.35rem" }}>Aerodrome Slipstream (Base) &amp; Velodrome Slipstream (OP)</div>
              <p style={{ margin: 0 }}>
                Slipstream pools are identified by <strong style={{ color: "var(--text)" }}>token pair + tick spacing</strong> instead of a fee tier.
                Common tick spacings are <code style={{ color: "#a78bfa)" }}>1</code>, <code style={{ color: "#a78bfa" }}>50</code>,{" "}
                <code style={{ color: "#a78bfa" }}>100</code>, and <code style={{ color: "#a78bfa" }}>200</code> — tighter spacing allows
                narrower ranges and higher capital efficiency but costs more gas to cross ticks.
                Pool creation and position minting are combined into a single <code style={{ color: "#a78bfa" }}>mint()</code> call that
                accepts a <code style={{ color: "#a78bfa" }}>sqrtPriceX96</code> parameter; if the pool already exists the price parameter
                is ignored. After minting, the LP NFT can be staked into the protocol's gauge to earn{" "}
                <strong style={{ color: "var(--text)" }}>AERO / VELO emissions</strong> and bribe rewards.
              </p>
            </div>

            <div style={{ background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: "8px", padding: "0.9rem 1.1rem" }}>
              <div style={{ fontWeight: 600, color: "var(--text)", marginBottom: "0.35rem" }}>Vault Lock &amp; Close Flow</div>
              <p style={{ marginBottom: "0.6rem" }}>
                After a position NFT is minted it is <strong style={{ color: "var(--text)" }}>approved and transferred</strong> to the
                nLock vault contract via <code style={{ color: "#10b981" }}>createLock(manager, tokenId, unlockTime)</code>.
                The vault records the owner, the position manager address, and the unlock timestamp.
                During the lock the owner may call <code style={{ color: "#10b981" }}>collectFees()</code> to harvest accrued trading fees
                at any time. Once the unlock time has passed, <code style={{ color: "#10b981" }}>withdrawNFT()</code> returns the NFT to
                the original owner who can then close, migrate, or re-lock the position as desired.
              </p>
              <p style={{ margin: 0 }}>
                The <strong style={{ color: "var(--text)" }}>"Close Position" button</strong> (visible on each locked position card once the vault lock expires and the NFT is withdrawn) executes a multi-step process:{" "}
                (1) <code style={{ color: "#10b981" }}>decreaseLiquidity()</code> removes all liquidity from the tick range and credits
                the owed token amounts to the position;{" "}
                (2) <code style={{ color: "#10b981" }}>collect()</code> transfers those token amounts plus any uncollected fees to the
                owner's wallet;{" "}
                (3) <code style={{ color: "#10b981" }}>burn()</code> destroys the now-empty NFT. All three calls are batched into a
                single <code style={{ color: "#10b981" }}>multicall()</code> transaction to save gas. The two underlying tokens are
                returned directly to the connected wallet — no intermediary custody at any step.
              </p>
            </div>

            <div style={{ background: "rgba(251,191,36,0.05)", border: "1px solid rgba(251,191,36,0.2)", borderRadius: "8px", padding: "0.9rem 1.1rem" }}>
              <div style={{ fontWeight: 600, color: "var(--text)", marginBottom: "0.35rem" }}>Wallet Requirement for LP Creation</div>
              <p style={{ margin: 0 }}>
                Both tokens of the pair must be held in the <strong style={{ color: "var(--text)" }}>same connected wallet account</strong> at
                the time of LP creation. The LP Manager reads balances and requests token approvals from whichever account is currently
                connected — it cannot pull funds from a different account. If your two tokens are split across accounts, transfer them
                to a single account first, or switch accounts in your wallet before connecting. Use the{" "}
                <strong style={{ color: "var(--text)" }}>disconnect / reconnect</strong> button in the wallet bar above to switch to the
                correct account.
              </p>
            </div>

          </div>
        </div>
      </div>
    </main>
  );
}
