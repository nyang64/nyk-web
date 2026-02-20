import type { Route } from "./+types/privacy";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Privacy Policy - NYK Labs" },
    { name: "description", content: "Privacy policy for NYK Labs." },
  ];
}

export default function Privacy() {
  return (
    <main>
      <div className="content-page card">
        <h1>Privacy Policy</h1>
        <p className="small">Last Update Date: <strong>1/8/2026</strong></p>

        <section>
          <p>This Privacy Policy applies to your use of the website, services, applications, and systems provided by NYK Labs ("we", "us", or "our") at <strong>nyklabs.com</strong>. This Policy explains how we collect, use, store, disclose, and protect personal data when you visit our website or interact with our services.</p>
        </section>

        <section>
          <h2 className="section-title">1. Important Information</h2>
          <p>1.1 Certain components of the NYK Labs website and services may not be available or intended for residents of jurisdictions where we are not licensed to operate or provide services.</p>
          <p>1.2 This Privacy Policy supplements any other agreements you have with NYK Labs and is not intended to override them.</p>
          <p>1.3 NYK Labs may not be the controller responsible for your personal data. 3rd party we use as transaction processor (e.g. Ramp network) may be the controller</p>
          <p>1.4 For questions about this Privacy Policy or to exercise your privacy rights, you may contact us at:<br />
          <strong>Email:</strong> <a href="mailto:communications@nyklabs.com">communications@nyklabs.com</a></p>
          <p>Contact Address: 10419 NE 32 PL E104, Bellevue, WA 98004</p>
        </section>

        <section>
          <h2 className="section-title">2. The Data We Collect About You</h2>
          <p>We collect data about you in connection with your use of our website or app and services, including but not limited to:</p>
          <ul>
            <li>Collected information may include email address, name, ID, wallet address, payment details</li>
            <li>Technical and usage data collected through cookies and similar technologies</li>
            <li>Profile data you provide when you sign up for newsletters or otherwise interact with us</li>
          </ul>
        </section>

        <section>
          <h2 className="section-title">3. How Data Is Collected</h2>
          <p>We collect data through various means, including:</p>
          <ul>
            <li>Direct interactions (e.g., contact forms, widget input, subscriptions)</li>
            <li>Automated technologies (e.g., cookies, server logs)</li>
            <li>Third-party sources (e.g., analytics providers)</li>
          </ul>
        </section>

        <section>
          <h2 className="section-title">4. How We Use Your Data</h2>
          <p>We use the data for purposes including:</p>
          <ul>
            <li>Transaction Processing: To facilitate buying/selling crypto</li>
            <li>Identity Verification (KYC/AML): For legal compliance</li>
            <li>3rd party data processor: We may use Ramp or Moonpay as payment processor</li>
            <li>Security: To prevent fraud</li>
            <li>Responding to inquiries</li>
            <li>Sending you relevant communications, where you have consented to receive them</li>
          </ul>
          <p>We will only use your data where we have a lawful basis under applicable law.</p>
        </section>

        <section>
          <h2 className="section-title">5. Disclosure of Your Personal Data</h2>
          <p>We may share your personal data with third parties when necessary for delivery of services, compliance with legal obligations, and where permitted by law.</p>
          <p>Specifically, we may use Ramp widget for on ramp, off ramp, and for exchange of crypto. We may not have direct visibility to your sensitive personal data, e.g. credit card number, or bank account, 
            the 3rd party (e.g. Ramp networks) that provided the widget has those information, and they are responsible for your personal data security. They do have robust security measures in place
          to safeguard your sensitive personal data. We only got tokenized (hashed) values of your credit card, or bank account, which has no resemblance to your credit card number or bank account.</p>
        </section>

        <section>
          <h2 className="section-title">6. International Transfers</h2>
          <p>Your personal data may be transferred to and processed in countries other than your own. We will take appropriate safeguards to ensure your data remains protected.</p>
        </section>

        <section>
          <h2 className="section-title">7. Data Security</h2>
          <p>We implement appropriate technical and organizational measures to protect your data against unauthorized or unlawful processing, loss, or destruction.</p>
        </section>

        <section>
          <h2 className="section-title">8. Data Retention</h2>
          <p>We retain data for as long as necessary to fulfill the purposes for which it was collected, including legal, accounting, or reporting requirements.</p>
        </section>

        <section>
          <h2 className="section-title">9. Your Privacy Rights</h2>
          <p>You may have rights under applicable privacy laws, such as the right to access, correct, delete, or restrict the processing of your data. To exercise such rights, please contact us at <a href="mailto:communications@nyklabs.com">communications@nyklabs.com</a>.</p>
        </section>

        <section>
          <h2 className="section-title">10. Changes to This Privacy Policy</h2>
          <p>We may update this Privacy Policy from time to time. Any changes will be posted on this page, and the updated version will be effective upon posting.</p>
        </section>

        <section>
          <h2 className="section-title">11. Cookies</h2>
          <p>We use cookies and similar technologies to enhance your experience on our website. By continuing to use our services, you consent to our use of cookies in accordance with this policy.</p>
        </section>
      </div>
    </main>
  );
}
