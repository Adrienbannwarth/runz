'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import type { BingoDefi } from '@/lib/bingo-defis';

type State = { done: boolean; by?: string; on?: string };
export type GridCell = ({ kind: 'center' } & State) | ({ kind: 'todo'; num: number } & State) | ({ kind: 'defi'; num: number } & BingoDefi & State);
type Stats = { team: string; done: number; total: number; lines: number; points: number; defis: number };

const CHECK = { strava: 'Validé automatiquement avec Strava dès que ta sortie remplit le défi.', photo: 'Photo sur ton activité Strava avec #BINGOZ dans le titre, puis validation par un admin.', admin: 'Validé par un admin.' };

/** BingoZ plein écran : barre de score, grande grille 7 × 7, détail d'une case en tiroir (desktop) ou en feuille (mobile). */
export default function BingoGrid({ cells, inLine, size, stats }: { cells: GridCell[]; inLine: number[]; size: number; stats: Stats }) {
  const [sel, setSel] = useState<number | null>(null);
  const cur = sel === null ? null : cells[sel];
  const lineSet = new Set(inLine);
  const [mobile, setMobile] = useState(false); // tiroir à droite sur desktop, feuille en bas sur mobile
  useEffect(() => {
    const m = window.matchMedia('(max-width: 700px)');
    const on = () => setMobile(m.matches);
    on(); m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSel(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="bz-stage">
      <header className="bz-bar">
        <div className="bz-brand">
          <span className="bz-word">Bingo<span>Z</span></span>
          <span className="bz-team">{stats.team}</span>
        </div>
        <div className="bz-score" aria-label="Score de l’équipe">
          <span><b>{stats.done}</b>/{stats.total}<small>cases</small></span>
          <span><b>{stats.lines}</b><small>{stats.lines > 1 ? 'lignes' : 'ligne'}</small></span>
          <span className="pts"><b>{stats.points}</b><small>{stats.points > 1 ? 'points' : 'point'}</small></span>
        </div>
      </header>

      <motion.div className="bz-board" role="grid" aria-label="Grille du BingoZ" style={{ ['--n' as string]: size }}
        initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.01 } } }}>
        {cells.map((c, i) => (
          <motion.button key={i} type="button" role="gridcell"
            className={`bz-cell ${c.kind}${c.done ? ' done' : ''}${lineSet.has(i) ? ' line' : ''}${sel === i ? ' on' : ''}`}
            variants={{ hidden: { opacity: 0, scale: 0.85 }, show: { opacity: 1, scale: 1 } }}
            transition={{ type: 'spring', stiffness: 420, damping: 30 }}
            whileHover={{ y: -3 }} whileTap={{ scale: 0.95 }}
            onClick={() => setSel(i)}
            aria-label={c.kind === 'defi' ? `Case ${c.num} : ${c.label}${c.done ? ', validée' : ''}` : c.kind === 'center' ? 'Défi imposé par une autre équipe' : `Case ${c.num} : défi à définir`}>
            {c.kind === 'todo' ? <><span className="bz-num">{c.num}</span><span className="bz-q">?</span><span /></> : (
              <>
                <span className="bz-num">{c.kind === 'center' ? '★' : c.num}</span>
                <span className="bz-label">{c.kind === 'center' ? 'Défi imposé' : c.short}</span>
              </>
            )}
            {c.done && (
              <motion.span className="bz-stamp" aria-hidden="true" initial={{ scale: 1.6, opacity: 0, rotate: -20 }} animate={{ scale: 1, opacity: 1, rotate: -8 }}
                transition={{ delay: 0.35 + i * 0.008, type: 'spring', stiffness: 500, damping: 22 }}>
                <svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </motion.span>
            )}
          </motion.button>
        ))}
      </motion.div>

      <p className="bz-foot">Aperçu privé · {stats.defis} défis validés sur 48, « ? » = à définir</p>

      <AnimatePresence>
        {cur && (
          <>
            <motion.div key="bg" className="bz-backdrop" onClick={() => setSel(null)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
            <motion.aside key="panel" className="bz-panel" role="dialog" aria-modal="true" aria-label="Détail du défi"
              initial={mobile ? { y: '100%' } : { x: '100%' }} animate={{ x: 0, y: 0 }} exit={mobile ? { y: '100%' } : { x: '100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 36 }}>
              <button type="button" className="bz-close" onClick={() => setSel(null)} aria-label="Fermer">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
              </button>
              {cur.kind === 'center' && <><span className="bz-p-eyebrow">Case du milieu</span><h2>Défi imposé par une autre équipe</h2><p>Chaque équipe écrit un défi pour une autre. +1 point s’il est réussi.</p></>}
              {cur.kind === 'todo' && <><span className="bz-p-eyebrow">Case {cur.num} · à définir</span><h2>?</h2><p>Ce défi reste à choisir dans le doc de cadrage.</p></>}
              {cur.kind === 'defi' && <><span className="bz-p-eyebrow">Case {cur.num} · {cur.family} · {cur.level}</span><h2>{cur.label}</h2><p>{CHECK[cur.check]}</p></>}
              {cur.kind !== 'todo' && (
                <div className={`bz-p-status${cur.done ? ' done' : ''}`}>
                  {cur.done ? <>Validée par {cur.by}, le {cur.on}</> : <>Pas encore validée</>}
                  {lineSet.has(sel!) && <span className="bz-p-line">Ligne complète</span>}
                </div>
              )}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
