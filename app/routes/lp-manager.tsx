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
        "Create and lock concentrated liquidity positions on Uniswap V3, PancakeSwap V3, Aerodrome, and Velodrome Slipstream across Base, Arbitrum, Optimism, Polygon, and BNB Chain.",
    },
  ];
}

// ─── Contract addresses ───────────────────────────────────────────────────────

const CHAIN = {
  BASE_MAINNET: 8453,
  BASE_SEPOLIA: 84532,
  ARBITRUM:     42161,
  ARB_SEPOLIA:  421614,
  OPTIMISM:     10,
  OP_SEPOLIA:   11155420,
  POLYGON:      137,
  BNB:          56,
  BNB_TESTNET:  97,
};

// Chain metadata used for wallet_addEthereumChain (EIP-3085) when a chain is
// not yet configured in the wallet (error code 4902).
const CHAIN_META: Record<number, {
  chainName: string;
  rpcUrls: string[];
  nativeCurrency: { name: string; symbol: string; decimals: number };
  blockExplorerUrls: string[];
}> = {
  [CHAIN.BASE_MAINNET]: {
    chainName: "Base",
    rpcUrls: ["https://mainnet.base.org"],
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    blockExplorerUrls: ["https://basescan.org"],
  },
  [CHAIN.BASE_SEPOLIA]: {
    chainName: "Base Sepolia",
    rpcUrls: ["https://sepolia.base.org"],
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    blockExplorerUrls: ["https://sepolia.basescan.org"],
  },
  [CHAIN.ARBITRUM]: {
    chainName: "Arbitrum One",
    rpcUrls: ["https://arb1.arbitrum.io/rpc"],
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    blockExplorerUrls: ["https://arbiscan.io"],
  },
  [CHAIN.OPTIMISM]: {
    chainName: "OP Mainnet",
    rpcUrls: ["https://mainnet.optimism.io"],
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    blockExplorerUrls: ["https://optimistic.etherscan.io"],
  },
  [CHAIN.POLYGON]: {
    chainName: "Polygon",
    rpcUrls: ["https://polygon-rpc.com"],
    nativeCurrency: { name: "POL", symbol: "POL", decimals: 18 },
    blockExplorerUrls: ["https://polygonscan.com"],
  },
  [CHAIN.BNB]: {
    chainName: "BNB Smart Chain",
    rpcUrls: ["https://bsc-dataseed.binance.org"],
    nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
    blockExplorerUrls: ["https://bscscan.com"],
  },
  [CHAIN.BNB_TESTNET]: {
    chainName: "BNB Smart Chain Testnet",
    rpcUrls: ["https://bsc-testnet-dataseed.bnbchain.org"],
    nativeCurrency: { name: "BNB", symbol: "tBNB", decimals: 18 },
    blockExplorerUrls: ["https://testnet.bscscan.com"],
  },
  [CHAIN.ARB_SEPOLIA]: {
    chainName: "Arbitrum Sepolia",
    rpcUrls: ["https://sepolia-rollup.arbitrum.io/rpc"],
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    blockExplorerUrls: ["https://sepolia.arbiscan.io"],
  },
  [CHAIN.OP_SEPOLIA]: {
    chainName: "OP Sepolia",
    rpcUrls: ["https://sepolia.optimism.io"],
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    blockExplorerUrls: ["https://sepolia-optimistic.etherscan.io"],
  },
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
  [CHAIN.ARBITRUM]: {
    factory: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
    nfpm: "0xC36442b4a4522E871399CD717aBDD847Ab11FE88",
  },
  [CHAIN.OPTIMISM]: {
    factory: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
    nfpm: "0xC36442b4a4522E871399CD717aBDD847Ab11FE88",
  },
  [CHAIN.POLYGON]: {
    factory: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
    nfpm: "0xC36442b4a4522E871399CD717aBDD847Ab11FE88",
  },
  [CHAIN.BNB]: {
    factory: "0xdB1d10011AD0Ff90774D0C6Bb92e5C5c8b4461F7",
    nfpm: "0x7b8A01B39D58278b5DE7e48c8449c9f4F5170613",
  },
  [CHAIN.ARB_SEPOLIA]: {
    factory: "0x248AB79Bbb9bC29bB72f7Cd42F17e054Fc40188e",
    nfpm: "0x6b2937Bde17889EDCf8fbD8dE31C3C2a70Bc4d65",
  },
  [CHAIN.OP_SEPOLIA]: {
    factory: "0x8CE191193D15ea94e11d327b4c7ad8bbE520f6aF",
    nfpm: "0xdA75cEf1C93078e8b736FCA5D5a30adb97C8957d",
  },
};

// Slipstream (Aerodrome / Velodrome) addresses keyed by chainId.
// Both protocols share the same contract interface — only addresses differ.
const SLIPSTREAM_ADDRESSES: Partial<Record<number, { clFactory: string; nfpm: string }>> = {
  [CHAIN.BASE_MAINNET]: {
    clFactory: "0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A",
    nfpm: "0x827922686190790b37229fd06084350E74485b72",
  },
  [CHAIN.OPTIMISM]: {
    clFactory: "0xCc0bDDB707055e04e497aB22a59c2aF4391cd12F",
    nfpm: "0x416b433906b1B72FA758e166e239c43d68dC6F29",
  },
};

// Sentinel address used to represent the native coin in the token list.
// Balance is fetched via eth_getBalance; pool operations substitute WETH_BY_CHAIN.
const NATIVE_ETH_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

// Native coin symbol per chain (used for display in KNOWN_TOKENS seed list)
const NATIVE_SYMBOL: Partial<Record<number, string>> = {
  [CHAIN.POLYGON]: "POL",
  [CHAIN.BNB]:     "BNB",
};

const WETH_BY_CHAIN: Partial<Record<number, string>> = {
  [CHAIN.BASE_MAINNET]: "0x4200000000000000000000000000000000000006",
  [CHAIN.BASE_SEPOLIA]: "0x4200000000000000000000000000000000000006",
  [CHAIN.ARBITRUM]:     "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
  [CHAIN.OPTIMISM]:     "0x4200000000000000000000000000000000000006",
  [CHAIN.POLYGON]:      "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270", // WPOL
  [CHAIN.BNB]:          "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c", // WBNB
  [CHAIN.BNB_TESTNET]:  "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd", // WBNB testnet
  [CHAIN.ARB_SEPOLIA]:  "0x980B62Da83eFf3D4576C647993b0c1D7faf17c73", // WETH on Arb Sepolia
  [CHAIN.OP_SEPOLIA]:   "0x4200000000000000000000000000000000000006", // WETH on OP Sepolia
};

