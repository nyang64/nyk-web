import { useState, useEffect, useRef } from 'react';
import type { Route } from "./+types/registration";
import { ethers } from 'ethers';

// Turnstile and Ethereum type declarations
declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: {
        sitekey: string;
        callback: (token: string) => void;
        'error-callback'?: () => void;
      }) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
    ethereum?: {
      request: (args: { method: string; params?: any[] }) => Promise<any>;
      isMetaMask?: boolean;
    };
  }
}

const WALLET_TYPES = ['base app wallet', 'metamask wallet','uniswap wallet','trust wallet'];
const API_URL = 'https://api.nyklabs.com/beta/register';
const NONCE_API_URL = 'https://api.nyklabs.com/beta/nonce';
const TURNSTILE_SITE_KEY = '0x4AAAAAACPZWOY8AcOvJHaV';

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Registration for Airdrop - NYK Labs" },
    { name: "description", content: "Register for the Hashed Lierre airdrop." },
  ];
}

export default function Registration() {
  const [formData, setFormData] = useState({
    email: '',
    wallet: '',
    walletnetwork: WALLET_TYPES[0],
    referredby: '',
    website: '', // Honeypot field for bot detection
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [walletSignature, setWalletSignature] = useState<string | null>(null);
  const [walletNonce, setWalletNonce] = useState<string | null>(null);
  const [walletVerified, setWalletVerified] = useState(false);
  const [verifyingWallet, setVerifyingWallet] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
   
    if (success) {
      setSuccess('');
    } 
    // Reset wallet verification if wallet address changes
    if (name === 'wallet') {
      setWalletVerified(false);
      setWalletSignature(null);
      setWalletNonce(null);
    }
  };

  // Wallet address validation (ethers.js)
  const isValidEthAddress = (addr: string): boolean => {
    try {
      return ethers.isAddress(addr);
    } catch {
      return false;
    }
  };

  // Get nonce from backend
  const getNonce = async (walletAddress: string): Promise<string | null> => {
    try {
      const response = await fetch(`${NONCE_API_URL}?wallet=${encodeURIComponent(walletAddress)}`);
      if (!response.ok) {
        throw new Error('Failed to get nonce from server');
      }
      const data = await response.json();
      return data.nonce;
    } catch (err) {
      console.error('Error getting nonce:', err);
      return null;
    }
  };

  // Request wallet signature
  const verifyWalletOwnership = async () => {
    setVerifyingWallet(true);
    setError('');

    try {
      // Validation 1: Check if address is valid format
      if (!isValidEthAddress(formData.wallet)) {
        setError('Invalid Ethereum address format');
        setVerifyingWallet(false);
        return;
      }

      // Check if MetaMask is installed
      if (!window.ethereum) {
        setError('Please install your wallet extension or another Web3 wallet to verify wallet ownership');
        setVerifyingWallet(false);
        return;
      }

      // Step 1: Request account access (connect wallet)
      let accounts;
      try {
        accounts = await window.ethereum.request({ 
          method: 'eth_requestAccounts' 
        });
      } catch (err: any) {
        if (err.code === 4001) {
          setError('Wallet connection rejected. Please connect your wallet to continue.');
        } else {
          setError('Failed to connect to Wallet: ' + err.message);
        }
        setVerifyingWallet(false);
        return;
      }

      // Verify the connected account matches the entered wallet
      const connectedWallet = accounts[0];
      if (connectedWallet.toLowerCase() !== formData.wallet.toLowerCase()) {
        setError(`Connected wallet (${connectedWallet}) does not match entered wallet (${formData.wallet}). Please connect the correct wallet.`);
        setVerifyingWallet(false);
        return;
      }

      // Step 2: Get nonce from backend
      const nonce = await getNonce(formData.wallet);
      if (!nonce) {
        setError('Failed to get verification nonce from server');
        setVerifyingWallet(false);
        return;
      }
      setWalletNonce(nonce);

      // Step 3: Create message to sign
      const message = `Sign this message to verify wallet ownership.\n\nNonce: ${nonce}\nWallet: ${formData.wallet}`;

      // Step 4: Request signature from wallet
      const signature = await window.ethereum.request({
        method: 'personal_sign',
        params: [message, formData.wallet],
      });

      setWalletSignature(signature);
      setWalletVerified(true);
      setError('');
    } catch (err: any) {
      console.error('Error verifying wallet:', err);
      if (err.code === 4001) {
        setError('Wallet verification cancelled by user');
      } else {
        setError('Failed to verify wallet ownership: ' + (err.message || 'Unknown error'));
      }
      setWalletVerified(false);
      setWalletSignature(null);
    } finally {
      setVerifyingWallet(false);
    }
  };

  // Initialize Turnstile widget
  useEffect(() => {
    // Wait for Turnstile to be loaded
    const initTurnstile = () => {
      if (window.turnstile && turnstileRef.current && !widgetIdRef.current) {
        console.log('Initializing Turnstile widget...');
        try {
          widgetIdRef.current = window.turnstile.render(turnstileRef.current, {
            sitekey: TURNSTILE_SITE_KEY,
            callback: (token: string) => {
              console.log('Turnstile token received');
              setTurnstileToken(token);
              setError(''); // Clear any previous errors when token is received
            },
            'error-callback': () => {
              // Only set error if user is actively trying to submit
              // Don't show error during initial load/render
              console.warn('Turnstile error callback triggered');
              setTurnstileToken(null);
            },
          });
          console.log('Turnstile widget initialized with ID:', widgetIdRef.current);
        } catch (err) {
          console.error('Error initializing Turnstile:', err);
        }
      }
    };

    // Check if Turnstile is already loaded
    if (window.turnstile) {
      initTurnstile();
    } else {
      // Wait for Turnstile to load
      const checkTurnstile = setInterval(() => {
        if (window.turnstile) {
          clearInterval(checkTurnstile);
          initTurnstile();
        }
      }, 100);

      return () => clearInterval(checkTurnstile);
    }

    // Cleanup
    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, []);

  // Email validation regex
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
  };

  // Wallet address validation (must be exactly 42 characters for EVM addresses)
  const validateWallet = (wallet: string): boolean => {
    return wallet.length === 42 && wallet.startsWith('0x');
  };

  // Referral code validation (must be 8 characters or empty)
  const validateReferralCode = (code: string): boolean => {
    return code === '' || code.length === 8;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    // Check for Turnstile token
    if (!turnstileToken) {
      setError('Please complete the verification challenge before submitting');
      setLoading(false);
      return;
    }

    // Check for wallet verification
    if (!walletVerified || !walletSignature || !walletNonce) {
      setError('Please verify wallet ownership before submitting');
      setLoading(false);
      return;
    }

    // Bot detection - if honeypot field is filled, reject
    if (formData.website) {
      setError('Invalid submission detected');
      setLoading(false);
      return;
    }

    // Validate required fields
    if (!formData.email || !formData.wallet) {
      setError('Email and Wallet are required');
      setLoading(false);
      return;
    }

    // Validate email format
    if (!validateEmail(formData.email)) {
      setError('Please enter a valid email address');
      setLoading(false);
      return;
    }

    // Validate email length
    if (formData.email.length > 48) {
      setError('Email address must be less than 48 characters');
      setLoading(false);
      return;
    }

    // Validate wallet address
    if (!validateWallet(formData.wallet)) {
      setError('Wallet address must be exactly 42 characters and start with 0x');
      setLoading(false);
      return;
    }

    // Validate referral code
    if (!validateReferralCode(formData.referredby)) {
      setError('Referral code must be exactly 8 characters or left blank');
      setLoading(false);
      return;
    }

    try {
      // Don't send the honeypot field to the API
      const { website, ...submitData } = formData;
      
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...submitData,
          turnstileToken: turnstileToken, // Include Turnstile token
          walletSignature: walletSignature, // Include wallet signature
          walletNonce: walletNonce, // Include nonce for backend verification
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Registration failed');
      }

      const data = await response.json();
      setSuccess(`Your registration is pending email verification! Please check your email. Your referral code: ${data.referralcode}; give this code to your friends so both can earn more airdrops. Follow up on X and Discord for announcement when and how to claim your airdrop`);
      setFormData({
        email: '',
        wallet: '',
        walletnetwork: WALLET_TYPES[0],
        referredby: '',
        website: '',
      });
      // Reset Turnstile
      setTurnstileToken(null);
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.reset(widgetIdRef.current);
      }
      // Reset wallet verification
      setWalletVerified(false);
      setWalletSignature(null);
      setWalletNonce(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
      // Reset Turnstile on error
      setTurnstileToken(null);
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.reset(widgetIdRef.current);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main>
      <section className="card">
        <h2>Hashed Lierre Token (HLRR) Airdrop Registration</h2>
        <h3>Claim your FREE HLRR tokens before it is too late</h3>
        <div className="form-container">
          <div><p>
          Fill in the form with your email address, and wallet number along with its network. You will not get any airdrops if your wallet cannot connect to the network you selected.</p>
          </div>
          <form onSubmit={handleSubmit}>
            {/* Honeypot field - hidden from users but visible to bots */}
            <div className="honeypot">
              <label htmlFor="website">Website (leave blank):</label>
              <input
                type="text"
                id="website"
                name="website"
                value={formData.website}
                onChange={handleChange}
                tabIndex={-1}
                autoComplete="off"
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="email">Email: (gmail preferred; yahoo email may not work)</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                disabled={loading}
                maxLength={48}
              />
            </div>
            <div className="form-group">
              <label htmlFor="wallet">Wallet Address:</label>
              <input
                type="text"
                id="wallet"
                name="wallet"
                value={formData.wallet}
                onChange={handleChange}
                required
                disabled={loading || verifyingWallet}
                maxLength={42}
                placeholder="0x..."
              />
              <button
                type="button"
                onClick={verifyWalletOwnership}
                disabled={!formData.wallet || verifyingWallet || loading || walletVerified}
                className="verify-wallet-btn"
              >
                {verifyingWallet ? 'Verifying...' : walletVerified ? '✓ Wallet Verified' : 'Verify Wallet Ownership'}
              </button>
              {walletVerified && (
                <p className="wallet-verified-msg">✓ Wallet ownership verified successfully</p>
              )}
            </div>
            <div className="form-group">
              <label htmlFor="walletnetwork">Wallet Type:</label>
              <select
                id="walletnetwork"
                name="walletnetwork"
                value={formData.walletnetwork}
                onChange={handleChange}
                disabled={loading}
              >
                {WALLET_TYPES.map((net) => (
                  <option key={net} value={net}>
                    {net.charAt(0).toUpperCase() + net.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="referredby">Referral Code (Optional):</label>
              <input
                type="text"
                id="referredby"
                name="referredby"
                value={formData.referredby}
                onChange={handleChange}
                disabled={loading}
                maxLength={8}
                placeholder="8 characters"
              />
            </div>
            
            {/* Turnstile CAPTCHA */}
            <div className="form-group turnstile-container">
              <div ref={turnstileRef}></div>
              {!turnstileToken && (
                <p style={{ fontSize: '0.9rem', color: 'var(--muted)', marginTop: '0.5rem', textAlign: 'center' }}>
                  Complete the verification above to enable registration
                </p>
              )}
            </div>
            
            <button type="submit" disabled={loading}>
              {loading ? 'Registering...' : 'Register'}
            </button>
          </form>
          {error && <p className="error-message">{error}</p>}
          {success && <p className="success-message">{success}</p>}
        </div>
      </section>

      <style>{`
        /* Honeypot field - hidden from users but visible to bots */
        .honeypot {
          position: absolute;
          left: -9999px;
          width: 1px;
          height: 1px;
          overflow: hidden;
        }
        
        /* Wallet verification button */
        .verify-wallet-btn {
          margin-top: 0.75rem;
          padding: 0.75rem 1.5rem;
          background: linear-gradient(135deg, var(--accent), #06b6d4);
          color: #0f172a;
          border: none;
          border-radius: 6px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          width: 100%;
        }
        
        .verify-wallet-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(34, 211, 238, 0.4);
        }
        
        .verify-wallet-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
        }
        
        .verify-wallet-btn:active:not(:disabled) {
          transform: translateY(0);
        }
        
        .wallet-verified-msg {
          margin-top: 0.5rem;
          color: #10b981;
          font-size: 0.9rem;
          font-weight: 600;
          text-align: center;
        }
        
        /* Turnstile widget container */
        .turnstile-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin: 1.5rem 0;
        }
        
        /* Style the button to show disabled state when Turnstile not completed */
        button[type="submit"]:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </main>
  );
}
