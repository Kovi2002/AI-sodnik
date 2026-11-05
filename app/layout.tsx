import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { mono, sans, serif } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kdo je kriv?",
  description: "Opišita prepir, sodnik razsodi. Samo za zabavo.",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  referrer: "no-referrer",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f2ee" },
    { media: "(prefers-color-scheme: dark)", color: "#131315" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="sl" className={`${sans.variable} ${serif.variable} ${mono.variable}`}>
      <body>
        <div className="shell">
          <header className="masthead">
            <Link href="/" className="wordmark">
              Kdo je kriv?
            </Link>
            <span className="masthead-tag">Sodišče za vsakdanje spore</span>
          </header>
          <main className="main">{children}</main>
          <footer className="footer">
            <p>
              Samo za zabavo. Razsodbe niso pravni nasvet in nimajo nobene pravne veljave.
            </p>
            <p>
              Besedilo, ki ga vpišeta, obdela Claude API podjetja Anthropic. Zadeva se samodejno izbriše
              7&nbsp;dni po vložitvi, prej pa jo lahko izbrišeta sama.
            </p>
          </footer>
        </div>
      </body>
    </html>
  );
}
