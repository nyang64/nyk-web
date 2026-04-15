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
        <div className="ngx-hero">
          <h2>
            nGX{" "}
            <span className="ngx-subtitle">nyklabs Agent Exchange</span>
          </h2>
          <p className="ngx-tagline">
            Self-hosted email infrastructure for AI agents —{" "}
            <strong>on your domain, your servers, your terms.</strong>
          </p>
        </div>

        <div className="ngx-description">
          <p>
            AI agents need real email addresses. Hosted email-for-agents
            services put your agents on a vendor's domain and route all
            communications through their infrastructure. nGX is the
            alternative: a complete, open-core email platform you deploy
            inside your own environment.
          </p>
          <p>
            Your agents get addresses like{" "}
            <code>agent@mail.yourdomain.com</code>. Email bodies, attachments,
            and conversation history stay in your own PostgreSQL and S3. DKIM
            keys are yours. Compliance obligations — HIPAA, GDPR, SOC 2, data
            residency — are met without negotiating a vendor BAA or DPA.
          </p>
        </div>

        <div className="ngx-highlights">
          <div className="ngx-highlight-item">
            <span className="ngx-highlight-icon">🏢</span>
            <div>
              <strong>Enterprise self-hosted</strong>
              <p>Deploy on your infrastructure. No vendor lock-in, no per-seat subscription.</p>
            </div>
          </div>
          <div className="ngx-highlight-item">
            <span className="ngx-highlight-icon">🔒</span>
            <div>
              <strong>Regulatory compliance</strong>
              <p>Email never leaves your environment. Meet HIPAA, GDPR, SOC 2, and data residency requirements by design.</p>
            </div>
          </div>
          <div className="ngx-highlight-item">
            <span className="ngx-highlight-icon">🌐</span>
            <div>
              <strong>Your domain, your brand</strong>
              <p>Configure <code>MAIL_DOMAIN=mail.yourdomain.com</code> and every inbox provisions under your domain.</p>
            </div>
          </div>
          <div className="ngx-highlight-item">
            <span className="ngx-highlight-icon">⚡</span>
            <div>
              <strong>Full email pipeline</strong>
              <p>Inbound SMTP with DKIM/SPF/DMARC, outbound MX delivery, webhooks, real-time WebSocket events, and a clean REST API.</p>
            </div>
          </div>
        </div>

        <div className="ngx-repo-link">
          <a
            href="https://github.com/nyang64/nGX"
            target="_blank"
            rel="noopener noreferrer"
            className="ngx-btn"
          >
            View on GitHub →
          </a>
          <span className="ngx-license-note">
            Source-available · Free to evaluate · Commercial license for
            production use
          </span>
        </div>

        <div className="ngx-section">
          <h3>Local Test Setup</h3>
          <p>
            nGX runs entirely in Docker for local development — no cloud
            account or DNS configuration needed.
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
              <strong>Clone and configure</strong>
              <pre className="ngx-code">{`git clone https://github.com/nyang64/nGX
cd nGX
cp .env.example .env
# Optional: set MAIL_DOMAIN=mail.yourdomain.com in .env
# Leave blank to use full addresses (e.g. agent@localhost) during evaluation`}</pre>
            </div>
          </div>

          <div className="ngx-step">
            <span className="ngx-step-num">3</span>
            <div>
              <strong>Start infrastructure and run migrations</strong>
              <pre className="ngx-code">{`make up          # starts Postgres, Kafka, Redis, MinIO, MailHog
make migrate-up  # applies all database migrations`}</pre>
            </div>
          </div>

          <div className="ngx-step">
            <span className="ngx-step-num">4</span>
            <div>
              <strong>Start services</strong>
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

          <div className="ngx-step">
            <span className="ngx-step-num">5</span>
            <div>
              <strong>Create an inbox and send a test email</strong>
              <pre className="ngx-code">{`# Create org + API key (see README for full bootstrap steps)
# Then provision an inbox:
curl -X POST http://localhost:8080/v1/inboxes \\
  -H "Authorization: Bearer $KEY" \\
  -d '{"address":"agent"}'
# → agent@mail.yourdomain.com (or agent@localhost if MAIL_DOMAIN not set)

# Send outbound:
curl -X POST http://localhost:8080/v1/inboxes/<id>/messages/send \\
  -H "Authorization: Bearer $KEY" \\
  -d '{"to":[{"email":"test@example.com"}],"subject":"Hello from nGX","body_text":"It works."}'`}</pre>
            </div>
          </div>

          <p className="ngx-mailhog-note">
            Outbound mail in local dev is captured by{" "}
            <strong>MailHog</strong> at{" "}
            <a href="http://localhost:8025" target="_blank" rel="noopener noreferrer">
              localhost:8025
            </a>{" "}
            — no real email is delivered during evaluation.
          </p>
        </div>

        <div className="ngx-contact">
          <p>
            Interested in a commercial license or cloud deployment?{" "}
            <a href="mailto:licensing@nyklabs.com">licensing@nyklabs.com</a>
          </p>
        </div>
      </section>

      <style>{`
        .ngx-hero {
          margin-bottom: 1.75rem;
        }
        .ngx-hero h2 {
          font-size: 2rem;
          font-weight: 700;
          margin-bottom: 0.4rem;
          display: flex;
          align-items: baseline;
          gap: 0.75rem;
          flex-wrap: wrap;
        }
        .ngx-subtitle {
          font-size: 1rem;
          font-weight: 400;
          color: var(--muted);
          letter-spacing: 0.02em;
        }
        .ngx-tagline {
          font-size: 1.1rem;
          color: var(--text);
          margin: 0;
        }

        .ngx-description {
          margin-bottom: 2rem;
          border-left: 3px solid var(--accent);
          padding-left: 1rem;
        }
        .ngx-description p {
          color: var(--muted);
          line-height: 1.7;
          margin-bottom: 0.75rem;
        }
        .ngx-description p:last-child { margin-bottom: 0; }
        .ngx-description code {
          color: var(--accent);
          font-size: 0.88rem;
        }

        .ngx-highlights {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
          margin-bottom: 2rem;
        }
        @media (max-width: 580px) {
          .ngx-highlights { grid-template-columns: 1fr; }
        }
        .ngx-highlight-item {
          display: flex;
          gap: 0.75rem;
          align-items: flex-start;
          background: rgba(34, 211, 238, 0.05);
          border: 1px solid rgba(34, 211, 238, 0.15);
          border-radius: 8px;
          padding: 1rem;
        }
        .ngx-highlight-icon {
          font-size: 1.4rem;
          line-height: 1;
          flex-shrink: 0;
        }
        .ngx-highlight-item strong {
          display: block;
          color: var(--text);
          margin-bottom: 0.25rem;
          font-size: 0.95rem;
        }
        .ngx-highlight-item p {
          color: var(--muted);
          font-size: 0.85rem;
          margin: 0;
          line-height: 1.5;
        }
        .ngx-highlight-item code {
          color: var(--accent);
          font-size: 0.8rem;
        }

        .ngx-repo-link {
          display: flex;
          align-items: center;
          gap: 1.25rem;
          flex-wrap: wrap;
          margin-bottom: 2.5rem;
        }
        .ngx-btn {
          display: inline-block;
          background: var(--accent);
          color: #0f172a;
          font-weight: 700;
          padding: 0.55rem 1.25rem;
          border-radius: 6px;
          text-decoration: none;
          font-size: 0.95rem;
          white-space: nowrap;
          transition: opacity 0.15s;
        }
        .ngx-btn:hover { opacity: 0.85; }
        .ngx-license-note {
          color: var(--muted);
          font-size: 0.82rem;
        }

        .ngx-section {
          margin-bottom: 2rem;
        }
        .ngx-section h3 {
          color: var(--accent);
          font-size: 1.15rem;
          margin-bottom: 0.6rem;
        }
        .ngx-section > p {
          color: var(--muted);
          margin-bottom: 1.25rem;
          font-size: 0.95rem;
        }

        .ngx-step {
          display: flex;
          gap: 1rem;
          align-items: flex-start;
          margin-bottom: 1.25rem;
        }
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
          margin-top: 0.1rem;
        }
        .ngx-step strong {
          display: block;
          color: var(--text);
          margin-bottom: 0.4rem;
          font-size: 0.95rem;
        }
        .ngx-code {
          background: #0a0f1a;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 6px;
          padding: 0.75rem 1rem;
          color: #a3e635;
          font-size: 0.8rem;
          line-height: 1.6;
          overflow-x: auto;
          white-space: pre;
          margin: 0;
        }

        .ngx-mailhog-note {
          color: var(--muted);
          font-size: 0.85rem;
          margin-top: 1rem;
          padding: 0.65rem 1rem;
          background: rgba(255,255,255,0.03);
          border-radius: 6px;
        }
        .ngx-mailhog-note a {
          color: var(--accent);
        }

        .ngx-contact {
          border-top: 1px solid rgba(255,255,255,0.08);
          padding-top: 1.25rem;
          margin-top: 0.5rem;
          color: var(--muted);
          font-size: 0.9rem;
        }
        .ngx-contact a {
          color: var(--accent);
        }
      `}</style>
    </main>
  );
}
