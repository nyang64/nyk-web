import { useState } from 'react';
import type { Route } from "./+types/faq";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "FAQ | NYK Labs" },
    { name: "description", content: "Frequently asked questions about NYK Labs, nGX self-hosted email infrastructure, HLRR token, and the airdrop." },
  ];
}

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  // Helper function to render text with bold markdown
  const renderText = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*|\[.*?\]\(.*?\))/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      const linkMatch = part.match(/^\[(.*?)\]\((.*?)\)$/);
      if (linkMatch) {
        return <a key={i} href={linkMatch[2]} target="_blank" rel="noopener noreferrer">{linkMatch[1]}</a>;
      }
      return part;
    });
  };

  const faqs = [
    {
      category: "nGX — nyklabs Agent Exchange",
      questions: [
        {
          q: "What is nGX?",
          a: `**nGX (nyklabs Agent Exchange)** is self-hosted email infrastructure purpose-built for AI agents. It lets you provision real email inboxes for your agents — addresses like agent@mail.yourdomain.com — with a clean REST API, real-time webhook and WebSocket events, thread management, and a full SMTP pipeline with DKIM signing.

Unlike hosted email-for-agents services, nGX runs entirely inside your own infrastructure. Your data stays in your PostgreSQL and S3; your domain, your keys, your rules.`
        },
        {
          q: "How is nGX different from hosted email-for-agents services?",
          a: `Hosted services put your agents on a vendor's domain (e.g. agent@somevendor.to) and route all email through their infrastructure. That creates three problems for enterprises:

**Data control** — email bodies and conversation history live on a third-party server you don't own.

**Regulatory risk** — HIPAA, GDPR, SOC 2, and data-residency requirements are difficult or impossible to satisfy when sensitive communications pass through an external SaaS.

**Vendor dependency** — pricing, uptime, and feature decisions are outside your control.

nGX eliminates all three. You deploy it on your own servers, configure your own domain via the MAIL_DOMAIN environment variable, and own everything end-to-end.`
        },
        {
          q: "What infrastructure do I need to run nGX?",
          a: `For local evaluation, all dependencies run in Docker:

• **PostgreSQL** — primary data store (with Row-Level Security for tenant isolation)
• **Kafka** — event streaming backbone (inbound/outbound email queues, event fan-out)
• **Redis** — caching and WebSocket pub/sub
• **S3 / MinIO** — object storage for email bodies and attachments

The application services are standard Go binaries. A single make setup command starts the full infrastructure stack via Docker Compose and runs all database migrations.

For production, you additionally need DNS control over your mail domain (MX, SPF, DKIM, DMARC records).`
        },
        {
          q: "Is nGX free to use?",
          a: `nGX is **free for non-commercial use and evaluation** (up to 90 days for business evaluation). Production and business deployments require a commercial license from nyklabs.com.

The right to offer nGX as a hosted or managed cloud service is exclusively reserved for nyklabs.com — no third party may run nGX as a SaaS on behalf of others.

For licensing inquiries: [licensing@nyklabs.com](mailto:licensing@nyklabs.com)`
        },
        {
          q: "Can I deploy nGX on AWS, GCP, or Azure?",
          a: `Yes. nGX is cloud-agnostic — it runs on any infrastructure that supports Docker containers and the required backing services (Postgres, Kafka, Redis, S3-compatible storage).

For AWS deployments you can use RDS for Postgres, MSK for Kafka, ElastiCache for Redis, and S3 directly. GCP and Azure equivalents work the same way. nyklabs plans to offer cloud-native messaging adapters (SQS on AWS, Pub/Sub on GCP) as optional replacements for the self-managed Kafka dependency in a future release.`
        }
      ]
    },
    {
      category: "HLRR Token & Airdrop",
      questions: [
        {
          q: "What is HLRR and how do I participate in the airdrop?",
          a: `**Hashed Lierre (HLRR)** is a utility and access token on the Base network that powers the NYK Labs platform — unlocking features, developer tools, ecosystem programs, governance, and staking rewards. Maximum supply is fixed at 120M tokens.

The airdrop distributes HLRR to early supporters for free. Registration requires only your email and a Base-compatible wallet address (MetaMask, Coinbase Wallet, Trust Wallet). Email verification is required; without it you are not eligible. You may need a small amount of ETH on Base to cover gas fees when claiming on-chain.`
        },
        {
          q: "How is my allocation calculated, and can I earn more?",
          a: `The base allocation is **100 HLRR** per valid registration. Both email and wallet must be unique — the same email or wallet cannot be reused.

To earn more:

**Referrals** — after registration you receive a unique 8-character referral code. When someone registers using your code, both of you earn **+50 HLRR**. There is no cap on referrals.

**If you were not referred by anyone, leave the referral field blank.** Entering an invalid code causes registration to fail — all codes are validated in real time.`
        },
        {
          q: "How does wallet verification work, and is it safe?",
          a: `You sign a random nonce using your wallet's private key — the standard industry method for proving wallet ownership. Your private key never leaves your wallet, no transaction is authorized, and no funds can be moved through this process.

If you are uncomfortable, you can create a dedicated empty wallet for the airdrop without risking your main wallet. **NYK Labs will never ask for your private key, seed phrase, or password.** Anyone requesting those is a scammer.`
        },
        {
          q: "When will tokens be distributed, and how do I claim them?",
          a: `The distribution date will be announced on X (@NykLabs) and Discord once registration closes. Verified participants will receive an email with the schedule, claiming instructions, and staking details.

To claim, connect the same wallet you registered with. The tokens themselves are free; you will need a small amount of ETH on Base for on-chain gas fees.

If you encounter errors during registration: check that your wallet address is 42 characters starting with 0x, your email is unique and under 48 characters, and your referral code (if used) is exactly 8 characters. Wallet addresses cannot be changed after email verification.`
        },
        {
          q: "How does HLRR staking work?",
          a: `Visit the [Hashed Lierre page](/hashed-lierre) and connect your wallet on Base Mainnet. Minimum stake is 100 HLRR; a 14-day lock applies from your first ever stake (additional stakes do not reset the timer).

**Staking APR schedule:** 12% (Years 1–2) → 10% (Year 3) → 8% (Year 4) → 6% (Year 5) → 4% (Year 6+). Rewards auto-compound into your staked balance and continue until the 40M reserve is depleted.

To unstake, use **Partial Unstake** to withdraw a specific amount (rewards continue on the remainder), or **Unstake All & Claim Rewards** to receive your full balance plus all accrued rewards in one flow (requires 2 wallet confirmations if rewards are pending).`
        }
      ]
    },
    {
      category: "Security & Privacy",
      questions: [
        {
          q: "Is my information safe, and how do I know this isn't a scam?",
          a: `For the **airdrop**, we collect only your email and wallet address. Your wallet signature proves ownership and cannot authorize transactions or access funds. We never ask for private keys or seed phrases.

Legitimate airdrops never require you to send funds first or share your seed phrase. Always verify you are on the official NYK Labs website and follow announcements only through our official X (@NykLabs) and Discord channels.

For **nGX**, all data — email bodies, attachments, conversation history — stays in your own PostgreSQL and S3. NYK Labs never has access to the content of emails processed by a self-hosted nGX deployment.`
        }
      ]
    }
  ];

  return (
    <main>
      <section className="card">
        <h2>Frequently Asked Questions</h2>
        <p className="faq-intro">
          Find answers to common questions about NYK Labs, nGX self-hosted email infrastructure, the HLRR token, and the airdrop.
        </p>

        <div className="faq-container">
          {faqs.map((section, sectionIndex) => (
            <div key={sectionIndex} className="faq-section">
              <h3 className="faq-category">{section.category}</h3>
              
              {section.questions.map((faq, faqIndex) => {
                const globalIndex = sectionIndex * 100 + faqIndex;
                const isOpen = openIndex === globalIndex;
                
                return (
                  <div key={faqIndex} className={`faq-item ${isOpen ? 'open' : ''}`}>
                    <button 
                      className="faq-question"
                      onClick={() => toggleFAQ(globalIndex)}
                      aria-expanded={isOpen}
                    >
                      <span className="question-text">{faq.q}</span>
                      <span className="toggle-icon">{isOpen ? '−' : '+'}</span>
                    </button>
                    
                    {isOpen && (
                      <div className="faq-answer">
                        {faq.a.split('\n').map((paragraph, pIndex) => (
                          paragraph.trim() && (
                            <p key={pIndex}>{renderText(paragraph)}</p>
                          )
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div className="faq-footer">
          <h3>Still have questions?</h3>
          <div className="contact-methods">
            <p>
              <strong>Email:</strong> <a href="mailto:communications@nyklabs.com">communications@nyklabs.com</a>
            </p>
            <p>
              <strong>Discord:</strong> <a href="https://discord.gg/ExQrMWZ6" target="_blank" rel="noopener noreferrer">Join our community</a>
            </p>
            <p>
              <strong>X (Twitter):</strong> <a href="https://x.com/NykLabs" target="_blank" rel="noopener noreferrer">@NykLabs</a>
            </p>
          </div>
        </div>
      </section>

      <style>{`
        .faq-intro {
          font-size: 1.1rem;
          color: var(--muted);
          margin-bottom: 2rem;
          padding-bottom: 1.5rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .faq-container {
          display: flex;
          flex-direction: column;
          gap: 2.5rem;
        }

        .faq-section {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .faq-category {
          color: var(--accent);
          font-size: 1.5rem;
          margin-bottom: 1rem;
          padding-bottom: 0.5rem;
          border-bottom: 2px solid rgba(34, 211, 238, 0.3);
        }

        .faq-item {
          background: rgba(17, 24, 39, 0.4);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          overflow: hidden;
          transition: all 0.3s ease;
        }

        .faq-item:hover {
          border-color: rgba(34, 211, 238, 0.3);
        }

        .faq-item.open {
          background: rgba(17, 24, 39, 0.6);
          border-color: var(--accent);
        }

        .faq-question {
          width: 100%;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.25rem 1.5rem;
          background: transparent;
          border: none;
          color: var(--text);
          font-size: 1.1rem;
          font-weight: 500;
          text-align: left;
          cursor: pointer;
          transition: all 0.2s;
        }

        .faq-question:hover {
          color: var(--accent);
        }

        .question-text {
          flex: 1;
          padding-right: 1rem;
        }

        .toggle-icon {
          flex-shrink: 0;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(34, 211, 238, 0.1);
          border-radius: 50%;
          color: var(--accent);
          font-size: 1.5rem;
          font-weight: 300;
          transition: all 0.3s;
        }

        .faq-item.open .toggle-icon {
          background: var(--accent);
          color: #0f172a;
          transform: rotate(180deg);
        }

        .faq-answer {
          padding: 0 1.5rem 1.5rem 1.5rem;
          color: var(--text);
          line-height: 1.7;
          animation: fadeIn 0.3s ease-in-out;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .faq-answer p {
          margin-bottom: 1rem;
          white-space: pre-line;
        }

        .faq-answer p:last-child {
          margin-bottom: 0;
        }

        .faq-answer strong {
          color: var(--accent);
          font-weight: 600;
        }

        .faq-answer a {
          color: var(--accent);
          text-decoration: none;
          border-bottom: 1px solid transparent;
          transition: border-color 0.2s;
        }

        .faq-answer a:hover {
          border-bottom-color: var(--accent);
        }

        .faq-footer {
          margin-top: 3rem;
          padding-top: 2rem;
          border-top: 2px solid rgba(34, 211, 238, 0.3);
          text-align: center;
        }

        .faq-footer h3 {
          color: var(--accent);
          margin-bottom: 1.5rem;
        }

        .contact-methods {
          display: flex;
          flex-direction: column;
          gap: 0.8rem;
          align-items: center;
        }

        .contact-methods p {
          margin: 0;
        }

        .contact-methods strong {
          color: var(--accent);
          display: inline-block;
          min-width: 120px;
          text-align: right;
          margin-right: 0.5rem;
        }

        .contact-methods a {
          color: var(--accent);
          text-decoration: none;
          font-weight: 600;
        }

        .contact-methods a:hover {
          text-decoration: underline;
        }

        @media (max-width: 768px) {
          .faq-question {
            font-size: 1rem;
            padding: 1rem;
          }

          .question-text {
            padding-right: 0.75rem;
          }

          .toggle-icon {
            width: 28px;
            height: 28px;
            font-size: 1.3rem;
          }

          .faq-answer {
            padding: 0 1rem 1rem 1rem;
            font-size: 0.95rem;
          }

          .faq-category {
            font-size: 1.3rem;
          }

          .contact-methods {
            align-items: flex-start;
          }

          .contact-methods strong {
            min-width: 80px;
            text-align: left;
          }
        }
      `}</style>
    </main>
  );
}
