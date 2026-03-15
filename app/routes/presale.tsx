import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import type { Route } from "./+types/presale";
import { useWallet } from "../hooks/useWallet";
import type { EIP6963ProviderDetail } from "../hooks/useWallet";
import { WalletPickerModal } from "../components/WalletPickerModal";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Hashed Lierre Presale | NYK Labs" },
    { name: "description", content: "Participate in the Hashed Lierre (HLRR) token presale on BASE network. Send USDC or ETH to receive HLRR tokens." },
  ];
}

// Presale configuration
const HLRR_PRICE_USD = 0.075; // $0.075 per HLRR

// Contract addresses from environment
const CONTRACTS = {
  HLRR: import.meta.env.VITE_HLRR_TOKEN_ADDRESS,
  USDC: import.meta.env.VITE_USDC_ADDRESS,
  ETH_USD_PRICE_FEED: import.meta.env.VITE_ETH_USD_PRICE_FEED,
};

// ABIs
const HLRR_ABI = [
  "function buyPresale(uint256 usdcAmount) external",
  "function buyPresaleWithEth() external payable",
  "function calculatePresaleReturn(uint256 usdcAmount) external pure returns (uint256 hlrrAmount)",
  "function presaleActive() external view returns (bool)",
  "function presaleMinPurchase() external view returns (uint256)",
  "function presaleMaxPurchase() external view returns (uint256)",
  "function getPresaleStats() external view returns (bool isActive, uint256 totalRaised, uint256 totalSold, uint256 hardCap, uint256 remainingCap)",
  "function getPresaleContribution(address user) external view returns (uint256 contribution)",
];

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
];

const CHAINLINK_ABI = [
  "function latestRoundData() external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
];

const PRESALE_CONFIG = {
  hlrrPriceUsd: HLRR_PRICE_USD,
  minContributionUsd: 50,     // Minimum $50
  maxContributionUsd: 50000,  // Maximum $50,000
  expectedChainId: Number(import.meta.env.VITE_CHAIN_ID),
  networkName: import.meta.env.VITE_NETWORK_NAME,
  blockExplorer: import.meta.env.VITE_BLOCK_EXPLORER,
};

type PaymentCurrency = 'USDC' | 'ETH';

type TransactionStatus =
  | { type: 'idle' }
  | { type: 'connecting' }
  | { type: 'checking' }
  | { type: 'approving'; hash?: string }
  | { type: 'purchasing'; hash?: string }
  | { type: 'success'; hash: string; hlrrAmount: string }
  | { type: 'error'; message: string };

