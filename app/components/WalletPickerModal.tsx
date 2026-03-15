/**
 * WalletPickerModal — reusable modal for EIP-6963 multi-wallet selection.
 */

import type { EIP6963ProviderDetail } from "../hooks/useWallet";

interface Props {
  wallets: EIP6963ProviderDetail[];
  onSelect: (detail: EIP6963ProviderDetail) => void;
  onClose: () => void;
}

export function WalletPickerModal({ wallets, onSelect, onClose }: Props) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#1e293b",
          border: "1px solid rgba(34,211,238,0.3)",
          borderRadius: "12px",
          padding: "1.5rem",
          minWidth: "280px",
          maxWidth: "360px",
          width: "90%",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: "0 0 1rem", color: "var(--accent)", fontSize: "1.1rem" }}>
          Choose Wallet
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {wallets.map((w) => (
            <button
              key={w.info.uuid}
              type="button"
              onClick={() => onSelect(w)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                padding: "0.875rem 1rem",
                background: "rgba(34,211,238,0.06)",
                border: "1px solid rgba(34,211,238,0.25)",
                borderRadius: "8px",
                color: "var(--text)",
                fontSize: "1rem",
                fontWeight: 600,
                cursor: "pointer",
                transition: "border-color 0.2s",
                textAlign: "left",
              }}
              onMouseOver={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
              onMouseOut={(e) =>
                (e.currentTarget.style.borderColor = "rgba(34,211,238,0.25)")
              }
            >
              {w.info.icon && (
                <img
                  src={w.info.icon}
                  alt=""
                  style={{ width: "28px", height: "28px", borderRadius: "6px" }}
                />
              )}
              {w.info.name}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            marginTop: "1rem",
            width: "100%",
            padding: "0.5rem",
            background: "transparent",
            border: "1px solid #374151",
            borderRadius: "6px",
            color: "var(--muted)",
            fontSize: "0.85rem",
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
