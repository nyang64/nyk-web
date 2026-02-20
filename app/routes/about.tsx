import type { Route } from "./+types/about";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "About - NYK Labs" },
    { name: "description", content: "Learn more about NYK Labs and our mission." },
  ];
}

export default function About() {
  return (
    <main>
      <section className="card">
        <h2>About NYK Labs</h2>
        <p>
          NYK Labs is a technology-focused lab exploring modern software engineering,
          data platforms, cloud infrastructure, and blockchain systems.
        </p>
        <p>
          We focus on building robust, scalable, and secure systems — from backend
          services and distributed architectures to Web3 and digital asset workflows.
        </p>
        <p>
          Our team combines expertise in software development, data engineering, and
          blockchain technology to deliver innovative solutions for complex technical
          challenges.
        </p>
        
        <h3>Our Focus Areas</h3>
        <ul>
          <li><strong>Software Engineering:</strong> Building scalable, maintainable applications with modern frameworks and best practices</li>
          <li><strong>Data Platforms:</strong> Designing and implementing robust data pipelines and analytics infrastructure</li>
          <li><strong>Cloud Infrastructure:</strong> Leveraging AWS and other cloud services for reliable, high-performance systems</li>
          <li><strong>Blockchain & Web3:</strong> Exploring decentralized technologies and digital asset ecosystems</li>
        </ul>

        <h3>Our Approach</h3>
        <p>
          We believe in rigorous engineering practices, continuous learning, and staying
          at the forefront of technological innovation. Our work spans from theoretical
          research to practical implementation, always with an eye toward real-world impact.
        </p>

        <div className="contact">
          <h3>Get in Touch</h3>
          <p>
            Interested in collaboration or learning more about our work?
          </p>
          <div className="contact-links">
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
        .card h3 {
          color: var(--accent);
          margin-top: 2rem;
          margin-bottom: 1rem;
          font-size: 1.5rem;
        }

        .card ul {
          list-style: none;
          padding-left: 0;
          margin: 1rem 0;
        }

        .card ul li {
          padding: 0.75rem 0;
          padding-left: 1.5rem;
          position: relative;
          line-height: 1.6;
          border-left: 3px solid var(--accent);
          margin-bottom: 0.5rem;
          background: rgba(34, 211, 238, 0.05);
          border-radius: 0 4px 4px 0;
        }

        .card ul li::before {
          content: "→";
          position: absolute;
          left: 0.5rem;
          color: var(--accent);
          font-weight: bold;
        }

        .card ul li strong {
          color: var(--accent);
        }

        .contact {
          margin-top: 2rem;
          padding: 1.5rem;
          background: rgba(34, 211, 238, 0.1);
          border: 1px solid rgba(34, 211, 238, 0.3);
          border-radius: 8px;
        }

        .contact h3 {
          margin-top: 0;
        }

        .contact-links {
          margin-top: 1.5rem;
        }

        .contact-links p {
          margin: 0.8rem 0;
          line-height: 1.6;
        }

        .contact-links strong {
          color: var(--accent);
          display: inline-block;
          min-width: 100px;
        }

        .contact-links a {
          color: var(--accent);
          text-decoration: none;
          border-bottom: 1px solid transparent;
          transition: border-color 0.2s;
        }

        .contact-links a:hover {
          border-bottom-color: var(--accent);
        }
      `}</style>
    </main>
  );
}
