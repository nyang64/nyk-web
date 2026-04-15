import { useState, useRef, useEffect } from "react";

const CHAT_API = "https://rui4vxq763zvd7flyslkbr6g7i0cdeud.lambda-url.us-west-2.on.aws/chat";
const BRIDGE_SECRET = "9a2b3a97590dc2904c094a1afbf73a5c693dd3d340b2276b98033f2000ba99e4";
const SESSION_KEY = "nyk-chat-session";

function getSessionId(): string {
  let sid = sessionStorage.getItem(SESSION_KEY);
  if (!sid) {
    sid = `web-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    sessionStorage.setItem(SESSION_KEY, sid);
  }
  return sid;
}

interface Message {
  role: "user" | "assistant";
  text: string;
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text }]);
    setLoading(true);
    try {
      const res = await fetch(CHAT_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Bridge-Secret": BRIDGE_SECRET,
        },
        body: JSON.stringify({ message: text, session_id: getSessionId() }),
      });
      const data = await res.json();
      const reply = data.text || data.error || "No response received.";
      setMessages((m) => [...m, { role: "assistant", text: reply }]);
    } catch (err) {
      console.error("[ChatWidget] fetch error:", err);
      setMessages((m) => [
        ...m,
        { role: "assistant", text: "Connection error. Please try again." },
      ]);
    }
    setLoading(false);
  }

  return (
    <>
      {open && (
        <div className="chat-panel">
          <div className="chat-header">
            <span>Amy</span>
            <button
              className="chat-close"
              onClick={() => setOpen(false)}
              aria-label="Close chat"
            >
              ✕
            </button>
          </div>

          <div className="chat-messages">
            {messages.length === 0 && (
              <p className="chat-welcome">
                Hi, I'm Amy — NYK Labs' AI assistant. I know our products
                inside out, but feel free to ask me anything.
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`chat-msg chat-msg--${m.role}`}>
                {m.text}
              </div>
            ))}
            {loading && (
              <div className="chat-msg chat-msg--assistant chat-thinking">
                <span className="dot" />
                <span className="dot" />
                <span className="dot" />
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="chat-input-row">
            <input
              ref={inputRef}
              className="chat-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Ask me anything…"
              disabled={loading}
            />
            <button
              className="chat-send"
              onClick={send}
              disabled={loading || !input.trim()}
              aria-label="Send"
            >
              ➤
            </button>
          </div>
        </div>
      )}

      <button
        className="chat-fab"
        onClick={() => setOpen((o) => !o)}
        aria-label="Chat with NYK Assistant"
      >
        {open ? "✕" : "💬"}
      </button>

      <style>{`
        .chat-fab {
          position: fixed;
          bottom: 1.5rem;
          right: 1.5rem;
          width: 3.25rem;
          height: 3.25rem;
          border-radius: 50%;
          background: var(--accent);
          color: #0f172a;
          border: none;
          font-size: 1.4rem;
          cursor: pointer;
          z-index: 998;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 16px rgba(34,211,238,0.35);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .chat-fab:hover {
          transform: scale(1.08);
          box-shadow: 0 6px 20px rgba(34,211,238,0.5);
        }

        .chat-panel {
          position: fixed;
          bottom: 5.5rem;
          right: 1.5rem;
          width: 22rem;
          max-width: calc(100vw - 2rem);
          height: 30rem;
          max-height: calc(100vh - 8rem);
          background: var(--card);
          border: 1px solid rgba(34,211,238,0.25);
          border-radius: 12px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.5);
          z-index: 997;
          display: flex;
          flex-direction: column;
          animation: chatSlideUp 0.2s ease-out;
        }

        @keyframes chatSlideUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .chat-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.75rem 1rem;
          border-bottom: 1px solid rgba(34,211,238,0.15);
          font-weight: 600;
          font-size: 0.95rem;
          color: var(--accent);
          flex-shrink: 0;
        }

        .chat-close {
          background: none;
          border: none;
          color: var(--muted);
          cursor: pointer;
          font-size: 1rem;
          padding: 0.2rem 0.4rem;
          transition: color 0.2s;
        }
        .chat-close:hover { color: var(--text); }

        .chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 0.75rem 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          scrollbar-width: thin;
          scrollbar-color: rgba(34,211,238,0.2) transparent;
        }

        .chat-welcome {
          color: var(--muted);
          font-size: 0.875rem;
          text-align: center;
          padding: 1.5rem 0.5rem;
          line-height: 1.6;
          margin: 0;
        }

        .chat-msg {
          max-width: 85%;
          padding: 0.5rem 0.75rem;
          border-radius: 10px;
          font-size: 0.875rem;
          line-height: 1.55;
          word-break: break-word;
          white-space: pre-wrap;
        }
        .chat-msg--user {
          align-self: flex-end;
          background: rgba(34,211,238,0.12);
          color: var(--text);
          border: 1px solid rgba(34,211,238,0.2);
        }
        .chat-msg--assistant {
          align-self: flex-start;
          background: rgba(255,255,255,0.04);
          color: var(--text);
          border: 1px solid rgba(255,255,255,0.07);
        }

        .chat-thinking {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 0.6rem 0.75rem;
        }
        .dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--accent);
          animation: dotBounce 1.2s infinite;
        }
        .dot:nth-child(2) { animation-delay: 0.2s; }
        .dot:nth-child(3) { animation-delay: 0.4s; }
        @keyframes dotBounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.35; }
          30% { transform: translateY(-5px); opacity: 1; }
        }

        .chat-input-row {
          display: flex;
          gap: 0.5rem;
          padding: 0.75rem;
          border-top: 1px solid rgba(34,211,238,0.15);
          flex-shrink: 0;
        }

        .chat-input {
          flex: 1;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 6px;
          padding: 0.5rem 0.75rem;
          color: var(--text);
          font-size: 0.875rem;
          font-family: inherit;
          outline: none;
          transition: border-color 0.2s;
          min-width: 0;
        }
        .chat-input:focus { border-color: rgba(34,211,238,0.5); }
        .chat-input:disabled { opacity: 0.5; }
        .chat-input::placeholder { color: var(--muted); }

        .chat-send {
          background: var(--accent);
          color: #0f172a;
          border: none;
          border-radius: 6px;
          padding: 0.5rem 0.8rem;
          font-size: 1rem;
          cursor: pointer;
          flex-shrink: 0;
          transition: opacity 0.2s;
        }
        .chat-send:disabled { opacity: 0.3; cursor: default; }
        .chat-send:not(:disabled):hover { opacity: 0.8; }

        @media (max-width: 480px) {
          .chat-panel {
            right: 0.75rem;
            width: calc(100vw - 1.5rem);
            bottom: 5rem;
          }
          .chat-fab {
            right: 0.75rem;
            bottom: 0.75rem;
          }
        }
      `}</style>
    </>
  );
}
