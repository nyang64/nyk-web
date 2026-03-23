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

  return (
    <main>
      <div className="card">
        <h2>On / Off Ramp</h2>

        {/* Most Economic Path Advisory */}
        <div style={{
          background: 'rgba(16, 185, 129, 0.07)',
          border: '1px solid rgba(16, 185, 129, 0.35)',
          borderRadius: '10px',
          padding: '1.25rem 1.5rem',
          marginBottom: '2rem',
        }}>
          <h3 style={{ color: '#10b981', marginBottom: '0.75rem', fontSize: '1rem' }}>
            Most Economic Path
          </h3>
          <p style={{ fontSize: '0.9rem', color: 'var(--text)', marginBottom: '1rem', lineHeight: '1.6' }}>
            Credit card and instant-buy services charge 2–5% fees. The cheapest way to move fiat into
            crypto — and back — is via the ACH route below. Fees are typically under 0.5% end-to-end.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            {/* On-ramp */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontWeight: 600, color: '#10b981', fontSize: '0.85rem', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                On-Ramp (Fiat → Crypto)
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem' }}>
                {[
                  { label: 'Bank (USD)', icon: '🏦' },
                  { label: 'ACH Transfer', icon: '→', muted: true },
                  { label: 'CEX (e.g. Coinbase)', icon: '🏛️' },
                  { label: 'Convert to USDC', icon: '→', muted: true },
                  { label: 'Withdraw via Base network', icon: '→', muted: true },
                  { label: 'Self-Custody Wallet', icon: '👛' },
                  { label: 'Aerodrome Swap → ETH', icon: '→', muted: true, link: 'https://aerodrome.finance/swap' },
                ].map((step, i) =>
                  step.muted ? (
                    <span key={i} style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
                      {step.link
                        ? <a href={step.link} target="_blank" rel="noopener noreferrer" style={{ color: '#10b981', textDecoration: 'underline' }}>{step.label}</a>
                        : step.label}
                    </span>
                  ) : (
                    <span key={i} style={{
                      background: 'rgba(16, 185, 129, 0.12)',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      borderRadius: '6px',
                      padding: '0.2rem 0.6rem',
                      fontSize: '0.85rem',
                      whiteSpace: 'nowrap',
                    }}>
                      {step.icon} {step.label}
                    </span>
                  )
                )}
              </div>
            </div>

            {/* Off-ramp */}
            <div>
              <div style={{ fontWeight: 600, color: '#60a5fa', fontSize: '0.85rem', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Off-Ramp (Crypto → Fiat)
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem' }}>
                {[
                  { label: 'Self-Custody Wallet', icon: '👛' },
                  { label: 'Aerodrome Swap → USDC', icon: '→', muted: true, link: 'https://aerodrome.finance/swap' },
                  { label: 'Withdraw to CEX via Base', icon: '→', muted: true },
                  { label: 'CEX (e.g. Coinbase)', icon: '🏛️' },
                  { label: 'Convert USDC → USD', icon: '→', muted: true },
                  { label: 'ACH Transfer', icon: '→', muted: true },
                  { label: 'Bank (USD)', icon: '🏦' },
                ].map((step, i) =>
                  step.muted ? (
                    <span key={i} style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
                      {step.link
                        ? <a href={step.link} target="_blank" rel="noopener noreferrer" style={{ color: '#60a5fa', textDecoration: 'underline' }}>{step.label}</a>
                        : step.label}
                    </span>
                  ) : (
                    <span key={i} style={{
                      background: 'rgba(96, 165, 250, 0.12)',
                      border: '1px solid rgba(96, 165, 250, 0.3)',
                      borderRadius: '6px',
                      padding: '0.2rem 0.6rem',
                      fontSize: '0.85rem',
                      whiteSpace: 'nowrap',
                    }}>
                      {step.icon} {step.label}
                    </span>
                  )
                )}
              </div>
            </div>
          </div>

          <p style={{ fontSize: '0.82rem', color: 'var(--text)', marginTop: '1rem', marginBottom: 0, lineHeight: '1.5' }}>
            Use <strong style={{ color: 'var(--text)' }}>Base network</strong> when withdrawing from the CEX — it has the lowest withdrawal fees
            among all EVM chains. Once USDC is in your wallet, swap to any token on{' '}
            <a href="https://aerodrome.finance/swap" target="_blank" rel="noopener noreferrer" style={{ color: '#10b981' }}>
              Aerodrome Finance
            </a>{' '}
            for the best rates on Base.
          </p>
        </div>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
          <span style={{ fontSize: '0.8rem', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
            Quick option via MoonPay — for small amounts or credit / debit card
          </span>
          <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
        </div>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <button
            type="button"
            onClick={() => setSelectedTab('buy')}
            style={{
              flex: 1,
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s',
              background: selectedTab === 'buy' ? 'var(--accent)' : 'rgba(255, 255, 255, 0.05)',
              color: selectedTab === 'buy' ? '#0f172a' : 'var(--muted)',
            }}
          >
            Buy Crypto
          </button>
          <button
            type="button"
            onClick={() => setSelectedTab('sell')}
            style={{
              flex: 1,
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s',
              background: selectedTab === 'sell' ? 'var(--accent)' : 'rgba(255, 255, 255, 0.05)',
              color: selectedTab === 'sell' ? '#0f172a' : 'var(--muted)',
            }}
          >
            Sell Crypto
          </button>
        </div>

        {/* Transaction Form */}
        <div className="form-container">
          {/* Amount Input */}
          <div className="form-group">
            <label>{selectedTab === 'buy' ? 'You Pay' : 'You Sell'}</label>
            <div style={{ position: 'relative' }}>
              <input
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                style={{ paddingRight: '6rem' }}
              />
              {selectedTab === 'buy' ? (
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  style={{
                    position: 'absolute',
                    right: '0.5rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: 'auto',
                    padding: '0.5rem',
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: '1px solid #374151',
                    borderRadius: '6px',
                    color: 'var(--text)',
                    fontSize: '0.9rem',
                  }}
                >
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                </select>
              ) : (
                <select
                  value={cryptoCurrency}
                  onChange={(e) => setCryptoCurrency(e.target.value)}
                  style={{
                    position: 'absolute',
                    right: '0.5rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: 'auto',
                    padding: '0.5rem',
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: '1px solid #374151',
                    borderRadius: '6px',
                    color: 'var(--text)',
                    fontSize: '0.9rem',
                  }}
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

          {/* Second Selection - Crypto for Buy, Fiat for Sell */}
          <div className="form-group">
            <label>You Receive</label>
            {selectedTab === 'buy' ? (
              <select
                value={cryptoCurrency}
                onChange={(e) => setCryptoCurrency(e.target.value)}
              >
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
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                <option value="USD">US Dollar (USD)</option>
                <option value="EUR">Euro (EUR)</option>
                <option value="GBP">British Pound (GBP)</option>
              </select>
            )}
          </div>

          {/* Presale Tip */}
          {(cryptoCurrency === 'usdc' || cryptoCurrency === 'usdt') && selectedTab === 'buy' && (
            <div style={{
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '8px',
              padding: '0.75rem 1rem',
              marginBottom: '1rem',
              fontSize: '0.9rem',
              color: '#10b981',
            }}>
              You can use {cryptoCurrency.toUpperCase()} to participate in the HLRR presale
            </div>
          )}

          {/* MoonPay Info Box */}
          <div style={{
            background: 'rgba(34, 211, 238, 0.08)',
            border: '1px solid rgba(34, 211, 238, 0.3)',
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '1.5rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
              <div style={{
                width: '48px',
                height: '48px',
                background: 'linear-gradient(135deg, #60a5fa, #a78bfa)',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                fontSize: '1.5rem',
              }}>
                🌙
              </div>
              <div>
                <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Powered by MoonPay</div>
                <div style={{ fontSize: '0.9rem', color: 'var(--muted)', marginBottom: '0.5rem' }}>
                  {selectedTab === 'buy'
                    ? 'Buy crypto instantly with credit card, bank transfer, or Apple Pay'
                    : 'Sell crypto and receive funds directly to your bank account'}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                  ✓ Secure & Compliant • ✓ 150+ Countries • ✓ 24/7 Support
                </div>
              </div>
            </div>
          </div>

          {/* Disclaimer */}
          <div style={{
            background: 'rgba(239, 68, 68, 0.06)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '8px',
            padding: '1rem 1.25rem',
            marginBottom: '1.25rem',
            fontSize: '0.82rem',
            color: 'var(--text)',
            lineHeight: '1.6',
          }}>
            <div style={{ fontWeight: 600, color: '#f87171', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
              Disclaimer — Please Read Before Proceeding
            </div>
            <p style={{ marginBottom: '0.6rem' }}>
              NYK Labs provides a <strong style={{ color: 'var(--text)' }}>pure passthrough</strong> to
              MoonPay's payment widget. We do not collect, store, or have access to any data relating to
              your transactions, identity, payment details, or personal information. All transaction data
              is handled solely by MoonPay under their own privacy policy and terms of service.
            </p>
            <p style={{ marginBottom: '0.6rem' }}>
              Any issues, disputes, failed transactions, refunds, or compliance matters are strictly
              between you and MoonPay. NYK Labs has no ability to intervene, reverse, or assist with
              any MoonPay transaction.
            </p>
            <p style={{ marginBottom: '1rem' }}>
              <strong style={{ color: 'var(--text)' }}>By using this feature, you agree that NYK Labs
              bears no liability whatsoever</strong> for any loss, damage, or inconvenience arising from
              your use of MoonPay's services, including but not limited to transaction failures, incorrect
              amounts, network issues, regulatory holds, or account restrictions imposed by MoonPay.
            </p>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={disclaimerAgreed}
                onChange={(e) => setDisclaimerAgreed(e.target.checked)}
                style={{ marginTop: '0.15rem', width: '16px', height: '16px', flexShrink: 0, cursor: 'pointer', accentColor: 'var(--accent)' }}
              />
              <span>
                I have read and agree to the disclaimer above. I understand that NYK Labs is not responsible
                for any issues arising from my use of MoonPay's services.
              </span>
            </label>
          </div>

          {/* Action Button */}
          <button
            type="submit"
            onClick={handleTransaction}
            disabled={isDisabled}
            style={{
              opacity: isDisabled ? 0.5 : 1,
              cursor: isDisabled ? 'not-allowed' : 'pointer',
            }}
          >
            {selectedTab === 'buy' ? 'Buy with MoonPay' : 'Sell with MoonPay'}
          </button>

          {/* Helper Text */}
          {(!amount || parseFloat(amount) <= 0) && (
            <p style={{
              textAlign: 'center',
              fontSize: '0.9rem',
              color: 'var(--text)',
              marginTop: '0.75rem',
            }}>
              Enter an amount above to continue
            </p>
          )}
          {amount && parseFloat(amount) > 0 && !disclaimerAgreed && (
            <p style={{
              textAlign: 'center',
              fontSize: '0.9rem',
              color: '#f87171',
              marginTop: '0.75rem',
            }}>
              Please read and accept the disclaimer above to continue
            </p>
          )}
        </div>

        {/* Info Box */}
        <div style={{
          marginTop: '1.5rem',
          background: 'rgba(34, 211, 238, 0.05)',
          borderLeft: '4px solid var(--accent)',
          padding: '1rem',
          borderRadius: '0 8px 8px 0',
        }}>
          <h3 style={{ color: 'var(--accent)', marginBottom: '0.5rem', fontSize: '1rem' }}>
            About MoonPay
          </h3>
          <p style={{ fontSize: '0.9rem', color: 'var(--text)', marginBottom: 0 }}>
            Click the button above to open the MoonPay widget. Accepts credit/debit card,
            Apple Pay, Google Pay, and bank transfer in 150+ countries. Convenient for
            small amounts or when you need crypto quickly — no CEX account required.
          </p>
        </div>
      </div>

      {/* MoonPay Modal */}
      {showModal && iframeUrl && (
        <div
          className="moonpay-modal-overlay"
          onClick={closeModal}
        >
          <div
            className="moonpay-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="moonpay-modal-close"
              onClick={closeModal}
              aria-label="Close"
            >
              ✕
            </button>
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
        .form-group input[type="number"]::-webkit-outer-spin-button,
        .form-group input[type="number"]::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        .form-group input[type="number"] {
          -moz-appearance: textfield;
        }

        .moonpay-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.8);
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
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        }

        .moonpay-modal-close {
          position: absolute;
          top: 0.75rem;
          right: 0.75rem;
          width: 32px;
          height: 32px;
          border: none;
          background: rgba(0, 0, 0, 0.1);
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

        .moonpay-modal-close:hover {
          background: rgba(0, 0, 0, 0.2);
        }

        .moonpay-iframe {
          width: 100%;
          height: 100%;
          border: none;
        }
      `}</style>
    </main>
  );
}
