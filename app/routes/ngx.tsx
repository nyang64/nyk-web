import type { Route } from "./+types/ngx";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "nGX — nyklabs Agent Exchange | NYK Labs" },
    {
      name: "description",
      content:
        "nGX is self-hosted email infrastructure for AI agents. Deploy on your own domain, your own servers — full control over data, compliance, and deliverability.",
    },
  ];
}

export default function NGX() {
  return (
    <main>
      <section className="card">
        <h2 className="ngx-title">nGX <span className="ngx-full-name">nyklabs Agent Exchange</span></h2>

        <div className="intro">
          <p>
            AI agents need real email addresses. Hosted email-for-agents services put your agents on a vendor's domain
            and route all communications through their infrastructure.{" "}
            <strong>nGX is the alternative</strong> — a complete email platform you deploy inside your own
            environment, on your own domain, under your own control.
          </p>
        </div>

        <h3>Why Self-Host?</h3>
        <ul className="utility-list">
          <li>
            <strong>Your domain, your brand</strong>
            Configure <code>MAIL_DOMAIN=mail.yourdomain.com</code> and every agent inbox provisions under your domain —
            not <em>agent@somevendor.to</em>.
          </li>
          <li>
            <strong>Regulatory compliance</strong>
            Email content never leaves your environment. Meet HIPAA, GDPR, SOC 2, and data residency requirements
            by design — no vendor BAA or DPA negotiation required.
          </li>
          <li>
            <strong>Enterprise self-hosted</strong>
            Deploy on your own infrastructure. No per-seat subscription, no uptime dependency on a third party.
          </li>
          <li>
            <strong>Full pipeline, fully owned</strong>
            Inbound SMTP with DKIM/SPF/DMARC, outbound MX delivery, webhooks with HMAC signatures, real-time
            WebSocket events, and a clean REST API — all running on your hardware.
          </li>
        </ul>

        <div className="ngx-repo-row">
          <a
            href="https://github.com/nyang64/nGX"
            target="_blank"
            rel="noopener noreferrer"
            className="cta-button"
          >
            View on GitHub →
          </a>
          <span className="ngx-license-note">
            Source-available &nbsp;·&nbsp; Free to evaluate &nbsp;·&nbsp; Commercial license for production use
          </span>
        </div>

        <h3>Local Test Setup</h3>
        <p style={{ marginBottom: "1.5rem", lineHeight: "1.7" }}>
          nGX runs entirely in Docker for local development — no cloud account or DNS configuration needed.
          Choose the quick path or the step-by-step path below.
        </p>

        <div className="ngx-tabs">
          {/* ── Option A: Make (one-liner) ── */}
          <div className="ngx-option">
            <div className="ngx-option-header">
              <span className="ngx-option-badge">Option A</span>
              <span className="ngx-option-title">One-command bootstrap</span>
            </div>
            <p className="ngx-option-desc">
              The Makefile orchestrates Docker Compose for all infrastructure and runs database migrations in one shot.
            </p>

            <div className="ngx-step">
              <span className="ngx-step-num">1</span>
              <div>
                <strong>Prerequisites</strong>
                <pre className="ngx-code">Go 1.23+, Docker, Docker Compose, Make</pre>
              </div>
            </div>

            <div className="ngx-step">
              <span className="ngx-step-num">2</span>
              <div>
                <strong>Clone, configure, and bootstrap</strong>
                <pre className="ngx-code">{`git clone https://github.com/nyang64/nGX && cd nGX
cp .env.example .env
# Edit .env — set MAIL_DOMAIN=mail.yourdomain.com (or leave blank for evaluation)
make setup        # starts infra via Docker Compose + runs all migrations`}</pre>
              </div>
            </div>

            <div className="ngx-step">
              <span className="ngx-step-num">3</span>
              <div>
                <strong>Start application services</strong>
                <pre className="ngx-code">{`# Core services
go run ./services/auth/cmd/auth   &   # :8081
go run ./services/inbox/cmd/inbox &   # :8082
go run ./services/api/cmd/api         # :8080

# Pipeline and events (separate terminal)
go run ./services/email-pipeline/cmd/email-pipeline     &
go run ./services/event-dispatcher/cmd/event-dispatcher &
go run ./services/webhook-service/cmd/webhook-service   &`}</pre>
              </div>
            </div>
          </div>

          {/* ── Option B: Docker Compose ── */}
          <div className="ngx-option">
            <div className="ngx-option-header">
              <span className="ngx-option-badge">Option B</span>
              <span className="ngx-option-title">Docker Compose step-by-step</span>
            </div>
            <p className="ngx-option-desc">
              Run the infrastructure stack manually for more control over each component.
            </p>

            <div className="ngx-step">
              <span className="ngx-step-num">1</span>
              <div>
                <strong>Clone and configure</strong>
                <pre className="ngx-code">{`git clone https://github.com/nyang64/nGX && cd nGX
cp .env.example .env
# Edit .env — set MAIL_DOMAIN, DKIM_DOMAIN, and other required values`}</pre>
              </div>
            </div>

            <div className="ngx-step">
              <span className="ngx-step-num">2</span>
              <div>
                <strong>Start infrastructure with Docker Compose</strong>
                <pre className="ngx-code">{`docker compose up -d
# Starts: PostgreSQL, Kafka, Redis, MinIO, MailHog
# PostgreSQL  → localhost:5432
# Kafka       → localhost:9092
# Redis       → localhost:6379
# MinIO       → localhost:9000  (console: localhost:9001)
# MailHog     → localhost:8025  (SMTP sink + web UI)`}</pre>
              </div>
            </div>

            <div className="ngx-step">
              <span className="ngx-step-num">3</span>
              <div>
                <strong>Run database migrations</strong>
                <pre className="ngx-code">{`make migrate-up
# Applies all SQL migrations to the local Postgres instance`}</pre>
              </div>
            </div>

            <div className="ngx-step">
              <span className="ngx-step-num">4</span>
              <div>
                <strong>Start application services</strong>
                <pre className="ngx-code">{`go run ./services/auth/cmd/auth   &   # :8081
go run ./services/inbox/cmd/inbox &   # :8082
go run ./services/api/cmd/api         # :8080
go run ./services/email-pipeline/cmd/email-pipeline     &
go run ./services/event-dispatcher/cmd/event-dispatcher &
go run ./services/webhook-service/cmd/webhook-service   &`}</pre>
              </div>
            </div>

            <div className="ngx-step">
              <span className="ngx-step-num">5</span>
              <div>
                <strong>Verify all containers are healthy</strong>
                <pre className="ngx-code">{`docker compose ps
# All services should show status: Up (healthy)`}</pre>
              </div>
            </div>
          </div>
        </div>

        {/* ── Common last step ── */}
        <h3>Try It Out</h3>
        <p style={{ marginBottom: "1.25rem", lineHeight: "1.7" }}>
          Once services are running, create an inbox and send a test message. Outbound mail in local dev is
          captured by <strong>MailHog</strong> at{" "}
          <a href="http://localhost:8025" target="_blank" rel="noopener noreferrer" className="ngx-inline-link">
            localhost:8025
          </a>{" "}
          — no real email is delivered during evaluation.
        </p>

        <pre className="ngx-code">{`# Create org + API key — see README for full bootstrap
export KEY=am_live_xxxx

# Provision an inbox (username only — MAIL_DOMAIN is appended automatically)
curl -X POST http://localhost:8080/v1/inboxes \\
  -H "Authorization: Bearer $KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"address":"agent"}'
# → inbox.email will be "agent@mail.yourdomain.com"

# Send a test email
curl -X POST http://localhost:8080/v1/inboxes/<inbox-id>/messages/send \\
  -H "Authorization: Bearer $KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"to":[{"email":"test@example.com"}],"subject":"Hello from nGX","body_text":"It works."}'

# Check MailHog web UI for the captured message
open http://localhost:8025`}</pre>

        <div className="cta-section" style={{ marginTop: "3rem" }}>
          <h3>Commercial Licensing</h3>
          <p>
            nGX is free to evaluate. Production and business deployments require a commercial license.
            Cloud hosting rights are exclusively reserved for nyklabs.com.
          </p>
          <a href="mailto:licensing@nyklabs.com" className="cta-button">
            Contact for Licensing →
          </a>
        </div>
      </section>

      <style>{`
        .ngx-title {
          display: flex;
          align-items: baseline;
          gap: 0.75rem;
          flex-wrap: wrap;
          font-size: 2rem;
          font-weight: 700;
          margin-bottom: 1.5rem;
        }
        .ngx-full-name {
          font-size: 1rem;
          font-weight: 400;
          color: var(--muted);
          letter-spacing: 0.02em;
        }

        .intro {
          background: rgba(34,211,238,0.1);
          border-left: 4px solid var(--accent);
          padding: 1.5rem;
          margin-bottom: 2rem;
          border-radius: 0 8px 8px 0;
        }
        .intro p {
          margin: 0;
          font-size: 1.05rem;
          line-height: 1.7;
        }

        h3 {
          color: var(--accent);
          font-size: 1.3rem;
          margin-top: 2.5rem;
          margin-bottom: 1.25rem;
          padding-bottom: 0.5rem;
          border-bottom: 2px solid rgba(34,211,238,0.3);
        }

        .utility-list {
          list-style: none;
          padding: 0;
          margin-bottom: 2rem;
        }
        .utility-list li {
          padding: 1rem;
          margin-bottom: 1rem;
          background: rgba(34,211,238,0.05);
          border-left: 3px solid var(--accent);
          border-radius: 0 6px 6px 0;
          line-height: 1.6;
        }
        .utility-list li strong {
          color: var(--accent);
          display: block;
          margin-bottom: 0.4rem;
          font-size: 1rem;
        }
        .utility-list li code {
          font-family: 'Courier New', monospace;
          font-size: 0.88rem;
          color: var(--text);
          background: rgba(0,0,0,0.3);
          padding: 0.1em 0.4em;
          border-radius: 3px;
        }

        .ngx-repo-row {
          display: flex;
          align-items: center;
          gap: 1.25rem;
          flex-wrap: wrap;
          margin-bottom: 2.5rem;
        }
        .ngx-license-note {
          font-size: 0.85rem;
          color: var(--muted);
        }

        .ngx-tabs {
          display: flex;
          flex-direction: column;
          gap: 2rem;
          margin-bottom: 2.5rem;
        }
        .ngx-option {
          background: rgba(17,24,39,0.6);
          border: 1px solid rgba(34,211,238,0.3);
          border-radius: 12px;
          padding: 1.5rem;
        }
        .ngx-option-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 0.75rem;
        }
        .ngx-option-badge {
          background: var(--accent);
          color: #0f172a;
          font-size: 0.75rem;
          font-weight: 700;
          padding: 0.2rem 0.6rem;
          border-radius: 4px;
          letter-spacing: 0.04em;
          white-space: nowrap;
        }
        .ngx-option-title {
          font-size: 1.05rem;
          font-weight: 600;
          color: var(--text);
        }
        .ngx-option-desc {
          font-size: 0.9rem;
          color: var(--muted);
          margin-bottom: 1.25rem;
          line-height: 1.6;
        }

        .ngx-step {
          display: flex;
          gap: 1rem;
          align-items: flex-start;
          margin-bottom: 1.25rem;
        }
        .ngx-step:last-child { margin-bottom: 0; }
        .ngx-step-num {
          flex-shrink: 0;
          width: 1.75rem;
          height: 1.75rem;
          border-radius: 50%;
          background: var(--accent);
          color: #0f172a;
          font-weight: 700;
          font-size: 0.85rem;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-top: 0.15rem;
        }
        .ngx-step strong {
          display: block;
          color: var(--text);
          margin-bottom: 0.5rem;
          font-size: 0.95rem;
        }

        .ngx-code {
          background: rgba(0,0,0,0.4);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 6px;
          padding: 0.85rem 1rem;
          color: var(--text);
          font-family: 'Courier New', monospace;
          font-size: 0.82rem;
          line-height: 1.65;
          overflow-x: auto;
          white-space: pre;
          margin: 0;
        }

        .ngx-inline-link {
          color: var(--accent);
          text-decoration: underline;
          text-underline-offset: 2px;
        }

        .cta-section {
          background: linear-gradient(135deg, rgba(34,211,238,0.15), rgba(34,211,238,0.05));
          border: 1px solid rgba(34,211,238,0.3);
          border-radius: 12px;
          padding: 2rem;
          text-align: center;
        }
        .cta-section h3 {
          margin-top: 0;
          border: none;
          padding: 0;
        }
        .cta-section p {
          font-size: 1rem;
          margin-bottom: 1.5rem;
          line-height: 1.7;
          color: var(--muted);
        }
        .cta-button {
          display: inline-block;
          background: var(--accent);
          color: #0f172a;
          padding: 0.75rem 2rem;
          border-radius: 8px;
          text-decoration: none;
          font-weight: 600;
          font-size: 1rem;
          transition: all 0.3s;
        }
        .cta-button:hover {
          background: #06b6d4;
          transform: translateY(-2px);
          box-shadow: 0 8px 16px rgba(34,211,238,0.3);
        }

        @media (max-width: 600px) {
          .ngx-title { font-size: 1.5rem; }
          .ngx-repo-row { flex-direction: column; align-items: flex-start; }
          .ngx-code { font-size: 0.75rem; }
        }
      `}</style>
    </main>
  );
}
