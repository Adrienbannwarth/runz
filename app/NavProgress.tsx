'use client';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

/** Barre de chargement en haut de page pendant les changements de page. */
export default function NavProgress() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [state, setState] = useState<'idle' | 'loading' | 'done'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element).closest('a');
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
      if (url.pathname === location.pathname && url.search === location.search) return; // simple ancre
      setState('loading');
    };
    const onSubmit = () => setState('loading');
    document.addEventListener('click', onClick, true); // capture : next/link annule le clic avant la phase de bouillonnement
    document.addEventListener('submit', onSubmit);
    return () => { document.removeEventListener('click', onClick, true); document.removeEventListener('submit', onSubmit); };
  }, []);

  useEffect(() => {
    setState((s) => (s === 'loading' ? 'done' : s));
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState('idle'), 400);
  }, [pathname, search]);

  return <div className={`nav-progress ${state}`} aria-hidden="true" />;
}
