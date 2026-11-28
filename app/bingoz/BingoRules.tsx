'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { BINGO_RULES } from '@/lib/bingo-rules';

/** Encadré noir « Les règles du jeu » + manuel en modale (fond gris clair, texte noir). */
export default function BingoRules({ dates }: { dates: string }) {
  const [open, setOpen] = useState(false);
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => setHost(document.body), []);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <>
      <button type="button" className="bz-rules-card" onClick={() => setOpen(true)}>
        <span className="bz-detail-eyebrow">Le manuel</span>
        <span className="bz-detail-title">Les règles du jeu</span>
        <span className="bz-rules-cta">Lire les règles <span aria-hidden="true">→</span></span>
      </button>
      {host && createPortal(
        <AnimatePresence>
          {open && (
            <motion.div key="ov" className="bz-rules-overlay" role="dialog" aria-modal="true" aria-labelledby="bz-rules-title"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
              <motion.div className="bz-rules" initial={{ y: 24, opacity: 0, scale: 0.98 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 16, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 360, damping: 32 }}>
                <div className="bz-rules-head">
                  <div>
                    <p className="bz-rules-eyebrow">BingoZ · saison 2</p>
                    <h2 id="bz-rules-title">Les règles du jeu</h2>
                  </div>
                  <button type="button" className="bz-rules-close" aria-label="Fermer" onClick={() => setOpen(false)}>
                    <svg width="14" height="14" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 2l8 8M10 2L2 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
                  </button>
                </div>
                <div className="bz-rules-body">
                  {BINGO_RULES.map((sec, i) => (
                    <motion.section key={sec.title} className="bz-rules-sec" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 + i * 0.05 }}>
                      <h3><span className="bz-rules-icon" aria-hidden="true">{sec.icon}</span><span className="bz-rules-step">{String(i + 1).padStart(2, '0')}</span>{sec.title}</h3>
                      <ul>{sec.items.map((t) => <li key={t}>{t.replace('{dates}', dates)}</li>)}</ul>
                    </motion.section>
                  ))}
                </div>
                <button type="button" className="btn primary bz-rules-ok" onClick={() => setOpen(false)}>C’est parti&nbsp;!</button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        host,
      )}
    </>
  );
}