// PancakeSwap V3 uses the same factory + NFPM address across all supported chains
const PANCAKESWAP_ADDRESSES: Record<number, { factory: string; nfpm: string }> = {
  [CHAIN.BASE_MAINNET]: {
    factory: "0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865",
    nfpm: "0x46A15B0b27311cedF172AB29E4f4766fbE7F4364",
  },
  [CHAIN.ARBITRUM]: {
    factory: "0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865",
    nfpm: "0x46A15B0b27311cedF172AB29E4f4766fbE7F4364",
  },
  // PancakeSwap V3 is not deployed on Optimism or Polygon
  [CHAIN.BNB]: {
    factory: "0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865",
    nfpm: "0x46A15B0b27311cedF172AB29E4f4766fbE7F4364",
  },
  // BNB testnet has a different NFPM address from mainnet
  [CHAIN.BNB_TESTNET]: {
    factory: "0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865",
    nfpm: "0x427bF5b37357632377eCbEC9de3626C71A5396c1",
  },
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
    { address: NATIVE_ETH_ADDRESS, symbol: "ETH", decimals: 18 },
    { address: "0x4200000000000000000000000000000000000006", symbol: "WETH", decimals: 18 },
  ],
  [CHAIN.BASE_SEPOLIA]: [
    { address: "0x75f9A6289B40BA7b32C4D56300a53B208dD8E7F4", symbol: "HLRR", decimals: 8 },
    { address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", symbol: "USDC", decimals: 6 },
    { address: NATIVE_ETH_ADDRESS, symbol: "ETH", decimals: 18 },
    { address: "0x4200000000000000000000000000000000000006", symbol: "WETH", decimals: 18 },
  ],
  [CHAIN.ARBITRUM]: [
    { address: NATIVE_ETH_ADDRESS, symbol: "ETH", decimals: 18 },
    { address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", symbol: "WETH", decimals: 18 },
    { address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", symbol: "USDC", decimals: 6 },
    { address: "0x912CE59144191C1204E64559FE8253a0e49E6548", symbol: "ARB", decimals: 18 },
  ],
  [CHAIN.OPTIMISM]: [
    { address: NATIVE_ETH_ADDRESS, symbol: "ETH", decimals: 18 },
    { address: "0x4200000000000000000000000000000000000006", symbol: "WETH", decimals: 18 },
    { address: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", symbol: "USDC", decimals: 6 },
    { address: "0x4200000000000000000000000000000000000042", symbol: "OP", decimals: 18 },
  ],
  [CHAIN.POLYGON]: [
    { address: NATIVE_ETH_ADDRESS, symbol: "POL", decimals: 18 },
    { address: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270", symbol: "WPOL", decimals: 18 },
    { address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", symbol: "USDC", decimals: 6 },
    { address: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619", symbol: "WETH", decimals: 18 },
  ],
  [CHAIN.BNB]: [
    { address: NATIVE_ETH_ADDRESS, symbol: "BNB", decimals: 18 },
    { address: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c", symbol: "WBNB", decimals: 18 },
    { address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", symbol: "USDC", decimals: 18 },
    { address: "0x55d398326f99059fF775485246999027B3197955", symbol: "USDT", decimals: 18 },
    { address: "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82", symbol: "CAKE", decimals: 18 },
  ],
  [CHAIN.ARB_SEPOLIA]: [
    { address: NATIVE_ETH_ADDRESS, symbol: "ETH", decimals: 18 },
    { address: "0x980B62Da83eFf3D4576C647993b0c1D7faf17c73", symbol: "WETH", decimals: 18 },
    { address: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d", symbol: "USDC", decimals: 6 },
  ],
  [CHAIN.OP_SEPOLIA]: [
    { address: NATIVE_ETH_ADDRESS, symbol: "ETH", decimals: 18 },
    { address: "0x4200000000000000000000000000000000000006", symbol: "WETH", decimals: 18 },
    { address: "0x5fd84259d66Cd46123540766Be93DFE6D43130D7", symbol: "USDC", decimals: 6 },
  ],
  // BNB testnet — PancakeSwap V3 only (Uniswap V3 not deployed on BSC testnet)
  // All tokens have 18 decimals, same as BNB mainnet
  [CHAIN.BNB_TESTNET]: [
    { address: NATIVE_ETH_ADDRESS, symbol: "tBNB", decimals: 18 },
    { address: "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd", symbol: "WBNB", decimals: 18 },
    { address: "0x337610d27c682E347C9cD60BD4b3b107C9d34dDd", symbol: "USDT", decimals: 18 },
    { address: "0xFa60D973F7642B748046464e165A65B7323b0C73", symbol: "CAKE", decimals: 18 },
  ],
};

// ─── Token discovery helpers ──────────────────────────────────────────────────

// Basescan/Arbiscan tokenlist API — covers full history in one call.
const EXPLORER_API: Partial<Record<number, string>> = {
  [CHAIN.BASE_MAINNET]: "https://api.basescan.org/api",
  [CHAIN.BASE_SEPOLIA]: "https://api-sepolia.basescan.org/api",
  [CHAIN.ARBITRUM]:     "https://api.arbiscan.io/api",
  [CHAIN.OPTIMISM]:     "https://api-optimistic.etherscan.io/api",
  [CHAIN.POLYGON]:      "https://api.polygonscan.com/api",
  [CHAIN.BNB]:          "https://api.bscscan.com/api",
  [CHAIN.BNB_TESTNET]:  "https://api-testnet.bscscan.com/api",
  [CHAIN.ARB_SEPOLIA]:  "https://api-sepolia.arbiscan.io/api",
  [CHAIN.OP_SEPOLIA]:   "https://api-sepolia-optimistic.etherscan.io/api",
};

async function fetchExplorerTokens(
  chainId: number,
  walletAddress: string
): Promise<Omit<WalletToken, "balance">[]> {
  const base = EXPLORER_API[chainId];
  if (!base) return [];
  try {
    const url = `${base}?module=account&action=tokenlist&address=${walletAddress}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const json = await res.json();
    if (json.status !== "1" || !Array.isArray(json.result)) return [];
    return (json.result as { contractAddress: string; tokenSymbol: string; tokenDecimal: string }[])
      .map((t) => ({
        address: t.contractAddress,
        symbol: t.tokenSymbol,
        decimals: parseInt(t.tokenDecimal, 10),
      }))
      .filter((t) => !isNaN(t.decimals));
  } catch {
    return [];
  }
}

// ERC-20 Transfer event topic0
const ERC20_TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

/**
 * Discover ERC-20 tokens in a wallet by scanning Transfer-event logs.
 *
 * Most public RPCs (including wallet-embedded ones) reject eth_getLogs when
 * the block range is too large or there is no address filter. We work around
 * this by scanning backwards in CHUNK_SIZE-block windows and running several
 * chunks in parallel. The first batch that succeeds gives us the recent tokens;
 * older tokens would require the user to add them manually.
 *
 * CHUNK_SIZE=2000 is accepted by virtually all public Base/Arbitrum RPCs.
 * TOTAL_CHUNKS × CHUNK_SIZE = 200,000 blocks ≈ 4.6 days on Base (2 s/block).
 */
const LOG_CHUNK_SIZE = 2_000;
const LOG_TOTAL_CHUNKS = 100; // 200 000 blocks ≈ 4–5 days on Base Sepolia

async function discoverTokenAddressesFromLogs(
  provider: ethers.BrowserProvider,
  walletAddress: string
): Promise<string[]> {
  try {
    const latest = await provider.getBlockNumber();
    const paddedAddr = ethers.zeroPadValue(walletAddress, 32);
    const found = new Set<string>();

    // Run chunks in parallel batches of 10 to avoid overwhelming the RPC.
    const BATCH = 10;
    for (let batch = 0; batch < Math.ceil(LOG_TOTAL_CHUNKS / BATCH); batch++) {
      const chunkPromises: Promise<void>[] = [];
      for (let c = batch * BATCH; c < Math.min((batch + 1) * BATCH, LOG_TOTAL_CHUNKS); c++) {
        const toBlock = latest - c * LOG_CHUNK_SIZE;
        if (toBlock < 0) break;
        const fromBlock = Math.max(0, toBlock - LOG_CHUNK_SIZE + 1);
        chunkPromises.push(
          provider
            .getLogs({ fromBlock, toBlock, topics: [ERC20_TRANSFER_TOPIC, null, paddedAddr] })
            .then((logs) => logs.forEach((l) => found.add(l.address.toLowerCase())))
            .catch(() => { /* RPC rejected this range — skip */ })
        );
      }
      await Promise.all(chunkPromises);
    }

    return [...found];
  } catch {
    return [];
  }
}

// ─── Fee tier / tick spacing mappings ────────────────────────────────────────

const UNISWAP_FEE_OPTIONS: { label: string; fee: number; tickSpacing: number }[] = [
  { label: "0.01%", fee: 100, tickSpacing: 1 },
  { label: "0.05%", fee: 500, tickSpacing: 10 },
  { label: "0.3%", fee: 3000, tickSpacing: 60 },
  { label: "1%", fee: 10000, tickSpacing: 200 },
];

// PancakeSwap V3 replaces the 0.3% tier with 0.25% (fee=2500, spacing=50)
const PANCAKESWAP_FEE_OPTIONS: { label: string; fee: number; tickSpacing: number }[] = [
  { label: "0.01%", fee: 100, tickSpacing: 1 },
  { label: "0.05%", fee: 500, tickSpacing: 10 },
  { label: "0.25%", fee: 2500, tickSpacing: 50 },
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
  "function refundETH() external payable",
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
  [CHAIN.BASE_SEPOLIA]: "0x35b27228E96159E6c0A7921faC733C6aE06b86d1",
  [CHAIN.BASE_MAINNET]: "0x5AA450B8fE52eD43455a3Cd7cACe01e086AF3805",
  [CHAIN.ARBITRUM]:     "0x1B0c30f168D6Ef5F8203C915D191280e8Fe039Fa",
  [CHAIN.BNB]:          "0x27e99baA94E143E17A4Ec09334639329eEA901bb",
  [CHAIN.BNB_TESTNET]:  "0x5028410b2a9dDF94b36aF1124a3393f96873e1e4",
  [CHAIN.POLYGON]:      "0x5028410b2a9dDF94b36aF1124a3393f96873e1e4",
  [CHAIN.OPTIMISM]:     "0x5028410b2a9dDF94b36aF1124a3393f96873e1e4",
  [CHAIN.OP_SEPOLIA]:   "0x5028410b2a9dDF94b36aF1124a3393f96873e1e4",
  [CHAIN.ARB_SEPOLIA]:  "0x5028410b2a9dDF94b36aF1124a3393f96873e1e4",
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

type Protocol = "uniswap" | "aerodrome" | "velodrome" | "pancakeswap";

/** True for protocols that use the Slipstream (Aerodrome/Velodrome) interface. */
const isSlipstream = (p: Protocol) => p === "aerodrome" || p === "velodrome";

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
    switchNetwork: walletSwitchNetwork,
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
  const [customTokenInput, setCustomTokenInput] = useState("");
  const [customTokenError, setCustomTokenError] = useState("");

  // Custom tokens persisted to localStorage per chainId so they survive refresh.
  const customStorageKey = chainId ? `lp_custom_tokens_${chainId}` : null;
  const [customTokens, setCustomTokensState] = useState<Omit<WalletToken, "balance">[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(`lp_custom_tokens_${chainId}`);
      return raw ? (JSON.parse(raw) as Omit<WalletToken, "balance">[]) : [];
    } catch { return []; }
  });
  const setCustomTokens = useCallback(
    (updater: ((prev: Omit<WalletToken, "balance">[]) => Omit<WalletToken, "balance">[])) => {
      setCustomTokensState((prev) => {
        const next = updater(prev);
        if (customStorageKey) {
          try { localStorage.setItem(customStorageKey, JSON.stringify(next)); } catch { /* quota */ }
        }
        return next;
      });
    },
    [customStorageKey]
  );

  // Reload custom tokens from localStorage whenever chainId changes.
  useEffect(() => {
    if (!customStorageKey) return;
    try {
      const raw = localStorage.getItem(customStorageKey);
      setCustomTokensState(raw ? (JSON.parse(raw) as Omit<WalletToken, "balance">[]) : []);
    } catch { setCustomTokensState([]); }
  }, [customStorageKey]);

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
    chainId === CHAIN.BASE_MAINNET ? "Base Mainnet"
    : chainId === CHAIN.BASE_SEPOLIA ? "Base Sepolia"
    : chainId === CHAIN.ARBITRUM    ? "Arbitrum One"
    : chainId === CHAIN.ARB_SEPOLIA ? "Arbitrum Sepolia"
    : chainId === CHAIN.OPTIMISM    ? "OP Mainnet"
    : chainId === CHAIN.OP_SEPOLIA  ? "OP Sepolia"
    : chainId === CHAIN.POLYGON     ? "Polygon"
    : chainId === CHAIN.BNB         ? "BNB Chain"
    : chainId !== null              ? "Unsupported Network"
    : null;

  const isSupported = chainId !== null &&
    (chainId in UNISWAP_ADDRESSES || chainId in PANCAKESWAP_ADDRESSES);

  // Slipstream protocols are only available on chains that have a SLIPSTREAM_ADDRESSES entry
  const isSlipstreamUnsupported = isSlipstream(protocol) && !(chainId !== null && chainId in SLIPSTREAM_ADDRESSES);
  // Keep alias for error message clarity
  const isAeroUnsupported = isSlipstreamUnsupported;
  // PancakeSwap V3 is not on Base Sepolia, Optimism, or Polygon
  const isPCSUnsupported = protocol === "pancakeswap" && !(chainId !== null && chainId in PANCAKESWAP_ADDRESSES);
  // Uniswap V3 is not on BNB testnet (PancakeSwap only there)
  const isUniswapUnsupported = protocol === "uniswap" && !(chainId !== null && chainId in UNISWAP_ADDRESSES);

  const t0 = walletTokens.find((t) => t.address.toLowerCase() === token0Addr.toLowerCase());
  const t1 = walletTokens.find((t) => t.address.toLowerCase() === token1Addr.toLowerCase());
  const sameToken = !!token0Addr && token0Addr.toLowerCase() === token1Addr.toLowerCase();
  // Label fallbacks: use symbol if token is found, else truncated address, else placeholder
  const t0Label = t0?.symbol ?? (token0Addr ? `${token0Addr.slice(0, 6)}…` : "Token0");
  const t1Label = t1?.symbol ?? (token1Addr ? `${token1Addr.slice(0, 6)}…` : "Token1");

  // Sorted pair (by address, as Uniswap requires).
  const sorted0 = t0 && t1
    ? (t0.address.toLowerCase() < t1.address.toLowerCase() ? t0 : t1)
    : t0 ?? null;
  const sorted1 = t0 && t1
    ? (t0.address.toLowerCase() < t1.address.toLowerCase() ? t1 : t0)
    : t1 ?? null;
  // True when address sort swapped the user's selection (e.g. user picked WETH as token0
  // but USDC has a lower address so USDC becomes sorted0).  When true, the user's natural
  // price direction is sorted0/sorted1 (e.g. USDC per WETH), which is the inverse of the
  // pool's internal direction.  We accept prices in the user's direction and invert internally.
  const pairSwapped = !!(t0 && t1 && t0.address.toLowerCase() > t1.address.toLowerCase());

  const feeOptions = protocol === "pancakeswap" ? PANCAKESWAP_FEE_OPTIONS : UNISWAP_FEE_OPTIONS;

  const tickSpacing =
    isSlipstream(protocol)
      ? selectedSpacing
      : feeOptions.find((o) => o.fee === selectedFee)?.tickSpacing ?? 200;

  // Reciprocal hint: shows the opposite direction as a cross-check
  // Prices are always entered as t1/t0 (user's selection order), so reciprocal is t0/t1.
  const reciprocalHint = (priceStr: string) => {
    if (!t0 || !t1) return "";
    const p = parseFloat(priceStr);
    if (!p || p <= 0) return "";
    const recip = 1 / p;
    const fmt = recip >= 1000 ? recip.toFixed(2) : recip >= 1 ? recip.toFixed(4) : recip.toPrecision(4);
    return `= ${fmt} ${t0.symbol} per ${t1.symbol}`;
  };

  // Convert a user-entered price to pool's native sorted1/sorted0 direction
  const toPoolPrice = (userPrice: number) => pairSwapped ? 1 / userPrice : userPrice;

  // Computed sqrtPriceX96 preview
  const sqrtPricePreview = (() => {
    if (!sorted0 || !sorted1) return "";
    const p = parseFloat(startingPrice);
    if (!p || p <= 0) return "";
    try {
      return priceToSqrtPriceX96(toPoolPrice(p), sorted0.decimals, sorted1.decimals).toString();
    } catch {
      return "";
    }
  })();

  const minTickPreview = (() => {
    if (!sorted0 || !sorted1) return "";
    // When pairSwapped: user's min is the high end of the price range in pool terms → tickUpper direction
    // We want tickLower (lower pool price), which corresponds to user's max price
    const p = parseFloat(pairSwapped ? maxPrice : minPrice);
    if (!p || p <= 0) return "";
    const raw = priceToTick(toPoolPrice(p), sorted0.decimals, sorted1.decimals);
    return snapTick(raw, tickSpacing, true).toString();
  })();

  const maxTickPreview = (() => {
    if (!sorted0 || !sorted1) return "";
    // When pairSwapped: user's max is the low end of the price range in pool terms → tickLower direction
    // We want tickUpper (higher pool price), which corresponds to user's min price
    const p = parseFloat(pairSwapped ? minPrice : maxPrice);
    if (!p || p <= 0) return "";
    const raw = priceToTick(toPoolPrice(p), sorted0.decimals, sorted1.decimals);
    return snapTick(raw, tickSpacing, false).toString();
  })();

  const basescanBase =
    chainId === CHAIN.BASE_MAINNET  ? "https://basescan.org"
    : chainId === CHAIN.BASE_SEPOLIA  ? "https://sepolia.basescan.org"
    : chainId === CHAIN.ARBITRUM      ? "https://arbiscan.io"
    : chainId === CHAIN.ARB_SEPOLIA   ? "https://sepolia.arbiscan.io"
    : chainId === CHAIN.OPTIMISM      ? "https://optimistic.etherscan.io"
    : chainId === CHAIN.OP_SEPOLIA    ? "https://sepolia-optimistic.etherscan.io"
    : chainId === CHAIN.BNB           ? "https://bscscan.com"
    : chainId === CHAIN.BNB_TESTNET   ? "https://testnet.bscscan.com"
    : "https://sepolia.basescan.org";

  // ─── Wallet setup ────────────────────────────────────────────────────────────

  // Clear wallet tokens on every address change — disconnect OR account switch.
  // Without this, switching accounts inside the wallet leaves stale tokens visible
  // until fetchWalletTokens completes for the new address.
  useEffect(() => {
    setWalletTokens([]);
    setToken0Addr("");
    setToken1Addr("");
  }, [connectedAddress]);

  // Reset fee tier when switching protocols if the current fee doesn't exist in the new one
  useEffect(() => {
    const opts = protocol === "pancakeswap" ? PANCAKESWAP_FEE_OPTIONS : UNISWAP_FEE_OPTIONS;
    if (protocol !== "aerodrome" && !opts.find((o) => o.fee === selectedFee)) {
      setSelectedFee(10000);
    }
  }, [protocol]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear success status when any LP creation form field changes
  useEffect(() => {
    setTxStatus((s) => (s.type === "success" ? { type: "idle" } : s));
    setLockTxStatus((s) => (s.type === "success" || s.type === "error" ? { type: "idle" } : s));
  }, [protocol, token0Addr, token1Addr, selectedFee, selectedSpacing, startingPrice, minPrice, maxPrice, amount0, amount1]);

  // Reset protocol to uniswap when switching to a chain where current protocol is unavailable
  useEffect(() => {
    if (!chainId) return;
    if (protocol === "aerodrome" && chainId !== CHAIN.BASE_MAINNET) setProtocol("uniswap");
    if (protocol === "velodrome" && chainId !== CHAIN.OPTIMISM) setProtocol("uniswap");
    if (protocol === "pancakeswap" && !(chainId in PANCAKESWAP_ADDRESSES)) setProtocol("uniswap");
    // BNB testnet has PancakeSwap only — auto-switch away from Uniswap
    if (protocol === "uniswap" && !(chainId in UNISWAP_ADDRESSES) && chainId in PANCAKESWAP_ADDRESSES) setProtocol("pancakeswap");
  }, [chainId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-populate vault address and lock NFPM when chain / protocol changes
  useEffect(() => {
    if (chainId) {
      setVaultAddress(VAULT_ADDRESSES[chainId] ?? "");
    }
    if (chainId && protocol) {
      const nfpmAddr =
        isSlipstream(protocol)
          ? SLIPSTREAM_ADDRESSES[chainId]?.nfpm ?? ""
          : protocol === "pancakeswap"
          ? PANCAKESWAP_ADDRESSES[chainId]?.nfpm ?? ""
          : UNISWAP_ADDRESSES[chainId]?.nfpm ?? "";
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
    try {
      const provider = new ethers.BrowserProvider(ethereum);

      // Run Basescan API (full history) and recent eth_getLogs in parallel.
      // Basescan covers months of history; logs catch very recently deployed
      // contracts that Basescan hasn't indexed yet.
      const [explorerTokens, logAddresses] = await Promise.all([
        fetchExplorerTokens(chainId, connectedAddress),
        discoverTokenAddressesFromLogs(provider, connectedAddress),
      ]);

      // Resolve symbol+decimals for log-discovered addresses not already covered
      // by seed, explorer, or custom lists.
      const knownAddrs = new Set([
        ...seed.map((t) => t.address.toLowerCase()),
        ...explorerTokens.map((t) => t.address.toLowerCase()),
        ...customTokens.map((t) => t.address.toLowerCase()),
      ]);
      const logTokens: Omit<WalletToken, "balance">[] = await Promise.all(
        logAddresses
          .filter((a) => !knownAddrs.has(a))
          .map(async (addr) => {
            try {
              const c = new ethers.Contract(addr, ERC20_ABI, provider);
              const [sym, dec] = await Promise.all([c.symbol() as Promise<string>, c.decimals() as Promise<bigint>]);
              return { address: addr, symbol: sym, decimals: Number(dec) };
            } catch {
              return null;
            }
          })
      ).then((res) => res.filter(Boolean) as Omit<WalletToken, "balance">[]);

      // Merge: seed → explorer → log-discovered → custom (dedup by address)
      const seen = new Set<string>();
      const all = [...seed, ...explorerTokens, ...logTokens, ...customTokens].filter((t) => {
        const key = t.address.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      const results: WalletToken[] = [];
      await Promise.all(
        all.map(async (t) => {
          const isSeed = seed.some((s) => s.address.toLowerCase() === t.address.toLowerCase());
          const isCustom = customTokens.some((c) => c.address.toLowerCase() === t.address.toLowerCase());
          try {
            let bal: bigint;
            if (t.address.toLowerCase() === NATIVE_ETH_ADDRESS.toLowerCase()) {
              bal = await provider.getBalance(connectedAddress);
            } else {
              const contract = new ethers.Contract(t.address, ERC20_ABI, provider);
              bal = await contract.balanceOf(connectedAddress);
            }
            // Seed, custom, and currently-selected tokens always shown (even at 0 balance).
            // Log-discovered tokens shown only if balance > 0.
            const isSelected = t.address.toLowerCase() === token0Addr.toLowerCase() ||
                               t.address.toLowerCase() === token1Addr.toLowerCase();
            if (isSeed || isCustom || isSelected || bal > 0n) {
              results.push({ ...t, balance: ethers.formatUnits(bal, t.decimals) });
            }
          } catch {
            if (isSeed || isCustom) results.push({ ...t, balance: "0" });
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
    const addrLower = addr.toLowerCase();
    if (
      customTokens.some((t) => t.address.toLowerCase() === addrLower) ||
      KNOWN_TOKENS[chainId ?? 0]?.some((t) => t.address.toLowerCase() === addrLower)
    ) {
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
      setTxStatus({ type: "error", message: "Unsupported network. Switch to Base Mainnet, Arbitrum One, or Base Sepolia." });
      return;
    }
    if (isAeroUnsupported) {
      setTxStatus({ type: "error", message: "This protocol is not available on the current network. Switch networks or select a different protocol." });
      return;
    }
    if (isPCSUnsupported) {
      setTxStatus({ type: "error", message: "PancakeSwap V3 is not available on this network. Switch to Base Mainnet, Arbitrum One, or BNB Chain, or select Uniswap V3." });
      return;
    }
    if (isUniswapUnsupported) {
      setTxStatus({ type: "error", message: "Uniswap V3 is not available on this network. Select PancakeSwap V3." });
      return;
    }

    try {
      const provider = new ethers.BrowserProvider(ethereum);
      const signer = await provider.getSigner();

      if (!t0 || !t1) throw new Error("Token info not loaded. Select both tokens.");

      // Native ETH uses a sentinel address in the token list. For pool operations
      // (sorting, pool init, mint params) we substitute the chain's WETH address.
      // Native ETH is sent as msg.value — no ERC-20 approval needed.
      const isNativeETH = (addr: string) => addr.toLowerCase() === NATIVE_ETH_ADDRESS.toLowerCase();
      const hasNativeETH = isNativeETH(t0.address) || isNativeETH(t1.address);
      if (hasNativeETH && isSlipstream(protocol)) {
        setTxStatus({ type: "error", message: "Native ETH is not supported with Aerodrome Slipstream. Use WETH instead." });
        return;
      }
      const wethAddr = WETH_BY_CHAIN[chainId];
      if (hasNativeETH && !wethAddr) throw new Error("Native ETH is not supported on this network.");
      const resolveAddr = (addr: string) => isNativeETH(addr) ? wethAddr! : addr;

      // Sort by resolved (WETH) addresses — Uniswap requires token0 < token1
      const r0 = resolveAddr(t0.address);
      const r1 = resolveAddr(t1.address);
      const swapped = r0.toLowerCase() > r1.toLowerCase();
      const localSorted0 = { ...(swapped ? t1 : t0), address: swapped ? r1 : r0 };
      const localSorted1 = { ...(swapped ? t0 : t1), address: swapped ? r0 : r1 };
      const wasSwapped = swapped;
      // Which sorted slot (if any) carries native ETH — determines msg.value and skips approval
      const isNativeETHSorted0 = isNativeETH(swapped ? t1.address : t0.address);
      const isNativeETHSorted1 = isNativeETH(swapped ? t0.address : t1.address);

      // User enters prices in their natural direction (token1/token0 as selected in the dropdowns).
      // When pairSwapped (address sort reordered the pair), convert to pool's sorted1/sorted0 direction.
      const userStartingPrice = parseFloat(startingPrice);
      const userMinPrice = parseFloat(minPrice);
      const userMaxPrice = parseFloat(maxPrice);

      // Pool direction prices: invert when pairSwapped; min/max also swap because a higher
      // user price (e.g. more USDC per WETH) maps to a lower pool price (less WETH per USDC).
      const humanPrice = wasSwapped ? 1 / userStartingPrice : userStartingPrice;
      const humanMin   = wasSwapped ? 1 / userMaxPrice      : userMinPrice;
      const humanMax   = wasSwapped ? 1 / userMinPrice      : userMaxPrice;

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
      if (protocol === "uniswap" || protocol === "pancakeswap") {
        const provider2 = new ethers.BrowserProvider(ethereum);
        const addrs = protocol === "pancakeswap" ? PANCAKESWAP_ADDRESSES[chainId] : UNISWAP_ADDRESSES[chainId];
        if (addrs) {
          const factory = new ethers.Contract(addrs.factory, UNISWAP_FACTORY_ABI, provider2);
          const existingPool: string = await factory.getPool(
            localSorted0.address, localSorted1.address, selectedFee
          );
          if (existingPool !== ethers.ZeroAddress) {
            const pool = new ethers.Contract(existingPool, UNISWAP_POOL_ABI, provider2);
            const [, currentTickRaw] = await pool.slot0();
            const currentTick = Number(currentTickRaw);
            if (currentTick < tickLower || currentTick >= tickUpper) {
              // currentPrice is in pool's native sorted1/sorted0 direction
              const poolCurrentPrice = (1.0001 ** currentTick) * Math.pow(10, localSorted0.decimals - localSorted1.decimals);
              // Show price and range in user's entered direction
              const displayPrice = wasSwapped ? 1 / poolCurrentPrice : poolCurrentPrice;
              const [sym0, sym1] = wasSwapped
                ? [localSorted0.symbol, localSorted1.symbol]  // user direction: sorted0/sorted1
                : [localSorted1.symbol, localSorted0.symbol]; // pool direction: sorted1/sorted0
              setTxStatus({
                type: "error",
                message:
                  `Pool already exists at tick ${currentTick} (≈$${displayPrice.toFixed(4)} ${sym0}/${sym1}), ` +
                  `which is OUTSIDE your range [$${userMinPrice}–$${userMaxPrice}]. ` +
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
        isSlipstream(protocol)
          ? SLIPSTREAM_ADDRESSES[chainId]?.nfpm ?? ""
          : protocol === "pancakeswap"
          ? PANCAKESWAP_ADDRESSES[chainId]?.nfpm ?? ""
          : UNISWAP_ADDRESSES[chainId]?.nfpm ?? "";

      // Approve 2% above desired to cover Uniswap's internal rounding — avoids STF.
      // Check against approval amount (not amt0Raw) so a stale exact-amount allowance
      // from a previous attempt doesn't cause us to skip re-approval.
      const approval0 = amt0Raw * 102n / 100n;
      const approval1 = amt1Raw * 102n / 100n;

      // Step 1: Approve sorted0 (skip for native ETH — sent as msg.value)
      if (!isNativeETHSorted0) {
        setTxStatus({ type: "approving_token0" });
        const erc0 = new ethers.Contract(localSorted0.address, ERC20_ABI, signer);
        const allowance0: bigint = await erc0.allowance(connectedAddress, nfpmAddress);
        if (allowance0 < approval0) {
          const tx = await erc0.approve(nfpmAddress, approval0);
          await tx.wait(2);
        }
      }

      // Step 2: Approve sorted1 (skip for native ETH — sent as msg.value)
      if (!isNativeETHSorted1) {
        setTxStatus({ type: "approving_token1" });
        const erc1 = new ethers.Contract(localSorted1.address, ERC20_ABI, signer);
        const allowance1: bigint = await erc1.allowance(connectedAddress, nfpmAddress);
        if (allowance1 < approval1) {
          const tx = await erc1.approve(nfpmAddress, approval1);
          await tx.wait(2);
        }
      }

      const deadline = Math.floor(Date.now() / 1000) + 1200; // 20 min

      let receipt: ethers.TransactionReceipt | null = null;

      if (protocol === "uniswap" || protocol === "pancakeswap") {
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

        // Attach ETH value when one side is native ETH; refundETH returns any dust
        const ethValue = isNativeETHSorted0 ? amt0Raw : isNativeETHSorted1 ? amt1Raw : 0n;
        const calls = [initCalldata, mintCalldata];
        if (ethValue > 0n) calls.push(iface.encodeFunctionData("refundETH", []));

        setTxStatus({ type: "minting" });
        const tx = await nfpm.multicall(calls, { value: ethValue });
        receipt = await tx.wait();
      } else {
        // Slipstream (Aerodrome on Base, Velodrome on Optimism) — identical interface
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

  const amount0Exceeds = !!t0 && !!amount0 && parseFloat(amount0) > parseFloat(t0.balance);
  const amount1Exceeds = !!t1 && !!amount1 && parseFloat(amount1) > parseFloat(t1.balance);

  const formValid =
    !!connectedAddress &&
    isSupported &&
    !isAeroUnsupported &&
    !isPCSUnsupported &&
    !isUniswapUnsupported &&
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
    !amount0Exceeds &&
    !!amount1 &&
    parseFloat(amount1) > 0 &&
    !amount1Exceeds;

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
        {/* ── About / Documentation ─────────────────────────────────────────── */}
        <div style={{ ...S.card, marginBottom: "1.5rem" }}>
          <h2 style={{ fontSize: "1.1rem", color: "var(--accent)", fontWeight: 600, marginBottom: "0.75rem" }}>
            About NYK Labs LP Vaults
          </h2>
          <p style={{ color: "#9ca3af", fontSize: "0.9rem", lineHeight: "1.7", marginBottom: "1rem" }}>
            NYK Labs LP Vaults are non-custodial smart contracts that accept a Uniswap V3-style NFT position
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
                  { net: "Base Mainnet",       chainId: 8453,     addr: "0x5AA450B8fE52eD43455a3Cd7cACe01e086AF3805", explorer: "https://basescan.org",          sourcify: "https://repo.sourcify.dev/contracts/full_match/8453/0x5AA450B8fE52eD43455a3Cd7cACe01e086AF3805/" },
                  { net: "Base Sepolia",        chainId: 84532,    addr: "0x35b27228E96159E6c0A7921faC733C6aE06b86d1", explorer: "https://sepolia.basescan.org",  sourcify: "https://repo.sourcify.dev/contracts/full_match/84532/0x35b27228E96159E6c0A7921faC733C6aE06b86d1/" },
                  { net: "Arbitrum One",        chainId: 42161,    addr: "0x1B0c30f168D6Ef5F8203C915D191280e8Fe039Fa", explorer: "https://arbiscan.io",           sourcify: "https://repo.sourcify.dev/contracts/full_match/42161/0x1B0c30f168D6Ef5F8203C915D191280e8Fe039Fa/" },
                  { net: "Arbitrum Sepolia",    chainId: 421614,   addr: "0x5028410b2a9dDF94b36aF1124a3393f96873e1e4", explorer: "https://sepolia.arbiscan.io",   sourcify: "https://repo.sourcify.dev/contracts/full_match/421614/0x5028410b2a9dDF94b36aF1124a3393f96873e1e4/" },
                  { net: "OP Mainnet",          chainId: 10,       addr: "0x5028410b2a9dDF94b36aF1124a3393f96873e1e4", explorer: "https://optimistic.etherscan.io", sourcify: "https://repo.sourcify.dev/contracts/full_match/10/0x5028410b2a9dDF94b36aF1124a3393f96873e1e4/" },
                  { net: "OP Sepolia",          chainId: 11155420, addr: "0x5028410b2a9dDF94b36aF1124a3393f96873e1e4", explorer: "https://sepolia-optimistic.etherscan.io", sourcify: "https://repo.sourcify.dev/contracts/full_match/11155420/0x5028410b2a9dDF94b36aF1124a3393f96873e1e4/" },
                  { net: "BNB Chain",           chainId: 56,       addr: "0x27e99baA94E143E17A4Ec09334639329eEA901bb", explorer: "https://bscscan.com",           sourcify: "https://repo.sourcify.dev/contracts/full_match/56/0x27e99baA94E143E17A4Ec09334639329eEA901bb/" },
                  { net: "BNB Testnet",         chainId: 97,       addr: "0x5028410b2a9dDF94b36aF1124a3393f96873e1e4", explorer: "https://testnet.bscscan.com",   sourcify: "https://repo.sourcify.dev/contracts/full_match/97/0x5028410b2a9dDF94b36aF1124a3393f96873e1e4/" },
                  { net: "Polygon",             chainId: 137,      addr: "0x5028410b2a9dDF94b36aF1124a3393f96873e1e4", explorer: "https://polygonscan.com",       sourcify: "https://repo.sourcify.dev/contracts/full_match/137/0x5028410b2a9dDF94b36aF1124a3393f96873e1e4/" },
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
                  { net: "Base Mainnet",    uni: true,  pcs: true,  aero: true,  velo: false },
                  { net: "Base Sepolia",    uni: true,  pcs: false, aero: false, velo: false },
                  { net: "Arbitrum One",    uni: true,  pcs: true,  aero: false, velo: false },
                  { net: "Arbitrum Sepolia",uni: true,  pcs: false, aero: false, velo: false },
                  { net: "OP Mainnet",      uni: true,  pcs: false, aero: false, velo: true  },
                  { net: "OP Sepolia",      uni: true,  pcs: false, aero: false, velo: false },
                  { net: "Polygon",         uni: true,  pcs: false, aero: false, velo: false },
                  { net: "BNB Chain",       uni: true,  pcs: true,  aero: false, velo: false },
                  { net: "BNB Testnet",     uni: false, pcs: true,  aero: false, velo: false },
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
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", fontSize: "0.88rem", color: "#9ca3af", lineHeight: "1.65" }}>

            <div style={{ background: "rgba(34,211,238,0.05)", border: "1px solid rgba(34,211,238,0.15)", borderRadius: "8px", padding: "0.9rem 1.1rem" }}>
              <div style={{ fontWeight: 600, color: "var(--text)", marginBottom: "0.35rem" }}>Uniswap V3 &amp; PancakeSwap V3</div>
              <p style={{ margin: 0 }}>
                Both protocols identify a pool by <strong style={{ color: "var(--text)" }}>token pair + fee tier</strong>.
                Available fee tiers are <code style={{ color: "var(--accent)" }}>0.01%</code>, <code style={{ color: "var(--accent)" }}>0.05%</code>,{" "}
                <code style={{ color: "var(--accent)" }}>0.3%</code>, and <code style={{ color: "var(--accent)" }}>1%</code> — each is a separate pool.
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
                NYK Labs LP Vault contract via <code style={{ color: "#10b981" }}>createLock(manager, tokenId, unlockTime)</code>.
                The vault records the owner, the position manager address, and the unlock timestamp.
                During the lock the owner may call <code style={{ color: "#10b981" }}>collectFees()</code> to harvest accrued trading fees
                at any time. Once the unlock time has passed, <code style={{ color: "#10b981" }}>withdrawNFT()</code> returns the NFT to
                the original owner who can then close, migrate, or re-lock the position as desired.
              </p>
              <p style={{ margin: 0 }}>
                <strong style={{ color: "var(--text)" }}>Closing a position</strong> (available after the vault lock expires and the NFT
                is withdrawn) is a multi-step process executed by the LP Manager:{" "}
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
        {/* ── End About ─────────────────────────────────────────────────────── */}

        {/* Header */}
        <div style={{ marginBottom: "1.25rem" }}>
          <h1 style={{ fontSize: "1.8rem", color: "var(--accent)", fontWeight: 700 }}>
            LP Position Creator
          </h1>
          <p style={{ color: "#9ca3af", marginTop: "0.4rem" }}>
            Create and lock concentrated liquidity positions on Uniswap V3, PancakeSwap V3, Aerodrome, and Velodrome Slipstream across multiple networks
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
                    chainId === CHAIN.BASE_MAINNET ? "#22d3ee"
                    : chainId === CHAIN.BASE_SEPOLIA ? "#a78bfa"
                    : chainId === CHAIN.ARBITRUM    ? "#f59e0b"
                    : chainId === CHAIN.OPTIMISM    ? "#ff0420"
                    : chainId === CHAIN.POLYGON     ? "#8247e5"
                    : chainId === CHAIN.BNB         ? "#f0b90b"
                    : chainId === CHAIN.BNB_TESTNET ? "#d97706"
                    : chainId === CHAIN.ARB_SEPOLIA ? "#7c9eff"
                    : chainId === CHAIN.OP_SEPOLIA  ? "#ff6b81"
                    : "#ef4444"
                  )}
                >
                  {networkName ?? "Unknown"}
                </span>
                <span style={{ fontSize: "0.85rem", color: "#9ca3af" }}>
                  {connectedAddress.slice(0, 6)}...{connectedAddress.slice(-4)}
                </span>
                {/* Network switcher — Trust Wallet and similar wallets store a
                    per-site chain that must be changed via wallet_switchEthereumChain;
                    switching inside the wallet app alone won't update a site session. */}
                <select
                  value={chainId ?? ""}
                  onChange={(e) => {
                    const id = parseInt(e.target.value);
                    if (!id || id === chainId) return;
                    walletSwitchNetwork(id).catch(async (err: unknown) => {
                      // 4902 = chain not yet added to the wallet — add it then retry
                      const code = (err as { code?: number })?.code;
                      const meta = CHAIN_META[id];
                      if (code === 4902 && meta) {
                        try {
                          const eth = getEthereum();
                          if (!eth) return;
                          await eth.request({
                            method: "wallet_addEthereumChain",
                            params: [{ chainId: `0x${id.toString(16)}`, ...meta }],
                          });
                        } catch { /* user rejected add */ }
                      }
                    });
                  }}
                  style={{
                    ...S.select,
                    width: "auto",
                    padding: "0.2rem 0.5rem",
                    fontSize: "0.78rem",
                    marginBottom: 0,
                  }}
                >
                  <option value={CHAIN.BASE_MAINNET}>Base Mainnet</option>
                  <option value={CHAIN.ARBITRUM}>Arbitrum One</option>
                  <option value={CHAIN.OPTIMISM}>OP Mainnet</option>
                  <option value={CHAIN.POLYGON}>Polygon</option>
                  <option value={CHAIN.BNB}>BNB Chain</option>
                  <option value={CHAIN.BASE_SEPOLIA}>Base Sepolia</option>
                  <option value={CHAIN.BNB_TESTNET}>BNB Testnet</option>
                  {chainId !== null && !isSupported && chainId !== CHAIN.BASE_SEPOLIA && chainId !== CHAIN.BNB_TESTNET && (
                    <option value={chainId}>Unknown ({chainId})</option>
                  )}
                </select>
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
            <div>Unsupported network. Switch to a supported network:</div>
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.6rem", flexWrap: "wrap" }}>
              {[
                { label: "Base Mainnet", id: CHAIN.BASE_MAINNET },
                { label: "Arbitrum One", id: CHAIN.ARBITRUM },
                { label: "Base Sepolia", id: CHAIN.BASE_SEPOLIA },
              ].map(({ label, id }) => (
                <button
                  key={id}
                  onClick={() => walletSwitchNetwork(id).catch(() => {})}
                  style={{ ...S.btn, width: "auto", padding: "0.3rem 0.8rem", fontSize: "0.8rem", marginTop: 0 }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}


        {/* Protocol selector */}
        <div style={S.card}>
          <p style={S.sectionTitle}>Protocol</p>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            {(chainId === null || chainId in UNISWAP_ADDRESSES) && (
              <button style={S.protocolTab(protocol === "uniswap")} onClick={() => setProtocol("uniswap")}>
                Uniswap V3
              </button>
            )}
            {chainId !== null && chainId in PANCAKESWAP_ADDRESSES && (
              <button style={S.protocolTab(protocol === "pancakeswap")} onClick={() => setProtocol("pancakeswap")}>
                PancakeSwap V3
              </button>
            )}
            {chainId === CHAIN.BASE_MAINNET && (
              <button style={S.protocolTab(protocol === "aerodrome")} onClick={() => setProtocol("aerodrome")}>
                Aerodrome
              </button>
            )}
            {chainId === CHAIN.OPTIMISM && (
              <button style={S.protocolTab(protocol === "velodrome")} onClick={() => setProtocol("velodrome")}>
                Velodrome
              </button>
            )}
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
                {walletTokens.map((t) => {
                  const dupSymbol = walletTokens.filter((x) => x.symbol === t.symbol).length > 1;
                  const addrTag = dupSymbol ? ` ${t.address.slice(0, 6)}…${t.address.slice(-4)}` : "";
                  return (
                    <option key={t.address} value={t.address}>
                      {t.symbol}{addrTag} ({parseFloat(t.balance).toFixed(4)})
                    </option>
                  );
                })}
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
                {walletTokens.map((t) => {
                  const dupSymbol = walletTokens.filter((x) => x.symbol === t.symbol).length > 1;
                  const addrTag = dupSymbol ? ` ${t.address.slice(0, 6)}…${t.address.slice(-4)}` : "";
                  return (
                    <option key={t.address} value={t.address}>
                      {t.symbol}{addrTag} ({parseFloat(t.balance).toFixed(4)})
                    </option>
                  );
                })}
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
          {isSlipstream(protocol) ? (
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
          ) : (
            <>
              <p style={S.sectionTitle}>Fee Tier</p>
              <div style={S.radioRow}>
                {feeOptions.map((opt) => (
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
                Tick spacing: {feeOptions.find((o) => o.fee === selectedFee)?.tickSpacing}
              </p>
            </>
          )}
        </div>


        {/* Starting price */}
        <div style={S.card}>
          <p style={S.sectionTitle}>Starting Price</p>
          <label style={S.label}>
            {t1Label} per {t0Label}
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
          {reciprocalHint(startingPrice) && (
            <p style={S.hint}>{reciprocalHint(startingPrice)}</p>
          )}
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
                Min Price ({t1Label}/{t0Label})
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
              {reciprocalHint(minPrice) && (
                <p style={S.hint}>{reciprocalHint(minPrice)}</p>
              )}
              {minTickPreview && <p style={S.hint}>tickLower: {minTickPreview}</p>}
            </div>
            <div>
              <label style={S.label}>
                Max Price ({t1Label}/{t0Label})
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
              {reciprocalHint(maxPrice) && (
                <p style={S.hint}>{reciprocalHint(maxPrice)}</p>
              )}
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
              <label style={S.label}>{t0Label} amount</label>
              <input
                type="number"
                min="0"
                step="any"
                style={{ ...S.input, ...(amount0Exceeds ? { borderColor: "#ef4444" } : {}) }}
                placeholder="0.0"
                value={amount0}
                onChange={(e) => setAmount0(e.target.value)}
              />
              {t0 && (
                <p style={S.hint}>Wallet: {parseFloat(t0.balance).toFixed(4)} {t0.symbol}</p>
              )}
              {amount0Exceeds && (
                <p style={{ color: "#ef4444", fontSize: "0.78rem", marginTop: "0.25rem" }}>
                  Exceeds available balance ({parseFloat(t0!.balance).toFixed(4)} {t0!.symbol})
                </p>
              )}
            </div>
            <div>
              <label style={S.label}>{t1Label} amount</label>
              <input
                type="number"
                min="0"
                step="any"
                style={{ ...S.input, ...(amount1Exceeds ? { borderColor: "#ef4444" } : {}) }}
                placeholder="0.0"
                value={amount1}
                onChange={(e) => setAmount1(e.target.value)}
              />
              {t1 && (
                <p style={S.hint}>Wallet: {parseFloat(t1.balance).toFixed(4)} {t1.symbol}</p>
              )}
              {amount1Exceeds && (
                <p style={{ color: "#ef4444", fontSize: "0.78rem", marginTop: "0.25rem" }}>
                  Exceeds available balance ({parseFloat(t1!.balance).toFixed(4)} {t1!.symbol})
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
