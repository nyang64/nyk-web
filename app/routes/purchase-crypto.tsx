import { useState } from "react";
import type { Route } from "./+types/purchase-crypto";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "On/Off Ramp | NYK Labs" },
    { name: "description", content: "Most economic path to move fiat in and out of crypto. Bank ACH → CEX → USDC on Base → Aerodrome swap. Or use MoonPay for quick card purchases." },
  ];
}

export default function PurchaseCrypto() {
  const [selectedTab, setSelectedTab] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [cryptoCurrency, setCryptoCurrency] = useState('usdc');
  const [iframeUrl, setIframeUrl] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [disclaimerAgreed, setDisclaimerAgreed] = useState(false);

  // MoonPay configuration
  const MOONPAY_API_KEY = import.meta.env.VITE_MOONPAY_PUBLISHABLE_KEY;
  const MOONPAY_BUY_URL = import.meta.env.VITE_MOONPAY_ENVIRONMENT === 'sandbox'
    ? 'https://buy-sandbox.moonpay.com'
    : 'https://buy.moonpay.com';
  const MOONPAY_SELL_URL = import.meta.env.VITE_MOONPAY_ENVIRONMENT === 'sandbox'
    ? 'https://sell-sandbox.moonpay.com'
    : 'https://sell.moonpay.com';

  const handleBuyCrypto = () => {
    if (!amount || parseFloat(amount) <= 0) {
      alert('Please enter a valid amount');
      return;
    }
    const moonpayUrl = new URL(MOONPAY_BUY_URL);
    moonpayUrl.searchParams.append('apiKey', MOONPAY_API_KEY);
    moonpayUrl.searchParams.append('currencyCode', cryptoCurrency);
    moonpayUrl.searchParams.append('baseCurrencyCode', currency.toLowerCase());
    moonpayUrl.searchParams.append('baseCurrencyAmount', amount);
    setIframeUrl(moonpayUrl.href);
    setShowModal(true);
  };

  const handleSellCrypto = () => {
    if (!amount || parseFloat(amount) <= 0) {
      alert('Please enter a valid amount');
      return;
    }
    const moonpayUrl = new URL(MOONPAY_SELL_URL);
    moonpayUrl.searchParams.append('apiKey', MOONPAY_API_KEY);
    moonpayUrl.searchParams.append('baseCurrencyCode', cryptoCurrency);
    moonpayUrl.searchParams.append('baseCurrencyAmount', amount);
    moonpayUrl.searchParams.append('quoteCurrencyCode', currency.toLowerCase());
    setIframeUrl(moonpayUrl.href);
    setShowModal(true);
  };

  const handleTransaction = () => {
    if (selectedTab === 'buy') {
      handleBuyCrypto();
    } else {
      handleSellCrypto();
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setIframeUrl(null);
  };

  const isDisabled = !amount || parseFloat(amount) <= 0 || !disclaimerAgreed;

  const onRampSteps = [
    { label: 'Bank (USD)', icon: '🏦' },
    { label: 'ACH Transfer', arrow: true },
    { label: 'CEX (e.g. Coinbase)', icon: '🏛️' },
    { label: 'Convert to USDC', arrow: true },
    { label: 'Withdraw via Base network', arrow: true },
    { label: 'Self-Custody Wallet', icon: '👛' },
    { label: 'Aerodrome Swap → ETH', arrow: true, link: 'https://aerodrome.finance/swap' },
  ];

  const offRampSteps = [
    { label: 'Self-Custody Wallet', icon: '👛' },
    { label: 'Aerodrome Swap → USDC', arrow: true, link: 'https://aerodrome.finance/swap' },
    { label: 'Withdraw to CEX via Base', arrow: true },
    { label: 'CEX (e.g. Coinbase)', icon: '🏛️' },
    { label: 'Convert USDC → USD', arrow: true },
    { label: 'ACH Transfer', arrow: true },
    { label: 'Bank (USD)', icon: '🏦' },
  ];

  return (
    <main>
      <div className="card">
        <h2>On / Off Ramp</h2>

        {/* Most Economic Path */}
        <div className="ramp-advisory">
          <h3>Most Economic Path</h3>
          <p className="ramp-advisory-desc">
            Credit card and instant-buy services charge 2–5% fees. The cheapest way to move fiat into
            crypto — and back — is via the ACH route below. Fees are typically under 0.5% end-to-end.
          </p>

          <div className="ramp-flow-label">On-Ramp (Fiat → Crypto)</div>
          <div className="ramp-flow">
            {onRampSteps.map((step, i) =>
              step.arrow ? (
                <span key={i} className="ramp-arrow">
                  {step.link
                    ? <a href={step.link} target="_blank" rel="noopener noreferrer" className="ramp-flow-link">{step.label}</a>
                    : step.label}
                </span>
              ) : (
                <span key={i} className="ramp-chip">{step.icon} {step.label}</span>
              )
            )}
          </div>

          <div className="ramp-flow-label ramp-flow-label--off">Off-Ramp (Crypto → Fiat)</div>
          <div className="ramp-flow">
            {offRampSteps.map((step, i) =>
              step.arrow ? (
                <span key={i} className="ramp-arrow">
                  {step.link
                    ? <a href={step.link} target="_blank" rel="noopener noreferrer" className="ramp-flow-link ramp-flow-link--off">{step.label}</a>
                    : step.label}
                </span>
              ) : (
                <span key={i} className="ramp-chip ramp-chip--off">{step.icon} {step.label}</span>
              )
            )}
          </div>

          <p className="ramp-advisory-note">
            Use <strong>Base network</strong> when withdrawing from the CEX — it has the lowest withdrawal
            fees among all EVM chains. Once USDC is in your wallet, swap to any token on{' '}
            <a href="https://aerodrome.finance/swap" target="_blank" rel="noopener noreferrer" className="ramp-flow-link">
              Aerodrome Finance
            </a>{' '}
            for the best rates on Base.
          </p>
        </div>

        {/* Divider */}
        <div className="ramp-divider">
          <div className="ramp-divider-line" />
          <span className="ramp-divider-label">Quick option via MoonPay — for small amounts or credit / debit card</span>
          <div className="ramp-divider-line" />
        </div>

        {/* Tab Navigation */}
        <div className="ramp-tabs">
          <button
            type="button"
            onClick={() => setSelectedTab('buy')}
            className={`ramp-tab ${selectedTab === 'buy' ? 'ramp-tab--active' : ''}`}
          >
            Buy Crypto
          </button>
          <button
            type="button"
            onClick={() => setSelectedTab('sell')}
            className={`ramp-tab ${selectedTab === 'sell' ? 'ramp-tab--active' : ''}`}
          >
            Sell Crypto
          </button>
        </div>

        {/* Transaction Form */}
        <div className="form-container">
          <div className="form-group">
            <label>{selectedTab === 'buy' ? 'You Pay' : 'You Sell'}</label>
            <div className="ramp-input-wrap">
              <input
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="ramp-amount-input"
              />
              {selectedTab === 'buy' ? (
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="ramp-inline-select"
                >
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                </select>
              ) : (
                <select
                  value={cryptoCurrency}
                  onChange={(e) => setCryptoCurrency(e.target.value)}
                  className="ramp-inline-select"
                >
                  <option value="usdc">USDC</option>
                  <option value="usdt">USDT</option>
                  <option value="dai">DAI</option>
                  <option value="eth">ETH</option>
                  <option value="btc">BTC</option>
                  <option value="sol">SOL</option>
                  <option value="matic">MATIC</option>
                  <option value="avax">AVAX</option>
                  <option value="dot">DOT</option>
                  <option value="link">LINK</option>
                  <option value="ada">ADA</option>
                  <option value="xrp">XRP</option>
                  <option value="doge">DOGE</option>
                  <option value="ltc">LTC</option>
                  <option value="bnb">BNB</option>
                </select>
              )}
            </div>
          </div>

          <div className="form-group">
            <label>You Receive</label>
            {selectedTab === 'buy' ? (
              <select value={cryptoCurrency} onChange={(e) => setCryptoCurrency(e.target.value)}>
                <optgroup label="Stablecoins (Recommended for Presale)">
                  <option value="usdc">USD Coin (USDC)</option>
                  <option value="usdt">Tether (USDT)</option>
                  <option value="dai">Dai (DAI)</option>
                </optgroup>
                <optgroup label="Major Cryptocurrencies">
                  <option value="eth">Ethereum (ETH)</option>
                  <option value="btc">Bitcoin (BTC)</option>
                  <option value="sol">Solana (SOL)</option>
                  <option value="bnb">BNB Chain (BNB)</option>
                  <option value="xrp">Ripple (XRP)</option>
                  <option value="ada">Cardano (ADA)</option>
                  <option value="avax">Avalanche (AVAX)</option>
                  <option value="doge">Dogecoin (DOGE)</option>
                  <option value="dot">Polkadot (DOT)</option>
                  <option value="matic">Polygon (MATIC)</option>
                  <option value="link">Chainlink (LINK)</option>
                  <option value="ltc">Litecoin (LTC)</option>
                </optgroup>
              </select>
            ) : (
              <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                <option value="USD">US Dollar (USD)</option>
                <option value="EUR">Euro (EUR)</option>
                <option value="GBP">British Pound (GBP)</option>
              </select>
            )}
          </div>

          {/* Presale Tip */}
          {(cryptoCurrency === 'usdc' || cryptoCurrency === 'usdt') && selectedTab === 'buy' && (
            <div className="ramp-presale-tip">
              You can use {cryptoCurrency.toUpperCase()} to participate in the HLRR presale
            </div>
          )}

          {/* MoonPay Info Box */}
          <div className="ramp-moonpay-box">
            <div className="ramp-moonpay-icon">🌙</div>
            <div>
              <div className="ramp-moonpay-title">Powered by MoonPay</div>
              <div className="ramp-moonpay-desc">
                {selectedTab === 'buy'
                  ? 'Buy crypto instantly with credit card, bank transfer, or Apple Pay'
                  : 'Sell crypto and receive funds directly to your bank account'}
              </div>
              <div className="ramp-moonpay-badges">
                ✓ Secure &amp; Compliant &nbsp;·&nbsp; ✓ 150+ Countries &nbsp;·&nbsp; ✓ 24/7 Support
              </div>
            </div>
          </div>

          {/* Disclaimer */}
          <div className="ramp-disclaimer">
            <div className="ramp-disclaimer-title">Disclaimer — Please Read Before Proceeding</div>
            <p>
              NYK Labs provides a <strong>pure passthrough</strong> to MoonPay's payment widget.
              We do not collect, store, or have access to any data relating to your transactions,
              identity, payment details, or personal information. All transaction data is handled
              solely by MoonPay under their own privacy policy and terms of service.
            </p>
            <p>
              Any issues, disputes, failed transactions, refunds, or compliance matters are strictly
              between you and MoonPay. NYK Labs has no ability to intervene, reverse, or assist with
              any MoonPay transaction.
            </p>
            <p>
              <strong>By using this feature, you agree that NYK Labs bears no liability
              whatsoever</strong> for any loss, damage, or inconvenience arising from your use of
              MoonPay's services, including but not limited to transaction failures, incorrect amounts,
              network issues, regulatory holds, or account restrictions imposed by MoonPay.
            </p>
            <label className="ramp-disclaimer-check">
              <input
                type="checkbox"
                checked={disclaimerAgreed}
                onChange={(e) => setDisclaimerAgreed(e.target.checked)}
              />
              <span>
                I have read and agree to the disclaimer above. I understand that NYK Labs is not
                responsible for any issues arising from my use of MoonPay's services.
              </span>
            </label>
          </div>

          {/* Action Button */}
          <button
            type="submit"
            onClick={handleTransaction}
            disabled={isDisabled}
            className={`ramp-submit${isDisabled ? ' ramp-submit--disabled' : ''}`}
          >
            {selectedTab === 'buy' ? 'Buy with MoonPay' : 'Sell with MoonPay'}
          </button>

          {(!amount || parseFloat(amount) <= 0) && (
            <p className="ramp-helper-text">Enter an amount above to continue</p>
          )}
          {amount && parseFloat(amount) > 0 && !disclaimerAgreed && (
            <p className="ramp-helper-text ramp-helper-text--warn">
              Please read and accept the disclaimer above to continue
            </p>
          )}
        </div>

        {/* About MoonPay */}
        <div className="intro" style={{ marginTop: '1.5rem' }}>
          <p>
            <strong>About MoonPay — </strong>
            Click the button above to open the MoonPay widget. Accepts credit/debit card,
            Apple Pay, Google Pay, and bank transfer in 150+ countries. Convenient for
            small amounts or when you need crypto quickly — no CEX account required.
          </p>
        </div>
      </div>

      {/* MoonPay Modal */}
      {showModal && iframeUrl && (
        <div className="moonpay-modal-overlay" onClick={closeModal}>
          <div className="moonpay-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="moonpay-modal-close" onClick={closeModal} aria-label="Close">✕</button>
            <iframe
              src={iframeUrl}
              title="MoonPay Widget"
              allow="accelerometer; autoplay; camera; gyroscope; payment"
              className="moonpay-iframe"
            />
          </div>
        </div>
      )}

      <style>{`
        /* ── Advisory block ───────────────────────────────────────────── */
        .ramp-advisory {
          background: rgba(34,211,238,0.08);
          border: 1px solid rgba(34,211,238,0.3);
          border-radius: 10px;
          padding: 1.5rem;
          margin-bottom: 2rem;
        }
        .ramp-advisory h3 {
          color: var(--accent);
          font-size: 1.05rem;
          margin: 0 0 0.75rem;
          padding: 0;
          border: none;
        }
        .ramp-advisory-desc {
          font-size: 0.92rem;
          line-height: 1.65;
          margin-bottom: 1.25rem;
        }
        .ramp-advisory-note {
          font-size: 0.85rem;
          line-height: 1.55;
          margin-top: 1rem;
          margin-bottom: 0;
          color: var(--muted);
        }
        .ramp-advisory-note strong { color: var(--text); }

        /* ── Flow rows ────────────────────────────────────────────────── */
        .ramp-flow-label {
          font-size: 0.8rem;
          font-weight: 700;
          color: var(--accent);
          text-transform: uppercase;
          letter-spacing: 0.06em;
          margin-bottom: 0.5rem;
        }
        .ramp-flow-label--off {
          margin-top: 1rem;
        }
        .ramp-flow {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 0.4rem;
          font-size: 0.88rem;
        }
        .ramp-chip {
          background: rgba(34,211,238,0.12);
          border: 1px solid rgba(34,211,238,0.3);
          border-radius: 6px;
          padding: 0.2rem 0.65rem;
          white-space: nowrap;
          color: var(--text);
        }
        .ramp-chip--off {
          background: rgba(34,211,238,0.07);
          border-color: rgba(34,211,238,0.2);
        }
        .ramp-arrow {
          color: var(--muted);
          font-size: 0.85rem;
        }
        .ramp-flow-link {
          color: var(--accent);
          text-decoration: underline;
          text-underline-offset: 2px;
        }
        .ramp-flow-link--off { color: var(--accent); }

        /* ── Divider ──────────────────────────────────────────────────── */
        .ramp-divider {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 1.5rem;
        }
        .ramp-divider-line {
          flex: 1;
          height: 1px;
          background: rgba(255,255,255,0.08);
        }
        .ramp-divider-label {
          font-size: 0.8rem;
          color: var(--muted);
          white-space: nowrap;
        }

        /* ── Tabs ─────────────────────────────────────────────────────── */
        .ramp-tabs {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 1.5rem;
        }
        .ramp-tab {
          flex: 1;
          padding: 0.75rem 1rem;
          border-radius: 8px;
          font-weight: 600;
          font-size: 0.95rem;
          border: 1px solid rgba(34,211,238,0.25);
          cursor: pointer;
          transition: all 0.2s;
          background: rgba(255,255,255,0.04);
          color: var(--muted);
        }
        .ramp-tab--active {
          background: var(--accent);
          color: #0f172a;
          border-color: var(--accent);
        }
        .ramp-tab:not(.ramp-tab--active):hover {
          border-color: rgba(34,211,238,0.5);
          color: var(--text);
        }

        /* ── Amount input ─────────────────────────────────────────────── */
        .ramp-input-wrap {
          position: relative;
        }
        .ramp-amount-input {
          padding-right: 6rem;
          -moz-appearance: textfield;
        }
        .ramp-amount-input::-webkit-outer-spin-button,
        .ramp-amount-input::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        .ramp-inline-select {
          position: absolute;
          right: 0.5rem;
          top: 50%;
          transform: translateY(-50%);
          width: auto;
          padding: 0.5rem;
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.15);
          border-radius: 6px;
          color: var(--text);
          font-size: 0.9rem;
        }

        /* ── Presale tip ──────────────────────────────────────────────── */
        .ramp-presale-tip {
          background: rgba(34,211,238,0.08);
          border: 1px solid rgba(34,211,238,0.3);
          border-radius: 8px;
          padding: 0.75rem 1rem;
          margin-bottom: 1rem;
          font-size: 0.9rem;
          color: var(--accent);
        }

        /* ── MoonPay info box ─────────────────────────────────────────── */
        .ramp-moonpay-box {
          display: flex;
          align-items: flex-start;
          gap: 1rem;
          background: rgba(17,24,39,0.6);
          border: 1px solid rgba(34,211,238,0.3);
          border-radius: 8px;
          padding: 1rem 1.25rem;
          margin-bottom: 1.5rem;
        }
        .ramp-moonpay-icon {
          width: 48px;
          height: 48px;
          background: linear-gradient(135deg, #60a5fa, #a78bfa);
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          font-size: 1.5rem;
        }
        .ramp-moonpay-title {
          font-weight: 600;
          color: var(--text);
          margin-bottom: 0.25rem;
        }
        .ramp-moonpay-desc {
          font-size: 0.9rem;
          color: var(--muted);
          margin-bottom: 0.4rem;
          line-height: 1.5;
        }
        .ramp-moonpay-badges {
          font-size: 0.8rem;
          color: var(--muted);
        }

        /* ── Disclaimer ───────────────────────────────────────────────── */
        .ramp-disclaimer {
          background: rgba(239,68,68,0.06);
          border: 1px solid rgba(239,68,68,0.3);
          border-radius: 8px;
          padding: 1rem 1.25rem;
          margin-bottom: 1.25rem;
          font-size: 0.85rem;
          line-height: 1.65;
        }
        .ramp-disclaimer p { margin-bottom: 0.6rem; }
        .ramp-disclaimer p:last-of-type { margin-bottom: 0.9rem; }
        .ramp-disclaimer strong { color: var(--text); }
        .ramp-disclaimer-title {
          font-weight: 600;
          color: #f87171;
          margin-bottom: 0.6rem;
          font-size: 0.88rem;
        }
        .ramp-disclaimer-check {
          display: flex;
          align-items: flex-start;
          gap: 0.6rem;
          cursor: pointer;
          font-size: 0.85rem;
        }
        .ramp-disclaimer-check input[type="checkbox"] {
          margin-top: 0.15rem;
          width: 16px;
          height: 16px;
          flex-shrink: 0;
          cursor: pointer;
          accent-color: var(--accent);
        }

        /* ── Submit button ────────────────────────────────────────────── */
        .ramp-submit {
          display: block;
          width: 100%;
          background: var(--accent);
          color: #0f172a;
          border: none;
          border-radius: 8px;
          padding: 0.85rem 1rem;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s, transform 0.2s, box-shadow 0.2s;
        }
        .ramp-submit:hover:not(.ramp-submit--disabled) {
          background: #06b6d4;
          transform: translateY(-1px);
          box-shadow: 0 6px 14px rgba(34,211,238,0.3);
        }
        .ramp-submit--disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* ── Helper text ──────────────────────────────────────────────── */
        .ramp-helper-text {
          text-align: center;
          font-size: 0.9rem;
          color: var(--muted);
          margin-top: 0.75rem;
        }
        .ramp-helper-text--warn { color: #f87171; }

        /* ── Intro reuse ──────────────────────────────────────────────── */
        .intro {
          background: rgba(34,211,238,0.1);
          border-left: 4px solid var(--accent);
          padding: 1.25rem 1.5rem;
          border-radius: 0 8px 8px 0;
        }
        .intro p { margin: 0; font-size: 0.95rem; line-height: 1.7; }

        /* ── MoonPay modal ────────────────────────────────────────────── */
        .moonpay-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          padding: 1rem;
        }
        .moonpay-modal-content {
          position: relative;
          width: 100%;
          max-width: 450px;
          height: 90vh;
          max-height: 700px;
          background: #fff;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);
        }
        .moonpay-modal-close {
          position: absolute;
          top: 0.75rem;
          right: 0.75rem;
          width: 32px;
          height: 32px;
          border: none;
          background: rgba(0,0,0,0.1);
          color: #333;
          border-radius: 50%;
          font-size: 1rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10;
          transition: background 0.2s;
        }
        .moonpay-modal-close:hover { background: rgba(0,0,0,0.2); }
        .moonpay-iframe { width: 100%; height: 100%; border: none; }

        @media (max-width: 560px) {
          .ramp-divider-label { white-space: normal; text-align: center; }
          .ramp-tabs { flex-direction: column; }
        }
      `}</style>
    </main>
  );
}
