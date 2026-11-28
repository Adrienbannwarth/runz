'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import type { BingoDefi } from '@/lib/bingo-defis';
import BingoRules from './BingoRules';

export type GridCell = { kind: 'center' } | { kind: 'todo'; num: number } | ({ kind: 'defi'; num: number } & BingoDefi);

/** Grille 7 × 7 du BingoZ (V1 : affichage). Desktop : numéro + défi ; mobile : numéro seul, détail au clic. */
export default function BingoGrid({ cells, dates }: { cells: GridCell[]; dates: string }) {
  const [sel, setSel] = useState<number | null>(null);
  const cur = sel === null ? null : cells[sel];
  return (
    <div className="bz-layout">
      <motion.div className="bz-grid" role="grid" aria-label="Grille du BingoZ"
        initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.012 } } }}>
        {cells.map((c, i) => (
          <motion.button key={i} type="button" role="gridcell"
            className={`bz-cell ${c.kind}${sel === i ? ' on' : ''}`}
            variants={{ hidden: { opacity: 0, scale: 0.9, y: 6 }, show: { opacity: 1, scale: 1, y: 0 } }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            whileHover={{ y: -2 }} whileTap={{ scale: 0.96 }}
            onClick={() => setSel(sel === i ? null : i)}
            aria-pressed={sel === i}
            aria-label={c.kind === 'defi' ? `Case ${c.num} : ${c.label}` : c.kind === 'center' ? 'Défi imposé par une autre équipe' : `Case ${c.num} : défi à définir`}>
            {c.kind === 'center' && <><span className="bz-num">★</span><span className="bz-label">Défi imposé</span></>}
            {c.kind === 'todo' && <><span className="bz-num">{c.num}</span><span className="bz-q">?</span><span /></>}
            {c.kind === 'defi' && <><span className="bz-num">{c.num}{c.double ? ' · ×2' : ''}</span><span className="bz-label">{c.short}</span></>}
          </motion.button>
        ))}
      </motion.div>

      <aside className="bz-side">
        <BingoRules dates={dates} />
        <AnimatePresence mode="wait">
          <motion.div key={sel ?? 'none'} className="bz-detail"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
            {!cur && <><span className="bz-detail-eyebrow">Ta grille</span><p className="bz-detail-title">Touche une case pour voir le défi.</p></>}
            {cur?.kind === 'center' && <><span className="bz-detail-eyebrow">Case du milieu</span><p className="bz-detail-title">Défi imposé par une autre équipe</p><p className="bz-detail-text">Chaque équipe écrit un défi pour une autre. +1 point s’il est réussi.</p></>}
            {cur?.kind === 'todo' && <><span className="bz-detail-eyebrow">Case {cur.num} · à définir</span><p className="bz-detail-title">?</p><p className="bz-detail-text">Ce défi reste à choisir dans le doc de cadrage.</p></>}
            {cur?.kind === 'defi' && <><span className="bz-detail-eyebrow">Case {cur.num} · {cur.family} · {cur.level}</span><p className="bz-detail-title">{cur.label}</p>
              <p className="bz-detail-text">{cur.check === 'strava' ? 'Validé automatiquement avec Strava.' : cur.check === 'photo' ? 'Photo sur l’activité Strava avec #BINGOZ dans le titre, puis validation par un admin.' : 'Validé par un admin.'}</p></>}
          </motion.div>
        </AnimatePresence>
      </aside>
    </div>
  );
}
