import { useState } from 'react';
import type { Route } from "./+types/faq";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "FAQ - NYK Labs Airdrop" },
    { name: "description", content: "Frequently asked questions about NYK Labs, HLRR token, and the airdrop." },
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
      category: "General Information",
      questions: [
        {
          q: "What is the Hashed Lierre Token (HLRR)?",
          a: `Hashed Lierre Token (HLRR) is a cryptocurrency token being distributed through an airdrop campaign. Register to claim your free tokens before the opportunity expires.`
        },
        {
          q: "What is an airdrop?",
          a: `An airdrop is a distribution of cryptocurrency tokens to multiple wallet addresses, usually for free. It's a way for projects to distribute tokens to early supporters and build community engagement.`
        },
        {
          q: "Is this airdrop really free?",
          a: `Yes, registration and token claiming are completely free. You only need to provide your email and wallet address. However, you may need to pay gas fees when claiming tokens on the blockchain, depending on the network conditions.`
        }
      ]
    },
    {
      category: "HLRR Token Airdrop Allocation",
      questions: [
        {
          q: "How much HLRR will I receive in the airdrop?",
          a: `The base airdrop allocation is **100 HLRR tokens** per valid registration with a unique email and wallet address pair.`
        },
        {
          q: "How does the uniqueness validation work?",
          a: `Both your email address AND wallet address must be unique:

• **One email + One wallet = One unit (100 HLRR)**
• You cannot use the same email with different wallets
• You cannot use the same wallet with different emails
• Each unique email AND wallet pair = one airdrop unit

To receive multiple airdrop units, you must register with completely unique email and wallet combinations.`
        },
        {
          q: "Can I get more than 100 HLRR tokens?",
          a: `Yes! There are two ways to increase your airdrop allocation:

**Method 1: Multiple Unique Registrations**
Register with different unique email AND wallet pairs. Each valid pair receives 100 HLRR.

**Method 2: Referrals (Recommended)**
Refer friends and family using your referral code:
• You receive an additional **50 HLRR** per successful referral
• Your friend also receives **50 HLRR bonus**
• No limit on referrals
• Much easier than managing multiple email/wallet pairs!`
        },
        {
          q: "How do referrals work?",
          a: `The referral system works as follows:

**When You Register:**
1. Complete the registration form
2. You'll receive a unique referral code
3. Save this code and share it with friends and family

**When Someone Uses Your Code:**
• They enter your referral code during registration
• Both you and your friend receive **+50 HLRR bonus**
• The bonus is tracked automatically

**Important Notes:**
• If you weren't referred by anyone, leave the referral field BLANK
• If you enter an invalid referral code, registration will fail
• The backend validates all referral codes
• Only use a referral code if someone actually referred you`
        },
        {
          q: "What if I enter a wrong referral code?",
          a: `If you enter an invalid or non-existent referral code, your registration will be rejected by the backend. The system validates referral codes in real-time and performs accounting to ensure:

• The referral code exists
• Both parties receive their bonuses correctly
• No fraudulent referrals are processed

**Best Practice**: Only enter a referral code if someone gave it to you. If you're registering on your own, leave it blank.`
        },
        {
          q: "Can I check how many tokens I'll receive?",
          a: `Yes! We will provide a link where you can check your total airdrop allocation soon. This will show:

• Base allocation (100 HLRR)
• Referral bonuses earned
• Total HLRR tokens you'll receive

Stay tuned for the announcement of this feature.`
        }
      ]
    },
    {
      category: "Technical & Registration",
      questions: [
        {
          q: "Why do I need to verify my wallet ownership?",
          a: `We require wallet verification to ensure that only legitimate wallet owners can register for airdrops. This prevents someone from registering your wallet address without your permission.

The verification works by having you sign a random number (called a nonce) using your wallet's private key. This is the standard, industry-approved method for proving wallet ownership and is completely safe:

• Your private key never leaves your wallet
• You're only signing a message, not authorizing any transaction
• No funds can be moved or accessed through this process

If you're still uncomfortable with the verification process, you have two options:

1. Choose not to participate in the airdrop
2. Create a new, empty wallet specifically for receiving airdrops and use that for registration

This way, even if you have concerns, you can still participate without risking your main wallet.`
        },
        {
          q: "Which blockchain networks are supported for wallets?",
          a: `We support wallets on the following networks:

• Ethereum
• Base
• Binance Smart Chain

Make sure your wallet is compatible with the network you select. You will NOT receive HLRR tokens if your wallet cannot connect to the chosen network.`
        },
        {
          q: "What wallet should I use?",
          a: `You can use any Web3 wallet that supports the blockchain networks we support (Ethereum, Base, Binance Smart Chain). Popular options include MetaMask, Trust Wallet, or Coinbase Wallet. You'll need MetaMask or a similar browser extension wallet to complete the verification process.`
        },
        {
          q: "Do I need to verify my email?",
          a: `Yes, email verification is required. After registration:

1. Check your inbox for a verification email from NYK Labs
2. Click the verification link in the email
3. You'll be redirected to a confirmation page
4. Your registration is complete once verified

Without email verification, you will not be eligible for the airdrop.`
        },
        {
          q: "I don't see my email verification. What should I do?",
          a: `Check your spam or junk folder. Gmail is preferred as some email providers (especially Yahoo) may have deliverability issues. If you still don't receive it after 10 minutes, you may need to register again with a different email address.`
        },
        {
          q: "Can I register multiple times?",
          a: `No, each email address and wallet address can only be registered once. Multiple registrations with the same information will be rejected.`
        },
        {
          q: "What is the referral code and how does it work?",
          a: `After successful registration, you'll receive a unique 8-character referral code. Share this code with friends - when they use your code during registration, both you and your friend will earn bonus airdrops.`
        },
        {
          q: "What happens after I register?",
          a: `After successful registration and email verification:

1. Your email and wallet are recorded in our system
2. Your referral code is generated and displayed
3. You're eligible for the airdrop distribution
4. Share your referral code to earn bonus tokens
5. Follow up on X and Discord
6. Wait for the official airdrop distribution announcement in X and Discord channel`
        }
      ]
    },
    {
      category: "Token Distribution & Claims",
      questions: [
        {
          q: "When will I receive my tokens?",
          a: `Token distribution dates will be announced on our X (Twitter) and Discord channels. Make sure to follow our social media for updates on when and how to claim your airdrop.`
        },
        {
          q: "When will the airdrop be distributed?",
          a: `The airdrop distribution date will be announced once registration closes. All verified participants will receive email notifications with:

• Distribution schedule
• Instructions for claiming tokens
• Wallet setup guidance (if needed)
• Staking information

Follow our official channels for updates.`
        },
        {
          q: "How do I claim my tokens?",
          a: `Claiming instructions will be provided through our official channels (X and Discord) closer to the distribution date. You'll need to connect the same wallet you registered with to claim your tokens.`
        },
        {
          q: "Do I need to pay anything to claim my tokens?",
          a: `The tokens themselves are free, but you'll need to pay blockchain gas fees to claim them. Gas fees vary depending on network congestion and which blockchain you selected (Ethereum, Base, or Binance Smart Chain).`
        }
      ]
    },
    {
      category: "Staking & Token Value",
      questions: [
        {
          q: "Can I stake my airdrop tokens?",
          a: `Yes! Once you receive your HLRR tokens, you can stake them to earn rewards:

• Initial APR: 12% (Years 1-2)
• APR reduces by 2% annually until reaching 4%
• Final APR: 4% (Year 6 onwards)
• Rewards continue until 40M staking reserve is depleted

Visit the Hashed Lierre page for complete staking details.`
        },
        {
          q: "How do I stake my HLRR tokens?",
          a: `You can stake HLRR directly via the token contract on Base Mainnet using Blockscout:

1. Go to [HLRR contract on Blockscout](https://base.blockscout.com/address/0x5E1583d48bcFd60de77138ea195f3EFbe128405d?tab=write_contract) and connect your wallet (must be on Base Mainnet and hold HLRR)
2. Find **function 64** in the Write Contract tab
3. Click **Simulate** first to verify the transaction will succeed
4. If simulation passes, click **Write** to execute the staking transaction
5. Confirm the transaction in your wallet

Make sure you have a small amount of ETH on Base Mainnet to cover gas fees.`
        },
        {
          q: "How do I unstake my HLRR tokens?",
          a: `To unstake HLRR, follow the same process as staking but use a different function:

1. Go to [HLRR contract on Blockscout](https://base.blockscout.com/address/0x5E1583d48bcFd60de77138ea195f3EFbe128405d?tab=write_contract) and connect your wallet (must be on Base Mainnet)
2. Find **function 75** in the Write Contract tab
3. Click **Simulate** first to verify the transaction will succeed
4. If simulation passes, click **Write** to execute the unstaking transaction
5. Confirm the transaction in your wallet

Your HLRR tokens will be returned to your wallet after the transaction confirms.`
        },
        {
          q: "What gives HLRR tokens value?",
          a: `The NYK token is a utility and access token that powers the Nyk Labs platform. It is used to unlock features, access developer tools and services, participate in ecosystem programs, and coordinate activity across applications built by Nyk Labs. Over time, the token will support community governance, reputation, and incentive mechanisms designed to align builders, users, and contributors.

The NYK token is not intended to be a security or financial instrument. It does not represent ownership, equity, or any claim on the assets, profits, or operations of Nyk Labs or any affiliated entity. Its value is derived solely from its utility within the ecosystem.

Key utility features:

• **Platform Access**: Unlock features and services within the Nyk Labs ecosystem
• **Developer Tools**: Access to specialized tools and APIs for building applications
• **Ecosystem Programs**: Participate in community initiatives and programs
• **Governance**: Vote on protocol upgrades and community proposals
• **Staking Rewards**: Earn passive income by staking tokens
• **Scarcity**: Fixed maximum supply of 120M tokens`
        }
      ]
    },
    {
      category: "Troubleshooting",
      questions: [
        {
          q: "I'm getting an error during registration. What should I do?",
          a: `Common issues include: invalid wallet address format (must be 42 characters starting with 0x), email already registered, or referral code incorrect length (must be exactly 8 characters or empty). Make sure you've completed the CAPTCHA verification and wallet ownership verification before submitting.`
        },
        {
          q: "I made a mistake in my wallet address. Can I change it?",
          a: `Once registered and email verified, wallet addresses cannot be changed. Please double-check your wallet address before submitting the registration form.`
        },
        {
          q: "The website says my email is invalid, but it's correct?",
          a: `Ensure your email follows standard format (example@domain.com) and is less than 48 characters. Also, avoid using temporary or disposable email services.`
        }
      ]
    },
    {
      category: "Security & Privacy",
      questions: [
        {
          q: "Is my information safe?",
          a: `We only collect your email address and wallet address for airdrop distribution purposes. Your wallet verification signature is only used to prove ownership and cannot be used to access your funds or authorize transactions. We never ask for your private keys or seed phrases.`
        },
        {
          q: "Will you ever ask for my private keys or seed phrase?",
          a: `NEVER. We will never ask for your private keys, seed phrase, or password. Anyone asking for this information is a scammer. Only share your wallet address (which starts with 0x).`
        },
        {
          q: "How do I know this isn't a scam?",
          a: `Legitimate airdrops never ask for private keys or require you to send funds first. We only ask for your email and wallet address. Always verify you're on the official website and follow official social media channels for updates.`
        }
      ]
    }
  ];

  return (
    <main>
      <section className="card">
        <h2>Frequently Asked Questions</h2>
        <p className="faq-intro">
          Find answers to common questions about NYK Labs, the HLRR token, and the airdrop registration process.
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