export default function Presale() {
  const {
    connectedAddress,
    chainId,
    discoveredWallets,
    showWalletPicker,
    setShowWalletPicker,
    getEthereum,
    connectWithProvider: walletConnectWithProvider,
    connectWallet: walletConnect,
    disconnectWallet: walletDisconnect,
  } = useWallet();

  const [paymentCurrency, setPaymentCurrency] = useState<PaymentCurrency>('USDC');
  const [contributionAmount, setContributionAmount] = useState('');

  // Balances
  const [usdcBalance, setUsdcBalance] = useState<string | null>(null);
  const [ethBalance, setEthBalance] = useState<string | null>(null);
  const [usdcAllowance, setUsdcAllowance] = useState<string | null>(null);
  const [wrongNetwork, setWrongNetwork] = useState(false);

  // ETH Price
  const [ethPriceUsd, setEthPriceUsd] = useState<number | null>(null);
  const [priceLastUpdated, setPriceLastUpdated] = useState<Date | null>(null);

  // Presale state
  const [presaleStats, setPresaleStats] = useState<{
    isActive: boolean;
    totalRaised: string;
    totalSold: string;
    remainingCap: string;
  } | null>(null);
  const [userContribution, setUserContribution] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<TransactionStatus>({ type: 'idle' });

  // Calculate HLRR amount based on payment currency
  const calculateHlrrAmount = useCallback(() => {
    if (!contributionAmount || parseFloat(contributionAmount) <= 0) return '0';

    const amount = parseFloat(contributionAmount);

    if (paymentCurrency === 'USDC') {
      // 1 USDC = $1, so HLRR = amount / 0.075
      return (amount / HLRR_PRICE_USD).toLocaleString(undefined, { maximumFractionDigits: 2 });
    } else {
      // ETH: Convert ETH to USD, then to HLRR
      if (!ethPriceUsd) return '...';
      const usdValue = amount * ethPriceUsd;
      return (usdValue / HLRR_PRICE_USD).toLocaleString(undefined, { maximumFractionDigits: 2 });
    }
  }, [contributionAmount, paymentCurrency, ethPriceUsd]);

  const estimatedHLRR = calculateHlrrAmount();

  // Calculate USD value of contribution
  const contributionUsdValue = paymentCurrency === 'USDC'
    ? parseFloat(contributionAmount || '0')
    : (ethPriceUsd ? parseFloat(contributionAmount || '0') * ethPriceUsd : 0);

  const isValidAmount = contributionAmount &&
    contributionUsdValue >= PRESALE_CONFIG.minContributionUsd &&
    contributionUsdValue <= PRESALE_CONFIG.maxContributionUsd;

  const currentBalance = paymentCurrency === 'USDC' ? usdcBalance : ethBalance;
  const hasInsufficientBalance = currentBalance !== null &&
    contributionAmount &&
    parseFloat(contributionAmount) > parseFloat(currentBalance);

  const needsApproval = paymentCurrency === 'USDC' &&
    usdcAllowance !== null &&
    contributionAmount &&
    parseFloat(contributionAmount) > parseFloat(usdcAllowance);

  // Fetch ETH price from Chainlink
  const fetchEthPrice = useCallback(async () => {
    const ethereum = getEthereum();
    if (!ethereum) return;

    try {
      const provider = new ethers.BrowserProvider(ethereum);
      const priceFeed = new ethers.Contract(CONTRACTS.ETH_USD_PRICE_FEED, CHAINLINK_ABI, provider);
      const [, answer] = await priceFeed.latestRoundData();
      const price = Number(answer) / 1e8; // Chainlink uses 8 decimals
      setEthPriceUsd(price);
      setPriceLastUpdated(new Date());
    } catch (err) {
      console.error('Error fetching ETH price:', err);
    }
  }, []);

  // Fetch ETH price on mount and periodically
  useEffect(() => {
    fetchEthPrice();
    const interval = setInterval(fetchEthPrice, 30000);
    return () => clearInterval(interval);
  }, [fetchEthPrice]);

  // Fetch balances / presale info when wallet connects or chain changes
  useEffect(() => {
    if (connectedAddress) {
      fetchUsdcBalance();
      fetchEthBalance();
      fetchUsdcAllowance();
      fetchPresaleStats();
      fetchUserContribution();
    } else {
      setUsdcBalance(null);
      setEthBalance(null);
      setUsdcAllowance(null);
      setWrongNetwork(false);
      setPresaleStats(null);
      setUserContribution(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectedAddress, chainId]);

  const connectWithProvider = async (detail: EIP6963ProviderDetail) => {
    setTxStatus({ type: 'connecting' });
    try {
      await walletConnectWithProvider(detail);
      setTxStatus({ type: 'idle' });
    } catch (err: unknown) {
      const error = err as { code?: number };
      setTxStatus({ type: 'error', message: error.code === 4001 ? 'Connection rejected.' : 'Failed to connect wallet' });
    }
  };

  const connectWallet = async () => {
    setTxStatus({ type: 'connecting' });
    try {
      await walletConnect();
      // If picker was shown (multiple wallets), connectWallet returns null — status stays 'connecting'
      // until the user picks a wallet via connectWithProvider above.
      setTxStatus({ type: 'idle' });
    } catch (err: unknown) {
      const error = err as { code?: number; message?: string };
      setTxStatus({ type: 'error', message: error.code === 4001 ? 'Connection rejected.' : (error.message || 'Failed to connect wallet') });
    }
  };

  const fetchUsdcBalance = async () => {
    const ethereum = getEthereum();
    if (!ethereum || !connectedAddress) return;

    try {
      const provider = new ethers.BrowserProvider(ethereum);
      const network = await provider.getNetwork();
      if (Number(network.chainId) !== PRESALE_CONFIG.expectedChainId) {
        setWrongNetwork(true);
        setUsdcBalance(null);
        setEthBalance(null);
        return;
      }
      setWrongNetwork(false);
      const usdcContract = new ethers.Contract(CONTRACTS.USDC, ERC20_ABI, provider);
      const balance = await usdcContract.balanceOf(connectedAddress);
      setUsdcBalance(ethers.formatUnits(balance, 6));
    } catch (err) {
      console.error('Error fetching USDC balance:', err);
      setUsdcBalance(null);
    }
  };

  const fetchEthBalance = async () => {
    const ethereum = getEthereum();
    if (!ethereum || !connectedAddress) return;

    try {
      const provider = new ethers.BrowserProvider(ethereum);
      const balance = await provider.getBalance(connectedAddress);
      setEthBalance(ethers.formatEther(balance));
    } catch (err) {
      console.error('Error fetching ETH balance:', err);
      setEthBalance(null);
    }
  };

  const fetchUsdcAllowance = async () => {
    const ethereum = getEthereum();
    if (!ethereum || !connectedAddress) return;

    try {
      const provider = new ethers.BrowserProvider(ethereum);
      const usdcContract = new ethers.Contract(CONTRACTS.USDC, ERC20_ABI, provider);
      const allowance = await usdcContract.allowance(connectedAddress, CONTRACTS.HLRR);
      setUsdcAllowance(ethers.formatUnits(allowance, 6));
    } catch (err) {
      console.error('Error fetching USDC allowance:', err);
      setUsdcAllowance(null);
    }
  };

  const fetchPresaleStats = async () => {
    const ethereum = getEthereum();
    if (!ethereum) return;

    try {
      const provider = new ethers.BrowserProvider(ethereum);
      const hlrrContract = new ethers.Contract(CONTRACTS.HLRR, HLRR_ABI, provider);
      const stats = await hlrrContract.getPresaleStats();
      setPresaleStats({
        isActive: stats.isActive,
        totalRaised: ethers.formatUnits(stats.totalRaised, 6),
        totalSold: ethers.formatUnits(stats.totalSold, 8),
        remainingCap: ethers.formatUnits(stats.remainingCap, 6),
      });
    } catch (err) {
      console.error('Error fetching presale stats:', err);
    }
  };

  const fetchUserContribution = async () => {
    const ethereum = getEthereum();
    if (!ethereum || !connectedAddress) return;

    try {
      const provider = new ethers.BrowserProvider(ethereum);
      const hlrrContract = new ethers.Contract(CONTRACTS.HLRR, HLRR_ABI, provider);
      const contribution = await hlrrContract.getPresaleContribution(connectedAddress);
      setUserContribution(ethers.formatUnits(contribution, 6));
    } catch (err) {
      console.error('Error fetching user contribution:', err);
    }
  };

  const handleBuyWithUsdc = async () => {
    const ethereum = getEthereum();
    if (!ethereum || !connectedAddress || !contributionAmount) return;

    setTxStatus({ type: 'checking' });

    try {
      const provider = new ethers.BrowserProvider(ethereum);

      // Check network
      const network = await provider.getNetwork();
      if (Number(network.chainId) !== PRESALE_CONFIG.expectedChainId) {
        setTxStatus({
          type: 'error',
          message: `Please switch to ${PRESALE_CONFIG.networkName}. Current network: ${network.name || 'Unknown'}`
        });
        return;
      }

      const signer = await provider.getSigner();
      const usdcContract = new ethers.Contract(CONTRACTS.USDC, ERC20_ABI, signer);
      const hlrrContract = new ethers.Contract(CONTRACTS.HLRR, HLRR_ABI, signer);

      // Convert amount to USDC units (6 decimals)
      const usdcAmount = ethers.parseUnits(contributionAmount, 6);

      // Check if approval is needed
      const currentAllowance = await usdcContract.allowance(connectedAddress, CONTRACTS.HLRR);

      if (currentAllowance < usdcAmount) {
        setTxStatus({ type: 'approving' });
        const approveTx = await usdcContract.approve(CONTRACTS.HLRR, usdcAmount);
        setTxStatus({ type: 'approving', hash: approveTx.hash });
        // Wait for 2 confirmations so load-balanced RPC nodes are consistent
        await approveTx.wait(2);
        // Re-read allowance to confirm state is propagated before buying
        const confirmedAllowance = await usdcContract.allowance(connectedAddress, CONTRACTS.HLRR);
        if (confirmedAllowance < usdcAmount) {
          throw new Error('Approval is still propagating. Please try again in a moment.');
        }
      }

      // Buy presale tokens
      setTxStatus({ type: 'purchasing' });
      const buyTx = await hlrrContract.buyPresale(usdcAmount);
      setTxStatus({ type: 'purchasing', hash: buyTx.hash });
      const receipt = await buyTx.wait();

      // Check if transaction was successful
      if (receipt.status === 0) {
        throw new Error('Transaction reverted on-chain');
      }

      // Calculate HLRR received
      const hlrrReceived = (parseFloat(contributionAmount) / HLRR_PRICE_USD).toFixed(2);

      setTxStatus({ type: 'success', hash: buyTx.hash, hlrrAmount: hlrrReceived });
      setContributionAmount('');

      // Delay refresh so RPC nodes have time to reflect the confirmed tx
      setTimeout(() => {
        fetchUsdcBalance();
        fetchUsdcAllowance();
        fetchPresaleStats();
        fetchUserContribution();
      }, 3000);

    } catch (err: unknown) {
      handleTransactionError(err);
    }
  };

  const handleBuyWithEth = async () => {
    const ethereum = getEthereum();
    if (!ethereum || !connectedAddress || !contributionAmount || !ethPriceUsd) return;

    setTxStatus({ type: 'checking' });

    try {
      const provider = new ethers.BrowserProvider(ethereum);

      // Check network
      const network = await provider.getNetwork();
      if (Number(network.chainId) !== PRESALE_CONFIG.expectedChainId) {
        setTxStatus({
          type: 'error',
          message: `Please switch to ${PRESALE_CONFIG.networkName}. Current network: ${network.name || 'Unknown'}`
        });
        return;
      }

      const signer = await provider.getSigner();
      const hlrrContract = new ethers.Contract(CONTRACTS.HLRR, HLRR_ABI, signer);

      // Convert ETH amount to wei
      const ethAmount = ethers.parseEther(contributionAmount);

      // Buy presale tokens with ETH
      setTxStatus({ type: 'purchasing' });
      const buyTx = await hlrrContract.buyPresaleWithEth({ value: ethAmount });
      setTxStatus({ type: 'purchasing', hash: buyTx.hash });
      const receipt = await buyTx.wait();

      // Check if transaction was successful
      if (receipt.status === 0) {
        throw new Error('Transaction reverted on-chain. Please check if ETH price feed is configured.');
      }

      // Calculate HLRR received
      const usdValue = parseFloat(contributionAmount) * ethPriceUsd;
      const hlrrReceived = (usdValue / HLRR_PRICE_USD).toFixed(2);

      setTxStatus({ type: 'success', hash: buyTx.hash, hlrrAmount: hlrrReceived });
      setContributionAmount('');

      setTimeout(() => {
        fetchEthBalance();
        fetchPresaleStats();
        fetchUserContribution();
      }, 3000);

    } catch (err: unknown) {
      handleTransactionError(err);
    }
  };

  const handleTransactionError = (err: unknown) => {
    const error = err as { code?: string; message?: string; reason?: string };
    console.error('Transaction error:', error);

    if (error.code === 'ACTION_REJECTED' || error.code === '4001') {
      setTxStatus({ type: 'error', message: 'Transaction rejected by user' });
    } else if (error.reason) {
      setTxStatus({ type: 'error', message: error.reason });
    } else if (error.message?.includes('insufficient funds')) {
      setTxStatus({ type: 'error', message: `Insufficient ${paymentCurrency} balance` });
    } else if (error.message?.includes('Presale not active')) {
      setTxStatus({ type: 'error', message: 'Presale is not currently active' });
    } else {
      setTxStatus({ type: 'error', message: error.message || 'Transaction failed' });
    }
  };

  const handlePurchase = () => {
    if (paymentCurrency === 'USDC') {
      handleBuyWithUsdc();
    } else {
      handleBuyWithEth();
    }
  };

  const shortenAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const disconnectWallet = () => {
    walletDisconnect();
    setContributionAmount('');
    setTxStatus({ type: 'idle' });
    // Presale-specific state is cleared by the connectedAddress useEffect above
  };

  const isButtonDisabled =
    !connectedAddress ||
    !isValidAmount ||
    hasInsufficientBalance ||
    (paymentCurrency === 'ETH' && !ethPriceUsd) ||
    (presaleStats && !presaleStats.isActive) ||
    txStatus.type === 'connecting' ||
    txStatus.type === 'checking' ||
    txStatus.type === 'approving' ||
    txStatus.type === 'purchasing';

  const getButtonText = () => {
    if (txStatus.type === 'checking') return 'Checking...';
    if (txStatus.type === 'approving') return 'Approving USDC...';
    if (txStatus.type === 'purchasing') return 'Purchasing HLRR...';
    if (paymentCurrency === 'USDC' && needsApproval) {
      return `Approve & Buy ${contributionAmount || '0'} USDC`;
    }
    return `Buy with ${contributionAmount || '0'} ${paymentCurrency}`;
  };

  // Min/max in current currency
  const minInCurrency = paymentCurrency === 'USDC'
    ? PRESALE_CONFIG.minContributionUsd
    : (ethPriceUsd ? (PRESALE_CONFIG.minContributionUsd / ethPriceUsd).toFixed(4) : '...');
  const maxInCurrency = paymentCurrency === 'USDC'
    ? PRESALE_CONFIG.maxContributionUsd.toLocaleString()
    : (ethPriceUsd ? (PRESALE_CONFIG.maxContributionUsd / ethPriceUsd).toFixed(4) : '...');

  return (
    <main>
      <div className="card">
        <h2>Hashed Lierre (HLRR) Presale</h2>
        <p style={{ marginBottom: '1.5rem' }}>
          Participate in the HLRR token presale on {PRESALE_CONFIG.networkName}. Connect your wallet and purchase HLRR tokens with USDC or ETH.
        </p>

        {/* Presale Rate */}
        <div style={{
          background: 'rgba(34, 211, 238, 0.08)',
          border: '1px solid rgba(34, 211, 238, 0.3)',
          borderRadius: '8px',
          padding: '1.25rem',
          marginBottom: '1.5rem',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '0.5rem' }}>Presale Price</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--accent)', marginBottom: '0.5rem' }}>
            1 HLRR = ${PRESALE_CONFIG.hlrrPriceUsd}
          </div>
          {ethPriceUsd && (
            <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
              ETH Price: ${ethPriceUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              {priceLastUpdated && (
                <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem' }}>
                  (updated {priceLastUpdated.toLocaleTimeString()})
                </span>
              )}
            </div>
          )}
        </div>

        {/* Presale Stats */}
        {presaleStats && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '0.75rem',
            marginBottom: '1.5rem',
          }}>
            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid #1f2937',
              borderRadius: '8px',
              padding: '0.75rem',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '0.25rem' }}>Status</div>
              <div style={{
                fontSize: '0.9rem',
                fontWeight: 600,
                color: presaleStats.isActive ? '#10b981' : '#ef4444',
              }}>
                {presaleStats.isActive ? 'Active' : 'Inactive'}
              </div>
            </div>
            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid #1f2937',
              borderRadius: '8px',
              padding: '0.75rem',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '0.25rem' }}>Raised</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                ${parseFloat(presaleStats.totalRaised).toLocaleString()}
              </div>
            </div>
            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid #1f2937',
              borderRadius: '8px',
              padding: '0.75rem',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '0.25rem' }}>HLRR Sold</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                {parseFloat(presaleStats.totalSold).toLocaleString()}
              </div>
            </div>
            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid #1f2937',
              borderRadius: '8px',
              padding: '0.75rem',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '0.25rem' }}>Remaining</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                ${parseFloat(presaleStats.remainingCap).toLocaleString()}
              </div>
            </div>
          </div>
        )}

        {/* Wallet Picker Modal */}
        {showWalletPicker && (
          <WalletPickerModal
            wallets={discoveredWallets}
            onSelect={connectWithProvider}
            onClose={() => setShowWalletPicker(false)}
          />
        )}

        {/* Wrong Network Warning */}
        {wrongNetwork && connectedAddress && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: '8px',
            padding: '0.85rem 1rem',
            marginBottom: '1rem',
            fontSize: '0.9rem',
            color: '#f87171',
          }}>
            Wrong network detected. Please switch your wallet to <strong>{PRESALE_CONFIG.networkName}</strong> to see your balances and participate in the presale.
          </div>
        )}

        {/* Wallet Connection */}
        <div style={{
          background: 'var(--card)',
          border: '1px solid #374151',
          borderRadius: '8px',
          padding: '1rem',
          marginBottom: '1.5rem',
        }}>
          {connectedAddress ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '0.25rem' }}>Connected Wallet</div>
                  <div style={{ fontFamily: 'monospace', color: 'var(--accent)' }}>{shortenAddress(connectedAddress)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '0.25rem' }}>Balances</div>
                  <div style={{ fontSize: '0.9rem' }}>
                    <span style={{ fontWeight: 600 }}>{usdcBalance !== null ? parseFloat(usdcBalance).toLocaleString(undefined, { maximumFractionDigits: 2 }) : '...'}</span> USDC
                    <span style={{ margin: '0 0.5rem', color: 'var(--muted)' }}>|</span>
                    <span style={{ fontWeight: 600 }}>{ethBalance !== null ? parseFloat(ethBalance).toFixed(4) : '...'}</span> ETH
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={discoveredWallets.length > 1 ? () => setShowWalletPicker(true) : disconnectWallet}
                style={{
                  width: '100%',
                  padding: '0.5rem 1rem',
                  background: 'transparent',
                  color: 'var(--muted)',
                  border: '1px solid #374151',
                  borderRadius: '6px',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.borderColor = 'var(--accent)';
                  e.currentTarget.style.color = 'var(--accent)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.borderColor = '#374151';
                  e.currentTarget.style.color = 'var(--muted)';
                }}
              >
                {discoveredWallets.length > 1 ? 'Switch Wallet' : 'Change Wallet'}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={connectWallet}
              disabled={txStatus.type === 'connecting'}
              style={{
                width: '100%',
                padding: '0.875rem 1.5rem',
                background: 'var(--accent)',
                color: '#0f172a',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '1rem',
                cursor: txStatus.type === 'connecting' ? 'not-allowed' : 'pointer',
                opacity: txStatus.type === 'connecting' ? 0.7 : 1,
              }}
            >
              {txStatus.type === 'connecting' ? 'Connecting...' : 'Connect Wallet'}
            </button>
          )}
        </div>

        {/* User's Previous Contribution */}
        {userContribution && parseFloat(userContribution) > 0 && (
          <div style={{
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '8px',
            padding: '0.75rem 1rem',
            marginBottom: '1.5rem',
            fontSize: '0.9rem',
          }}>
            <span style={{ color: '#10b981' }}>Your total contribution:</span>{' '}
            <strong>${parseFloat(userContribution).toLocaleString()} USD</strong>
          </div>
        )}

        {/* Purchase Form */}
        {connectedAddress && (
          <div className="form-container">
            <h3 style={{ color: 'var(--accent)', marginBottom: '1rem', fontSize: '1.1rem' }}>
              Purchase HLRR
            </h3>

            {/* Currency Selection */}
            <div className="form-group">
              <label>Payment Currency</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => { setPaymentCurrency('USDC'); setContributionAmount(''); }}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    borderRadius: '8px',
                    border: paymentCurrency === 'USDC' ? '2px solid var(--accent)' : '1px solid #374151',
                    background: paymentCurrency === 'USDC' ? 'rgba(34, 211, 238, 0.1)' : 'transparent',
                    color: paymentCurrency === 'USDC' ? 'var(--accent)' : 'var(--muted)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  USDC
                </button>
                <button
                  type="button"
                  onClick={() => { setPaymentCurrency('ETH'); setContributionAmount(''); }}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    borderRadius: '8px',
                    border: paymentCurrency === 'ETH' ? '2px solid var(--accent)' : '1px solid #374151',
                    background: paymentCurrency === 'ETH' ? 'rgba(34, 211, 238, 0.1)' : 'transparent',
                    color: paymentCurrency === 'ETH' ? 'var(--accent)' : 'var(--muted)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  ETH
                </button>
              </div>
            </div>

            {/* Contribution Amount */}
            <div className="form-group">
              <label>
                {paymentCurrency} Amount
                <span style={{ color: 'var(--muted)', fontWeight: 400, marginLeft: '0.5rem' }}>
                  (Min: {minInCurrency} / Max: {maxInCurrency} {paymentCurrency})
                </span>
              </label>
              <input
                type="number"
                placeholder="0.00"
                value={contributionAmount}
                onChange={(e) => setContributionAmount(e.target.value)}
                step="any"
              />
              {hasInsufficientBalance && (
                <p style={{ color: '#ef4444', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                  Insufficient {paymentCurrency} balance
                </p>
              )}
              {paymentCurrency === 'ETH' && contributionAmount && ethPriceUsd && (
                <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                  ≈ ${(parseFloat(contributionAmount) * ethPriceUsd).toLocaleString(undefined, { maximumFractionDigits: 2 })} USD
                </p>
              )}
            </div>

            {/* HLRR Estimate */}
            {contributionAmount && parseFloat(contributionAmount) > 0 && (
              <div style={{
                background: 'rgba(34, 211, 238, 0.1)',
                borderLeft: '4px solid var(--accent)',
                padding: '1rem',
                borderRadius: '0 8px 8px 0',
                marginBottom: '1rem',
              }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>You will receive</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--accent)' }}>
                  {estimatedHLRR} HLRR
                </div>
              </div>
            )}

            {/* Approval Notice */}
            {needsApproval && isValidAmount && !hasInsufficientBalance && (
              <div style={{
                background: 'rgba(251, 191, 36, 0.1)',
                border: '1px solid rgba(251, 191, 36, 0.3)',
                borderRadius: '8px',
                padding: '0.75rem 1rem',
                marginBottom: '1rem',
                fontSize: '0.85rem',
                color: '#fbbf24',
              }}>
                You'll need to approve USDC spending first. This is a one-time approval for this amount.
              </div>
            )}

            {/* Submit Button */}
            <button
              type="button"
              onClick={handlePurchase}
              disabled={isButtonDisabled}
              style={{
                width: '100%',
                padding: '0.875rem 1.5rem',
                background: 'var(--accent)',
                color: '#0f172a',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '1rem',
                cursor: isButtonDisabled ? 'not-allowed' : 'pointer',
                opacity: isButtonDisabled ? 0.5 : 1,
                transition: 'opacity 0.2s',
              }}
            >
              {getButtonText()}
            </button>

            {/* Transaction Status */}
            {(txStatus.type === 'approving' || txStatus.type === 'purchasing') && txStatus.hash && (
              <div style={{
                marginTop: '1rem',
                padding: '1rem',
                background: 'rgba(251, 191, 36, 0.1)',
                border: '1px solid rgba(251, 191, 36, 0.3)',
                borderRadius: '8px',
              }}>
                <div style={{ color: '#fbbf24', fontWeight: 500, marginBottom: '0.5rem' }}>
                  {txStatus.type === 'approving' ? 'Approval Pending...' : 'Purchase Pending...'}
                </div>
                <a
                  href={`${PRESALE_CONFIG.blockExplorer}/tx/${txStatus.hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--accent)', fontSize: '0.9rem' }}
                >
                  View on Explorer →
                </a>
              </div>
            )}

            {txStatus.type === 'success' && (
              <div className="success-message">
                <div style={{ fontWeight: 500, marginBottom: '0.5rem' }}>
                  Purchase Successful!
                </div>
                <p style={{ marginBottom: '0.5rem' }}>
                  You received <strong>{txStatus.hlrrAmount} HLRR</strong> tokens.
                </p>
                <a
                  href={`${PRESALE_CONFIG.blockExplorer}/tx/${txStatus.hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--accent)', fontSize: '0.9rem' }}
                >
                  View on Explorer →
                </a>
              </div>
            )}

            {txStatus.type === 'error' && (
              <div className="error-message">
                {txStatus.message}
              </div>
            )}
          </div>
        )}

        {/* Presale Inactive Warning */}
        {presaleStats && !presaleStats.isActive && connectedAddress && (
          <div style={{
            marginTop: '1rem',
            padding: '1rem',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '8px',
            textAlign: 'center',
          }}>
            <strong style={{ color: '#ef4444' }}>Presale is currently inactive</strong>
            <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginTop: '0.5rem', marginBottom: 0 }}>
              Please check back later or follow our announcements.
            </p>
          </div>
        )}

        {/* Instructions */}
        <div style={{
          marginTop: '2rem',
          paddingTop: '1.5rem',
          borderTop: '1px solid #1f2937',
        }}>
          <h3 style={{ color: 'var(--accent)', marginBottom: '1rem', fontSize: '1.1rem' }}>
            How to Participate
          </h3>
          <ol style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
          }}>
            {[
              'Connect your Web3 wallet (MetaMask, etc.)',
              `Ensure you have USDC or ETH on ${PRESALE_CONFIG.networkName}`,
              'Select your payment currency (USDC or ETH)',
              'Enter the amount you wish to spend',
              'For USDC: Approve spending (one-time per amount)',
              'Confirm the purchase transaction',
              'Receive HLRR tokens directly to your wallet',
            ].map((step, index) => (
              <li key={index} style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
                marginBottom: '0.75rem',
                color: 'var(--text)',
              }}>
                <span style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '24px',
                  height: '24px',
                  background: 'var(--accent)',
                  color: '#0f172a',
                  borderRadius: '50%',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  flexShrink: 0,
                }}>
                  {index + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* Contract Info */}
        <div style={{
          marginTop: '1.5rem',
          padding: '1rem',
          background: 'rgba(34, 211, 238, 0.05)',
          border: '1px solid rgba(34, 211, 238, 0.2)',
          borderRadius: '8px',
          fontSize: '0.85rem',
          color: 'var(--muted)',
        }}>
          <strong style={{ color: 'var(--accent)' }}>Contract Info</strong>
          <div style={{ marginTop: '0.5rem', fontFamily: 'monospace', fontSize: '0.8rem' }}>
            <div>HLRR: {CONTRACTS.HLRR}</div>
            <div>Network: {PRESALE_CONFIG.networkName} (Chain ID: {PRESALE_CONFIG.expectedChainId})</div>
          </div>
        </div>

        {/* Disclaimer */}
        <div style={{
          marginTop: '1rem',
          padding: '1rem',
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '8px',
          fontSize: '0.85rem',
          color: 'var(--muted)',
        }}>
          <strong style={{ color: '#ef4444' }}>Important:</strong> Transactions are irreversible.
          Make sure you are connected to {PRESALE_CONFIG.networkName} and have sufficient balance before proceeding.
          ETH prices are fetched from Chainlink oracle and may fluctuate.
        </div>
      </div>

      <style>{`
        .form-group input[type="number"]::-webkit-outer-spin-button,
        .form-group input[type="number"]::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        .form-group input[type="number"] {
          -moz-appearance: textfield;
        }
      `}</style>
    </main>
  );
}
