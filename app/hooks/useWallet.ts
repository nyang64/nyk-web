/**
 * useWallet — shared EIP-6963 multi-wallet hook.
 *
 * Manages wallet connection state (address, chainId, discovered wallets) and
 * exposes connect / disconnect helpers.  Pages wrap these in their own
 * try/catch to set page-level txStatus.
 */

import { useState, useEffect, useCallback, useRef } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on: (event: string, callback: (...args: unknown[]) => void) => void;
  removeListener: (event: string, callback: (...args: unknown[]) => void) => void;
  isMetaMask?: boolean;
  isTrust?: boolean;
  isCoinbaseWallet?: boolean;
};

export interface EIP6963ProviderInfo {
  uuid: string;
  name: string;
  icon: string;
  rdns: string;
}

export interface EIP6963ProviderDetail {
  info: EIP6963ProviderInfo;
  provider: EthereumProvider;
}

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
  interface WindowEventMap {
    "eip6963:announceProvider": CustomEvent<EIP6963ProviderDetail>;
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useWallet() {
  const [connectedAddress, setConnectedAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [discoveredWallets, setDiscoveredWallets] = useState<EIP6963ProviderDetail[]>([]);
  const [showWalletPicker, setShowWalletPicker] = useState(false);
  const activeProviderRef = useRef<EthereumProvider | null>(null);

  const getEthereum = useCallback((): EthereumProvider | null => {
    return activeProviderRef.current ?? window.ethereum ?? null;
  }, []);

  // ── Restore already-connected session on mount ──────────────────────────────
  useEffect(() => {
    const checkExisting = async () => {
      const eth = window.ethereum;
      if (!eth) return;
      try {
        const accounts = (await eth.request({ method: "eth_accounts" })) as string[];
        if (accounts.length > 0) {
          setConnectedAddress(accounts[0]);
          const hex = (await eth.request({ method: "eth_chainId" })) as string;
          setChainId(parseInt(hex, 16));
        }
      } catch {
        // silent
      }
    };
    checkExisting();

    if (window.ethereum) {
      const onAccountsChanged = (raw: unknown) => {
        const accs = raw as string[];
        if (accs.length === 0) {
          setConnectedAddress(null);
          setChainId(null);
          activeProviderRef.current = null;
        } else {
          setConnectedAddress(accs[0]);
        }
      };
      const onChainChanged = (rawChain: unknown) => {
        setChainId(parseInt(rawChain as string, 16));
      };
      window.ethereum.on("accountsChanged", onAccountsChanged);
      window.ethereum.on("chainChanged", onChainChanged);
      return () => {
        window.ethereum?.removeListener("accountsChanged", onAccountsChanged);
        window.ethereum?.removeListener("chainChanged", onChainChanged);
      };
    }
  }, []);

  // ── EIP-6963 wallet discovery ───────────────────────────────────────────────
  useEffect(() => {
    const found: EIP6963ProviderDetail[] = [];
    const handle = (e: CustomEvent<EIP6963ProviderDetail>) => {
      if (!found.find((w) => w.info.uuid === e.detail.info.uuid)) {
        found.push(e.detail);
        setDiscoveredWallets([...found]);
      }
    };
    window.addEventListener("eip6963:announceProvider", handle);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    return () => window.removeEventListener("eip6963:announceProvider", handle);
  }, []);

  // ── Connection helpers ──────────────────────────────────────────────────────

  /**
   * Connect using a specific EIP-6963 provider.
   * Throws on rejection so callers can handle txStatus.
   */
  const connectWithProvider = useCallback(
    async (detail: EIP6963ProviderDetail, forceAccountPicker = false): Promise<string> => {
      setShowWalletPicker(false);
      if (forceAccountPicker) {
        // wallet_requestPermissions opens the account selection UI in the wallet.
        await detail.provider.request({
          method: "wallet_requestPermissions",
          params: [{ eth_accounts: {} }],
        });
      }
      const accounts = (await detail.provider.request({
        method: "eth_accounts",
      })) as string[];
      if (!accounts.length) throw new Error("No accounts returned");
      activeProviderRef.current = detail.provider;
      setConnectedAddress(accounts[0]);
      const hex = (await detail.provider.request({ method: "eth_chainId" })) as string;
      setChainId(parseInt(hex, 16));
      return accounts[0];
    },
    []
  );

  /**
   * Force the wallet to show the account picker so the user can switch accounts.
   * Works with the currently active provider (or falls back to window.ethereum).
   */
  const switchAccount = useCallback(async (): Promise<string | null> => {
    const provider = activeProviderRef.current ?? window.ethereum ?? null;
    if (!provider) throw new Error("No wallet connected");
    // wallet_requestPermissions forces the wallet UI to show the account picker.
    await provider.request({
      method: "wallet_requestPermissions",
      params: [{ eth_accounts: {} }],
    });
    const accounts = (await provider.request({ method: "eth_accounts" })) as string[];
    if (!accounts.length) return null;
    setConnectedAddress(accounts[0]);
    return accounts[0];
  }, []);

  /**
   * Connect wallet.
   * - If multiple wallets found: opens picker, returns null.
   * - If single wallet: connects directly, returns address.
   * - Throws on error.
   */
  const connectWallet = useCallback(async (): Promise<string | null> => {
    if (!discoveredWallets.length && !window.ethereum) {
      throw new Error("Please install MetaMask or another Web3 wallet.");
    }
    if (discoveredWallets.length > 1) {
      setShowWalletPicker(true);
      return null;
    }
    const single = discoveredWallets[0];
    if (single) return connectWithProvider(single, true);

    // Fallback for non-EIP-6963 wallets
    const accounts = (await window.ethereum!.request({
      method: "eth_requestAccounts",
    })) as string[];
    if (!accounts.length) throw new Error("No accounts returned");
    setConnectedAddress(accounts[0]);
    const hex = (await window.ethereum!.request({ method: "eth_chainId" })) as string;
    setChainId(parseInt(hex, 16));
    return accounts[0];
  }, [discoveredWallets, connectWithProvider]);

  /** Clears connection state.  Pages should also clear their own derived state. */
  const disconnectWallet = useCallback(() => {
    setConnectedAddress(null);
    setChainId(null);
    activeProviderRef.current = null;
  }, []);

  return {
    connectedAddress,
    chainId,
    discoveredWallets,
    showWalletPicker,
    setShowWalletPicker,
    getEthereum,
    connectWithProvider,
    connectWallet,
    switchAccount,
    disconnectWallet,
  };
}
