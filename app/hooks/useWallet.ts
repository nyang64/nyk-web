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
  // Holds the cleanup function for the currently active provider's event listeners.
  const listenerCleanupRef = useRef<(() => void) | null>(null);

  const getEthereum = useCallback((): EthereumProvider | null => {
    return activeProviderRef.current ?? window.ethereum ?? null;
  }, []);

  // ── Attach chainChanged / accountsChanged to whichever provider is active ───
  //
  // Previously these were attached only to window.ethereum at mount time.
  // When the user connects via EIP-6963, the active provider may be a different
  // object — chain switches in the wallet fired on that object and were never
  // seen by the hook.  Now we re-attach whenever the active provider changes.

  const attachListeners = useCallback((provider: EthereumProvider) => {
    // Remove listeners from the previous provider before attaching new ones.
    listenerCleanupRef.current?.();

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

    provider.on("accountsChanged", onAccountsChanged);
    provider.on("chainChanged", onChainChanged);

    listenerCleanupRef.current = () => {
      provider.removeListener("accountsChanged", onAccountsChanged);
      provider.removeListener("chainChanged", onChainChanged);
    };
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

  // ── Restore already-connected session on mount ──────────────────────────────
  // Use the rdns saved in sessionStorage to find the correct EIP-6963 provider
  // so we never accidentally fall back to window.ethereum (which may be hijacked
  // by a different wallet extension such as Trust Wallet).
  useEffect(() => {
    const savedRdns = sessionStorage.getItem("nyk_wallet_rdns");
    const restoreSession = async () => {
      // Find the matching EIP-6963 provider for the previously chosen wallet.
      const match = savedRdns
        ? discoveredWallets.find((w) => w.info.rdns === savedRdns)
        : null;
      const eth = match?.provider ?? (discoveredWallets.length === 1 ? discoveredWallets[0].provider : null) ?? window.ethereum;
      if (!eth) return;
      try {
        const accounts = (await eth.request({ method: "eth_accounts" })) as string[];
        if (accounts.length > 0) {
          activeProviderRef.current = eth;
          attachListeners(eth);
          setConnectedAddress(accounts[0]);
          const hex = (await eth.request({ method: "eth_chainId" })) as string;
          setChainId(parseInt(hex, 16));
        }
      } catch {
        // silent
      }
    };
    restoreSession();
    return () => {
      listenerCleanupRef.current?.();
    };
  }, [discoveredWallets, attachListeners]);

  // ── Connection helpers ──────────────────────────────────────────────────────

  /**
   * Connect using a specific EIP-6963 provider.
   * Always revokes existing permission first so the wallet shows the full
   * account picker — this is the correct behaviour for both first-connect
   * and switch-account flows.
   * Throws on rejection so callers can handle txStatus.
   */
  const connectWithProvider = useCallback(
    async (detail: EIP6963ProviderDetail): Promise<string> => {
      setShowWalletPicker(false);
      // Revoke so wallet cannot silently reuse a previously selected account.
      try {
        await detail.provider.request({
          method: "wallet_revokePermissions",
          params: [{ eth_accounts: {} }],
        });
      } catch {
        // Not all wallets support wallet_revokePermissions — continue.
      }
      // With permission cleared, eth_requestAccounts forces the account picker UI.
      const accounts = (await detail.provider.request({
        method: "eth_requestAccounts",
      })) as string[];
      if (!accounts.length) throw new Error("No accounts returned");
      activeProviderRef.current = detail.provider;
      // Persist chosen wallet so page reload restores the correct provider.
      sessionStorage.setItem("nyk_wallet_rdns", detail.info.rdns);
      // Re-attach listeners to the newly active provider so chain/account
      // changes are captured regardless of which provider object is active.
      attachListeners(detail.provider);
      setConnectedAddress(accounts[0]);
      const hex = (await detail.provider.request({ method: "eth_chainId" })) as string;
      setChainId(parseInt(hex, 16));
      return accounts[0];
    },
    [attachListeners]
  );

  /**
   * Clear current connection and open the wallet picker so the user can
   * select a wallet extension and account from scratch.
   */
  const switchAccount = useCallback(() => {
    setConnectedAddress(null);
    setChainId(null);
    activeProviderRef.current = null;
    setShowWalletPicker(true);
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
    if (single) return connectWithProvider(single);

    // Fallback for non-EIP-6963 wallets
    try {
      await window.ethereum!.request({
        method: "wallet_revokePermissions",
        params: [{ eth_accounts: {} }],
      });
    } catch { /* not supported */ }
    const accounts = (await window.ethereum!.request({
      method: "eth_requestAccounts",
    })) as string[];
    if (!accounts.length) throw new Error("No accounts returned");
    activeProviderRef.current = window.ethereum!;
    attachListeners(window.ethereum!);
    setConnectedAddress(accounts[0]);
    const hex = (await window.ethereum!.request({ method: "eth_chainId" })) as string;
    setChainId(parseInt(hex, 16));
    return accounts[0];
  }, [discoveredWallets, connectWithProvider, attachListeners]);

  /**
   * Ask the wallet to switch to the given chain.
   * Throws with code 4902 if the chain is not yet added to the wallet —
   * callers can catch this and prompt the user to add it.
   */
  const switchNetwork = useCallback(async (targetChainId: number): Promise<void> => {
    const eth = getEthereum();
    if (!eth) throw new Error("No wallet connected");
    await eth.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: `0x${targetChainId.toString(16)}` }],
    });
  }, [getEthereum]);

  /** Clears connection state.  Pages should also clear their own derived state. */
  const disconnectWallet = useCallback(() => {
    setConnectedAddress(null);
    setChainId(null);
    activeProviderRef.current = null;
    sessionStorage.removeItem("nyk_wallet_rdns");
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
    switchNetwork,
    disconnectWallet,
  };
}
