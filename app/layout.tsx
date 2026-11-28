import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import NavProgress from './NavProgress';
import '@fontsource-variable/figtree';
import './globals.css';
import { getSettings } from '@/lib/data';
import { isAdmin } from '@/lib/session';

const longDate = (d: string) =>
  new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' });

export const metadata: Metadata = {
  title: 'RunZ Challenge · Chaque pas compte',
  description: 'Challenge de marche et course par équipes du CSE Colorz',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const dates = await getSettings()
    .then((s) => `du ${longDate(s.start_date)} au ${longDate(s.end_date)}`)
    .catch(() => '');
  const isAdminUser = await isAdmin().catch(() => false);
  // suppressHydrationWarning : des extensions (LanguageTool…) ajoutent des attributs à <html> avant React
  return (
    <html lang="fr" suppressHydrationWarning>
      <body>
        <Suspense fallback={null}><NavProgress /></Suspense>
        <div className="announce">
          RunZ Challenge{dates && <> {dates}</>}
        </div>
        <header className="top">
          <span aria-hidden="true" />
          <Link href="/" className="brand" aria-label="RunZ by Colorz, accueil"><img src="/logo.svg" alt="RunZ by Colorz" /></Link>
          <div className="top-actions">
            {isAdminUser && (
              <Link href="/admin" className="top-right" aria-label="Admin">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />
                </svg>
                Admin
              </Link>
            )}
            <Link href="/me" className="top-right" aria-label="Mon espace">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                <circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
              </svg>
              Mon espace
            </Link>
          </div>
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
