import type { Route } from "./+types/product";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Product - Compliant Postgres Environment Replicator | NYK Labs" },
    { name: "description", content: "Automate compliant PostgreSQL environment replication across AWS accounts. Built for regulated workloads, audit readiness, and secure Dev/Test parity." },
  ];
}

export default function Product() {
  return (
    <main>
      <section className="card">
        <h2>Compliant Postgres Environment Replicator</h2>
        <p className="product-intro">
          NYK Labs is developing a <strong>Compliant Postgres Environment Replicator</strong> for regulated AWS environments, 
          enabling secure data replication from production to development environments while maintaining compliance and data privacy.
        </p>

        <div className="product-section">
          <h3>Architecture Overview</h3>
          <p>
            Our solution provides a secure, one-way data flow that ensures production data never gets accessed directly 
            by development teams, while still enabling realistic testing and development environments.
          </p>
          
          <div className="architecture-diagram">
            <pre className="diagram">{`
┌─────────────┐
│  RDS PROD   │
└──────┬──────┘
       │
       │ (one-way, restricted, audited)
       ▼
┌──────────────────────────────────────┐
│ Secure Replication + Sanitization    │
│            Zone                      │
└──────────────┬───────────────────────┘
               │
               │ (already de-identified)
               ▼
┌──────────────────────────────────────┐
│   RDS DEV / TEST / STAGE             │
└──────────────────────────────────────┘
            `}</pre>
          </div>

          <p className="architecture-note">
            <strong>Key Principle:</strong> Dev teams never connect to production. Only a dedicated service within 
            the production boundary can read from production databases. Only sanitized, de-identified data ever leaves that boundary.
          </p>
        </div>

        <div className="product-section">
          <h3>Data Sanitization Capabilities</h3>
          <p>
            Our replicator employs multiple sanitization techniques to protect sensitive data while preserving data utility:
          </p>
          <div className="feature-grid">
            <div className="feature-card">
              <h4>🔐 Deterministic Tokenization</h4>
              <p>
                Replace sensitive values with consistent tokens that maintain referential integrity across tables 
                while ensuring the original values cannot be recovered.
              </p>
            </div>
            <div className="feature-card">
              <h4>🚫 Nulling</h4>
              <p>
                Remove highly sensitive fields entirely by replacing them with NULL values, ensuring no trace 
                of the original data remains.
              </p>
            </div>
            <div className="feature-card">
              <h4>📅 Date/Time Shifting</h4>
              <p>
                Preserve temporal patterns and relationships while obfuscating actual dates, maintaining 
                realistic test scenarios without exposing real timestamps.
              </p>
            </div>
            <div className="feature-card">
              <h4>#️⃣ Hashing</h4>
              <p>
                One-way hash sensitive identifiers to maintain uniqueness and searchability while making 
                the original values irreversible.
              </p>
            </div>
          </div>
          
          <div className="integrity-note">
            <h4>✅ Referential Integrity Preservation</h4>
            <p>
              All sanitization techniques maintain foreign key relationships and data consistency across tables, 
              ensuring your development environment remains functionally identical to production while being 
              completely de-identified.
            </p>
          </div>
        </div>

        <div className="product-section">
          <h3>Audit & Compliance Features</h3>
          <p>
            Every replication run is fully tracked and auditable, meeting strict regulatory requirements:
          </p>
          <ul className="compliance-list">
            <li>
              <strong>Who Requested:</strong> Complete user identification and authentication records
            </li>
            <li>
              <strong>Who Approved:</strong> Authorization chain and approval workflow tracking
            </li>
            <li>
              <strong>When Executed:</strong> Precise timestamps for request, approval, and execution
            </li>
            <li>
              <strong>Source & Destination:</strong> Full tracking of data flow from which RDS instance to which environment
            </li>
            <li>
              <strong>Policy Version:</strong> Exact sanitization policy version applied, with versioning and change tracking
            </li>
            <li>
              <strong>Immutable Audit Logs:</strong> Tamper-proof logs stored in append-only format for compliance verification
            </li>
          </ul>
        </div>

        <div className="product-section highlight">
          <h3>Security & Compliance Benefits</h3>
          <div className="benefits-grid">
            <div className="benefit-item">
              <span className="benefit-icon">🔒</span>
              <div>
                <h4>Zero Production Access</h4>
                <p>Development teams never need production database credentials or access</p>
              </div>
            </div>
            <div className="benefit-item">
              <span className="benefit-icon">✓</span>
              <div>
                <h4>Compliance Ready</h4>
                <p>Meets GDPR, HIPAA, SOC 2, and other regulatory requirements for data protection</p>
              </div>
            </div>
            <div className="benefit-item">
              <span className="benefit-icon">📊</span>
              <div>
                <h4>Complete Audit Trail</h4>
                <p>Every action logged and traceable for compliance audits</p>
              </div>
            </div>
            <div className="benefit-item">
              <span className="benefit-icon">🚀</span>
              <div>
                <h4>Developer Productivity</h4>
                <p>Realistic test data without compliance bottlenecks or security risks</p>
              </div>
            </div>
          </div>
        </div>

        <div className="product-section">
          <h3>Use Cases</h3>
          <ul className="feature-list">
            <li>
              <strong>Healthcare & HIPAA Compliance:</strong> Safely replicate patient databases for development and testing
            </li>
            <li>
              <strong>Financial Services:</strong> Create realistic test environments without exposing customer financial data
            </li>
            <li>
              <strong>E-commerce & PCI DSS:</strong> Develop and test payment systems with sanitized customer and payment data
            </li>
            <li>
              <strong>SaaS Platforms:</strong> Enable staging environments that mirror production without privacy risks
            </li>
            <li>
              <strong>Enterprise Applications:</strong> Facilitate safe data sharing across development, QA, and staging teams
            </li>
          </ul>
        </div>

        <div className="product-section">
          <h3>Technical Architecture</h3>
          <p>
            Built on modern AWS infrastructure for reliability and security:
          </p>
          <ul className="feature-list">
            <li>
              <strong>AWS Native:</strong> Designed specifically for Amazon RDS PostgreSQL environments
            </li>
            <li>
              <strong>Isolated Execution:</strong> Replication service runs in isolated VPC with strict security groups
            </li>
            <li>
              <strong>Encrypted Transit:</strong> All data movement uses TLS 1.3 encryption
            </li>
            <li>
              <strong>Policy-Driven:</strong> Declarative YAML-based sanitization policies with version control
            </li>
            <li>
              <strong>Scalable:</strong> Handles databases from gigabytes to terabytes efficiently
            </li>
            <li>
              <strong>Incremental Replication:</strong> Smart change detection minimizes data transfer and processing time
            </li>
          </ul>
        </div>
      </section>

      <style>{`
        .product-intro {
          font-size: 1.2rem;
          line-height: 1.7;
          margin-bottom: 2rem;
          padding: 1.5rem;
          background: rgba(34, 211, 238, 0.1);
          border-left: 4px solid var(--accent);
          border-radius: 4px;
        }

        .product-intro strong {
          color: var(--accent);
          font-size: 1.3rem;
        }

        .product-section {
          margin: 2.5rem 0;
          padding-bottom: 2rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .product-section:last-child {
          border-bottom: none;
        }

        .product-section h3 {
          color: var(--accent);
          font-size: 1.7rem;
          margin-bottom: 1.2rem;
        }

        .product-section h4 {
          font-size: 1.2rem;
          margin-bottom: 0.8rem;
          color: var(--text);
        }

        .product-section p {
          line-height: 1.8;
          margin-bottom: 1rem;
          color: var(--text);
        }

        .architecture-diagram {
          background: rgba(17, 24, 39, 0.8);
          border: 1px solid rgba(34, 211, 238, 0.3);
          border-radius: 8px;
          padding: 2rem;
          margin: 1.5rem 0;
          overflow-x: auto;
        }

        .diagram {
          font-family: 'Courier New', monospace;
          color: var(--accent);
          font-size: 0.95rem;
          line-height: 1.6;
          margin: 0;
          white-space: pre;
        }

        .architecture-note {
          background: rgba(34, 211, 238, 0.08);
          border-left: 3px solid var(--accent);
          padding: 1rem 1.5rem;
          margin-top: 1.5rem;
          border-radius: 0 4px 4px 0;
        }

        .architecture-note strong {
          color: var(--accent);
        }

        .feature-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 1.5rem;
          margin: 1.5rem 0;
        }

        .feature-card {
          background: rgba(17, 24, 39, 0.6);
          border: 1px solid rgba(34, 211, 238, 0.3);
          border-radius: 8px;
          padding: 1.5rem;
          transition: all 0.3s ease;
        }

        .feature-card:hover {
          border-color: var(--accent);
          background: rgba(17, 24, 39, 0.8);
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(34, 211, 238, 0.2);
        }

        .feature-card h4 {
          color: var(--accent);
          margin-bottom: 0.8rem;
          font-size: 1.1rem;
        }

        .feature-card p {
          font-size: 0.95rem;
          line-height: 1.6;
          margin: 0;
        }

        .integrity-note {
          background: rgba(34, 211, 238, 0.1);
          border: 1px solid rgba(34, 211, 238, 0.3);
          border-radius: 8px;
          padding: 1.5rem;
          margin-top: 2rem;
        }

        .integrity-note h4 {
          color: var(--accent);
          margin-top: 0;
          margin-bottom: 0.8rem;
        }

        .integrity-note p {
          margin: 0;
        }

        .compliance-list {
          list-style: none;
          padding: 0;
          margin: 1.5rem 0;
        }

        .compliance-list li {
          padding: 0.9rem 0;
          padding-left: 2rem;
          position: relative;
          line-height: 1.7;
          margin-bottom: 0.8rem;
          border-left: 3px solid var(--accent);
          background: rgba(34, 211, 238, 0.05);
          border-radius: 0 4px 4px 0;
        }

        .compliance-list li::before {
          content: "✓";
          position: absolute;
          left: 0.7rem;
          color: var(--accent);
          font-weight: bold;
        }

        .compliance-list li strong {
          color: var(--accent);
          font-weight: 600;
        }

        .feature-list {
          list-style: none;
          padding: 0;
          margin: 1.5rem 0;
        }

        .feature-list li {
          padding: 0.9rem 0;
          padding-left: 2rem;
          position: relative;
          line-height: 1.7;
          margin-bottom: 0.8rem;
          border-left: 3px solid var(--accent);
          background: rgba(34, 211, 238, 0.05);
          border-radius: 0 4px 4px 0;
        }

        .feature-list li::before {
          content: "→";
          position: absolute;
          left: 0.7rem;
          color: var(--accent);
          font-weight: bold;
        }

        .feature-list li strong {
          color: var(--accent);
          font-weight: 600;
        }

        .highlight {
          background: rgba(34, 211, 238, 0.08);
          border: 1px solid rgba(34, 211, 238, 0.3);
          border-radius: 8px;
          padding: 2rem;
        }

        .highlight h3 {
          margin-top: 0;
        }

        .benefits-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 1.5rem;
          margin-top: 1.5rem;
        }

        .benefit-item {
          display: flex;
          gap: 1rem;
          align-items: flex-start;
        }

        .benefit-icon {
          font-size: 2rem;
          flex-shrink: 0;
        }

        .benefit-item h4 {
          color: var(--accent);
          margin: 0 0 0.5rem 0;
          font-size: 1.1rem;
        }

        .benefit-item p {
          margin: 0;
          font-size: 0.95rem;
          line-height: 1.6;
        }

        a {
          color: var(--accent);
          text-decoration: none;
          border-bottom: 1px solid transparent;
          transition: border-color 0.2s;
        }

        a:hover {
          border-bottom-color: var(--accent);
        }

        @media (max-width: 768px) {
          .product-intro {
            font-size: 1.1rem;
            padding: 1.2rem;
          }

          .product-section h3 {
            font-size: 1.5rem;
          }

          .feature-grid,
          .benefits-grid {
            grid-template-columns: 1fr;
          }

          .diagram {
            font-size: 0.85rem;
          }

          .architecture-diagram {
            padding: 1rem;
          }
        }
      `}</style>
    </main>
  );
}
