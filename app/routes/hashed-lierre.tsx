import type { Route } from "./+types/hashed-lierre";

const HLRR_TOKEN_ADDRESS = import.meta.env.VITE_HLRR_TOKEN_ADDRESS;
const TREASURY_ADDRESS = import.meta.env.VITE_TREASURY_ADDRESS;

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Hashed Lierre Token (HLRR) - NYK Labs" },
    { name: "description", content: "Hashed Lierre Token (HLRR) is a blockchain utility token by NYK Labs. Explore tokenomics, distribution model, smart contract details, and ecosystem use cases." },
  ];
}

export default function HashedLierre() {
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
            <a
              href="https://repo.sourcify.dev/8453/0x5E1583d48bcFd60de77138ea195f3EFbe128405d"
              target="_blank"
              rel="noopener noreferrer"
              className="explorer-link"
            >
              <span className="explorer-link-label">Sourcify</span>
              <span className="explorer-link-desc">Verified source code</span>
            </a>
            <a
              href="https://base.blockscout.com/address/0x5E1583d48bcFd60de77138ea195f3EFbe128405d?tab=contract"
              target="_blank"
              rel="noopener noreferrer"
              className="explorer-link"
            >
              <span className="explorer-link-label">Blockscout</span>
              <span className="explorer-link-desc">Contract &amp; ABI</span>
            </a>
            <a
              href="https://basescan.org/address/0x5E1583d48bcFd60de77138ea195f3EFbe128405d"
              target="_blank"
              rel="noopener noreferrer"
              className="explorer-link"
            >
              <span className="explorer-link-label">Basescan</span>
              <span className="explorer-link-desc">Transactions &amp; holders</span>
            </a>
          </div>
        </div>

        <h3>Token Utility</h3>
        <div className="utility-section">
          <p style={{ marginBottom: '1.5rem', lineHeight: '1.7' }}>
            The value of HLRR is derived solely from its utility within the NYK Labs ecosystem. 
            Over time, the token will support community governance, reputation, and incentive mechanisms 
            designed to align builders, users, and contributors.
          </p>
          <ul className="utility-list">
            <li>
              <strong>Platform Access:</strong> Unlock features and services within the NYK Labs ecosystem
            </li>
            <li>
              <strong>Developer Tools:</strong> Access specialized tools and APIs for building applications
            </li>
            <li>
              <strong>Ecosystem Programs:</strong> Participate in community initiatives and programs
            </li>
            <li>
              <strong>Governance:</strong> Vote on protocol upgrades and community proposals
            </li>
            <li>
              <strong>Staking Rewards:</strong> Earn passive income by staking HLRR tokens
            </li>
            <li>
              <strong>Scarcity:</strong> Fixed maximum supply of 120M tokens
            </li>
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
            <div className="apr-item">
              <span className="year">Year 1-2</span>
              <span className="apr-rate">12% APR</span>
            </div>
            <div className="apr-item">
              <span className="year">Year 3</span>
              <span className="apr-rate">10% APR</span>
            </div>
            <div className="apr-item">
              <span className="year">Year 4</span>
              <span className="apr-rate">8% APR</span>
            </div>
            <div className="apr-item">
              <span className="year">Year 5</span>
              <span className="apr-rate">6% APR</span>
            </div>
            <div className="apr-item">
              <span className="year">Year 6+</span>
              <span className="apr-rate">4% APR</span>
            </div>
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
            <div className="dist-header">
              <span className="dist-icon">🎁</span>
              <span className="dist-title">Airdrop & Presale</span>
            </div>
            <div className="dist-amount">10,000,000 HLRR</div>
            <div className="dist-percent">8.3% of max supply</div>
            <div className="dist-description">
              Combined allocation for community airdrop and presale. Early presale at discounted price of $0.075/HLRR; price may increase over time, targeting $1M+ USDC raise.
            </div>
          </div>

          <div className="dist-item developers">
            <div className="dist-header">
              <span className="dist-icon">👨‍💻</span>
              <span className="dist-title">Developers</span>
            </div>
            <div className="dist-amount">20,000,000 HLRR</div>
            <div className="dist-percent">16.7% of max supply</div>
            <div className="dist-description">
              Team allocation for ongoing development and innovation
            </div>
          </div>

          <div className="dist-item investors">
            <div className="dist-header">
              <span className="dist-icon">💼</span>
              <span className="dist-title">Investors</span>
            </div>
            <div className="dist-amount">20,000,000 HLRR</div>
            <div className="dist-percent">16.7% of max supply</div>
            <div className="dist-description">
              Early-stage funding for platform development and growth
            </div>
          </div>

          <div className="dist-item treasury">
            <div className="dist-header">
              <span className="dist-icon">🏦</span>
              <span className="dist-title">Treasury</span>
            </div>
            <div className="dist-amount">30,000,000 HLRR</div>
            <div className="dist-percent">25% of max supply</div>
            <div className="dist-description">
              Company reserves for strategic initiatives and partnerships
            </div>
          </div>

          <div className="dist-item staking">
            <div className="dist-header">
              <span className="dist-icon">💎</span>
              <span className="dist-title">Staking Rewards</span>
            </div>
            <div className="dist-amount">40,000,000 HLRR</div>
            <div className="dist-percent">33.3% of max supply</div>
            <div className="dist-description">
              Reserved for staking rewards to incentivize long-term holders
            </div>
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
          <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(34, 211, 238, 0.05)', borderRadius: '6px', fontSize: '0.9rem', lineHeight: '1.6' }}>
            <strong style={{ color: 'var(--accent)' }}>Note:</strong> The 80M initial mint is allocated as: Airdrop & Presale (10M combined), Developers (20M), Investors (20M), and Treasury (30M).
          </div>
        </div>

        <div className="cta-section">
          <h3>Get Started</h3>
          <p>Register for the airdrop and become an early HLRR holder.</p>
          <a href="/registration" className="cta-button">
            Register for Airdrop →
          </a>
        </div>
      </section>

      <style>{`
        .hlrr-title {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .hlrr-logo {
          width: 2rem;
          height: 2rem;
          object-fit: contain;
        }

        .intro {
          display: flex;
          align-items: center;
          gap: 2rem;
          background: rgba(34, 211, 238, 0.1);
          border-left: 4px solid var(--accent);
          padding: 1.5rem;
          margin-bottom: 2rem;
          border-radius: 0 8px 8px 0;
        }

        .intro p {
          margin: 0;
          font-size: 1.1rem;
          line-height: 1.7;
          flex: 1;
        }

        .hlrr-logo-large {
          width: 120px;
          height: 120px;
          object-fit: contain;
          flex-shrink: 0;
        }

        @media (max-width: 480px) {
          .intro {
            flex-direction: column;
          }
          .hlrr-logo-large {
            width: 80px;
            height: 80px;
          }
        }

        .address-section {
          margin: 2rem 0;
        }

        .address-section h3 {
          color: var(--accent);
          font-size: 1.3rem;
          margin-bottom: 1rem;
          padding-bottom: 0.5rem;
          border-bottom: 2px solid rgba(34, 211, 238, 0.3);
        }

        .address-grid {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .address-card {
          background: rgba(17, 24, 39, 0.6);
          border: 1px solid rgba(34, 211, 238, 0.3);
          border-radius: 8px;
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .address-label {
          font-size: 0.9rem;
          color: var(--accent);
          font-weight: 600;
        }

        .address-value {
          font-family: 'Courier New', monospace;
          font-size: 0.95rem;
          color: var(--text);
          background: rgba(0, 0, 0, 0.3);
          padding: 0.75rem;
          border-radius: 4px;
          word-break: break-all;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        h3 {
          color: var(--accent);
          font-size: 1.5rem;
          margin-top: 2.5rem;
          margin-bottom: 1.5rem;
          padding-bottom: 0.5rem;
          border-bottom: 2px solid rgba(34, 211, 238, 0.3);
        }

        .contract-section {
          margin: 1.5rem 0 2rem;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        .verified-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.6rem;
          background: rgba(34, 197, 94, 0.1);
          border: 1px solid rgba(34, 197, 94, 0.4);
          color: #4ade80;
          padding: 0.6rem 1.1rem;
          border-radius: 6px;
          font-size: 0.95rem;
          font-weight: 600;
          width: fit-content;
        }

        .verified-icon {
          font-size: 1.1rem;
          font-weight: 700;
        }

        .security-score-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.75rem;
          background: rgba(17, 24, 39, 0.6);
          border: 1px solid rgba(34, 197, 94, 0.35);
          border-radius: 8px;
          padding: 0.85rem 1.4rem;
          text-decoration: none;
          width: fit-content;
          transition: border-color 0.2s, box-shadow 0.2s;
        }

        .security-score-badge:hover {
          border-color: #4ade80;
          box-shadow: 0 4px 12px rgba(34, 197, 94, 0.2);
        }

        .security-score-label {
          font-size: 0.85rem;
          color: var(--muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .security-score-value {
          font-size: 1.5rem;
          font-weight: 700;
          color: #4ade80;
        }

        .security-score-source {
          font-size: 0.8rem;
          color: var(--muted);
        }

        .explorer-links {
          display: flex;
          flex-wrap: wrap;
          gap: 1rem;
        }

        .explorer-link {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          background: rgba(17, 24, 39, 0.6);
          border: 1px solid rgba(34, 211, 238, 0.3);
          border-radius: 8px;
          padding: 1rem 1.4rem;
          text-decoration: none;
          transition: border-color 0.2s, box-shadow 0.2s;
          min-width: 160px;
        }

        .explorer-link:hover {
          border-color: var(--accent);
          box-shadow: 0 4px 12px rgba(34, 211, 238, 0.2);
        }

        .explorer-link-label {
          font-size: 1rem;
          font-weight: 700;
          color: var(--accent);
        }

        .explorer-link-desc {
          font-size: 0.82rem;
          color: var(--muted);
        }

        .utility-section {
          margin: 1.5rem 0;
        }

        .utility-list {
          list-style: none;
          padding: 0;
        }

        .utility-list li {
          padding: 1rem;
          margin-bottom: 1rem;
          background: rgba(34, 211, 238, 0.05);
          border-left: 3px solid var(--accent);
          border-radius: 0 6px 6px 0;
        }

        .utility-list li strong {
          color: var(--accent);
          display: block;
          margin-bottom: 0.5rem;
          font-size: 1.1rem;
        }

        .tokenomics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 1.5rem;
          margin: 2rem 0;
        }

        .tokenomics-card {
          background: rgba(34, 211, 238, 0.08);
          border: 1px solid rgba(34, 211, 238, 0.3);
          border-radius: 12px;
          padding: 1.5rem;
        }

        .token-stat {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .stat-label {
          font-size: 0.9rem;
          color: var(--muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .stat-value {
          font-size: 1.8rem;
          font-weight: 700;
          color: var(--accent);
        }

        .stat-note {
          font-size: 0.85rem;
          color: var(--muted);
          line-height: 1.4;
        }

        .staking-info {
          background: rgba(17, 24, 39, 0.5);
          padding: 2rem;
          border-radius: 12px;
          margin: 1.5rem 0;
        }

        .apr-timeline {
          display: flex;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 1rem;
          margin-bottom: 1.5rem;
        }

        .apr-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 1rem;
          background: rgba(34, 211, 238, 0.1);
          border-radius: 8px;
          min-width: 120px;
        }

        .year {
          font-size: 0.85rem;
          color: var(--muted);
          margin-bottom: 0.5rem;
        }

        .apr-rate {
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--accent);
        }

        .staking-note {
          font-size: 0.95rem;
          line-height: 1.6;
          color: var(--text);
          padding: 1rem;
          background: rgba(34, 211, 238, 0.05);
          border-radius: 6px;
        }

        .summary-row-staked {
          align-items: flex-start;
        }

        .summary-staked-main {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
        }

        .summary-staked-breakdown {
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
          font-size: 0.82rem;
          color: var(--muted);
          padding-left: 0.75rem;
          border-left: 2px solid rgba(34, 211, 238, 0.3);
        }

        .summary-staked-breakdown strong {
          color: var(--accent);
        }

        .distribution-chart {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 1.5rem;
          margin: 2rem 0;
        }

        .dist-item {
          background: rgba(17, 24, 39, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 1.5rem;
          transition: transform 0.2s, box-shadow 0.2s;
        }

        .dist-item:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 16px rgba(34, 211, 238, 0.2);
        }

        .dist-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 1rem;
        }

        .dist-icon {
          font-size: 1.8rem;
        }

        .dist-title {
          font-size: 1.1rem;
          font-weight: 600;
          color: var(--accent);
        }

        .dist-amount {
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--text);
          margin-bottom: 0.25rem;
        }

        .dist-percent {
          font-size: 0.9rem;
          color: var(--accent);
          margin-bottom: 0.75rem;
        }

        .dist-description {
          font-size: 0.9rem;
          color: var(--muted);
          line-height: 1.5;
        }

        .summary-box {
          background: rgba(34, 211, 238, 0.08);
          border: 2px solid rgba(34, 211, 238, 0.3);
          border-radius: 12px;
          padding: 2rem;
          margin: 2.5rem 0;
        }

        .summary-box h3 {
          margin-top: 0;
          border: none;
          padding: 0;
        }

        .summary-stats {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .summary-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem 0;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .summary-row.total {
          border-bottom: none;
          border-top: 2px solid var(--accent);
          padding-top: 1rem;
          margin-top: 0.5rem;
          font-weight: 600;
        }

        .summary-value {
          color: var(--accent);
          font-weight: 600;
        }

        .cta-section {
          background: linear-gradient(135deg, rgba(34, 211, 238, 0.15), rgba(34, 211, 238, 0.05));
          border: 1px solid rgba(34, 211, 238, 0.3);
          border-radius: 12px;
          padding: 2rem;
          margin-top: 3rem;
          text-align: center;
        }

        .cta-section h3 {
          margin-top: 0;
          border: none;
        }

        .cta-section p {
          font-size: 1.1rem;
          margin-bottom: 1.5rem;
        }

        .cta-button {
          display: inline-block;
          background: var(--accent);
          color: #0f172a;
          padding: 1rem 2.5rem;
          border-radius: 8px;
          text-decoration: none;
          font-weight: 600;
          font-size: 1.1rem;
          transition: all 0.3s;
        }

        .cta-button:hover {
          background: #06b6d4;
          transform: translateY(-2px);
          box-shadow: 0 8px 16px rgba(34, 211, 238, 0.3);
        }

        @media (max-width: 768px) {
          .tokenomics-grid,
          .distribution-chart {
            grid-template-columns: 1fr;
          }

          .apr-timeline {
            flex-direction: column;
          }

          .apr-item {
            width: 100%;
          }

          .summary-row {
            flex-direction: column;
            align-items: flex-start;
            gap: 0.5rem;
          }
        }
      `}</style>
    </main>
  );
}
