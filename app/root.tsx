import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  NavLink,
} from "react-router";
import { useState } from "react";

import type { Route } from "./+types/root";
import "./app.css";

function VisitorCounter() {
  return (
    <span style={{ display: "inline-flex", alignItems: "flex-end" }}>
      Visitors:&nbsp;
      <iframe
        src="/visitor-counter.html"
        style={{ border: "none", width: "200px", height: "40px" }}
        scrolling="no"
        title="Visitor Counter"
      />
    </span>
  );
}

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [hashedLierreOpen, setHashedLierreOpen] = useState(false);

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <link rel="preconnect" href="https://challenges.cloudflare.com"/>
        <Links />
        <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
      </head>
      <body>
        <nav>
          <ul>
            <li>
              <NavLink to="/" className="logo-link">
                <img className="inline-icon" src="/nyk-logo.png" alt="NYK Labs" />
                NYK Labs
              </NavLink>
            </li>
            <li>
              <NavLink to="/product">Product</NavLink>
            </li>
            <li>
              <NavLink to="/puzzle">Daily Puzzle</NavLink>
            </li>
            <li
              className="dropdown"
              onMouseEnter={() => setHashedLierreOpen(true)}
              onMouseLeave={() => setHashedLierreOpen(false)}
            >
              <NavLink to="/hashed-lierre" className="dropdown-toggle">
                Hashed Lierre
                <span className="dropdown-arrow">▼</span>
              </NavLink>
              {hashedLierreOpen && (
                <ul className="dropdown-menu">
                  <li>
                    <NavLink to="/registration">Registration for Airdrop</NavLink>
                  </li>
                  <li>
                    <NavLink to="/presale">Hashed Lierre Presale</NavLink>
                  </li>
                  <li>
                    <NavLink to="/purchase-crypto">Purchase Crypto</NavLink>
                  </li>
                </ul>
              )}
            </li>
            <li>
              <NavLink to="/faq">FAQ</NavLink>
            </li>
            <li>
              <NavLink to="/about">About</NavLink>
            </li>
          </ul>
        </nav>
        {children}
        <footer>
          <p>
            © {new Date().getFullYear()} NYK Labs. All rights reserved.
            &nbsp;|&nbsp;
            <NavLink to="/privacy">Privacy Policy</NavLink>
            &nbsp;|&nbsp;
            <NavLink to="/terms">Terms & Conditions</NavLink>
            &nbsp;|&nbsp;
            <VisitorCounter />
          </p>
        </footer>
        <style>{`
          .dropdown {
            position: relative;
            display: flex;
            align-items: stretch;
          }

          .dropdown-toggle {
            display: flex;
            align-items: center;
            gap: 0.3rem;
            padding: 0.5rem 0;
          }

          .dropdown-arrow {
            font-size: 0.7rem;
            transition: transform 0.3s ease;
          }

          .dropdown:hover .dropdown-arrow {
            transform: rotate(180deg);
          }

          .dropdown-menu {
            position: absolute;
            top: calc(100% + 0.5rem);
            left: 0;
            background: rgba(15, 23, 42, 0.98);
            border: 1px solid rgba(34, 211, 238, 0.3);
            border-radius: 4px;
            min-width: 200px;
            padding: 0.5rem 0;
            margin-top: 0;
            list-style: none;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            z-index: 1000;
            animation: fadeIn 0.2s ease-in-out;
          }

          /* Invisible bridge to keep hover state */
          .dropdown::after {
            content: '';
            position: absolute;
            top: 100%;
            left: -1rem;
            right: -1rem;
            height: 1rem;
            background: transparent;
            z-index: 999;
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

          .dropdown-menu li {
            padding: 0;
            margin: 0;
          }

          .dropdown-menu a {
            display: block;
            padding: 0.75rem 1.25rem;
            color: var(--text);
            text-decoration: none;
            transition: all 0.2s ease;
            font-size: 0.95rem;
          }

          .dropdown-menu a:hover {
            background: rgba(34, 211, 238, 0.1);
            color: var(--accent);
            padding-left: 1.5rem;
          }

          .dropdown-menu a.active {
            color: var(--accent);
            background: rgba(34, 211, 238, 0.15);
          }
        `}</style>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
