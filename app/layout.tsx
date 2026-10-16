import type { Metadata } from 'next';
import Link from 'next/link';
import '@fontsource-variable/figtree';
import './globals.css';
import { fmtDate, getSettings } from '@/lib/data';

export const metadata: Metadata = {
  title: 'RunZ Challenge · Chaque pas compte',
  description: 'Challenge de marche et course par équipes du CSE Colorz',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const dates = await getSettings()
    .then((s) => `du ${fmtDate(s.start_date)} au ${fmtDate(s.end_date)}`)
    .catch(() => '');
  return (
    <html lang="fr">
      <body>
        <div className="announce">
          RunZ Challenge {dates && <>· {dates} </>}· chaque pas compte
          <Link href="/me">Je participe</Link>
        </div>
        <header className="top">
          <nav className="links">
            <Link href="/">Classement</Link>
            <Link href="/me">Mon espace</Link>
            <Link href="/admin">Admin</Link>
          </nav>
          <Link href="/" className="brand">RunZ<sup>®</sup><small>by Colorz</small></Link>
          <Link href="/me" className="top-right" aria-label="Mon compte">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
              <circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
            </svg>
            Compte
          </Link>
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
