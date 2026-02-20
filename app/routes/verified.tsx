import type { Route } from "./+types/verified";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Email Verified - NYK Labs" },
    { name: "description", content: "Your email has been verified for the Hashed Lierre airdrop." },
  ];
}

export default function Verified() {
  return (
    <main>
      <section className="card">
        <div className="verification-success">
          <div className="success-icon">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              fill="none" 
              viewBox="0 0 24 24" 
              strokeWidth={2} 
              stroke="currentColor" 
              className="check-icon"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
              />
            </svg>
          </div>
          
          <h2>Email Verified Successfully!</h2>
          
          <p className="verification-message">
            Thank you for confirming your email address. Your registration for the 
            Hashed Lierre Token (HLRR) airdrop is now complete.
          </p>

          <div className="next-steps">
            <h3>What's Next?</h3>
            <ul>
              <li>You will receive your HLRR tokens during the airdrop distribution</li>
              <li>Make sure your wallet address is correct and can connect to the network you selected</li>
              <li>Share your referral code with friends to earn bonus tokens</li>
              <li>Follow us on X and Discord for updates and announcements</li>
            </ul>
          </div>

          <div className="action-buttons">
            <a href="/hashed-lierre" className="button primary">
              Learn More About HLRR
            </a>
            <a href="/" className="button secondary">
              Return to Home
            </a>
          </div>
        </div>
      </section>

      <style>{`
        .verification-success {
          text-align: center;
          padding: 2rem;
          max-width: 600px;
          margin: 0 auto;
        }

        .success-icon {
          margin: 0 auto 2rem;
          width: 80px;
          height: 80px;
        }

        .check-icon {
          width: 100%;
          height: 100%;
          color: var(--accent);
          animation: checkmark 0.6s ease-in-out;
        }

        @keyframes checkmark {
          0% {
            transform: scale(0);
            opacity: 0;
          }
          50% {
            transform: scale(1.2);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        .verification-success h2 {
          color: var(--accent);
          margin-bottom: 1.5rem;
          font-size: 2rem;
        }

        .verification-message {
          font-size: 1.1rem;
          line-height: 1.6;
          margin-bottom: 2rem;
          color: var(--text);
        }

        .next-steps {
          text-align: left;
          background: rgba(34, 211, 238, 0.1);
          border: 1px solid rgba(34, 211, 238, 0.3);
          border-radius: 8px;
          padding: 1.5rem;
          margin-bottom: 2rem;
        }

        .next-steps h3 {
          color: var(--accent);
          margin-bottom: 1rem;
          font-size: 1.3rem;
        }

        .next-steps ul {
          list-style: none;
          padding: 0;
        }

        .next-steps li {
          padding: 0.5rem 0;
          padding-left: 1.5rem;
          position: relative;
          line-height: 1.5;
        }

        .next-steps li::before {
          content: "✓";
          position: absolute;
          left: 0;
          color: var(--accent);
          font-weight: bold;
        }

        .action-buttons {
          display: flex;
          gap: 1rem;
          justify-content: center;
          flex-wrap: wrap;
          margin-top: 2rem;
        }

        .button {
          display: inline-block;
          padding: 0.75rem 1.5rem;
          border-radius: 6px;
          text-decoration: none;
          font-weight: 500;
          transition: all 0.3s ease;
          border: none;
          cursor: pointer;
        }

        .button.primary {
          background: var(--accent);
          color: #0f172a;
        }

        .button.primary:hover {
          background: #06b6d4;
          transform: translateY(-2px);
        }

        .button.secondary {
          background: transparent;
          color: var(--accent);
          border: 2px solid var(--accent);
        }

        .button.secondary:hover {
          background: rgba(34, 211, 238, 0.1);
          transform: translateY(-2px);
        }

        @media (max-width: 768px) {
          .verification-success {
            padding: 1rem;
          }

          .verification-success h2 {
            font-size: 1.5rem;
          }

          .verification-message {
            font-size: 1rem;
          }

          .action-buttons {
            flex-direction: column;
          }

          .button {
            width: 100%;
          }
        }
      `}</style>
    </main>
  );
}
