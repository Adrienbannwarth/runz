import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'RunZ Challenge · Chaque pas compte',
  description: 'Challenge de marche et course par équipes du CSE Colorz',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <header className="top">
          <Link href="/" className="brand">Run<span>Z</span></Link>
          <nav className="links">
            <Link href="/">Classement</Link>
            <Link href="/me">Mon espace</Link>
            <Link href="/admin">Admin</Link>
          </nav>
        </header>
        <main>{children}</main>
        <footer>
          <span>RunZ Challenge · CSE Colorz · <Link href="/confidentialite">Confidentialité</Link></span>
          {/* Remplacer par le logo officiel « Powered by Strava » (developers.strava.com/guidelines) */}
          <span className="powered">POWERED BY STRAVA</span>
        </footer>
      </body>
    </html>
  );
}
