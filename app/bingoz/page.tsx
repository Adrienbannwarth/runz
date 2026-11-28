import { notFound } from 'next/navigation';
import BingoGrid, { type GridCell } from './BingoGrid';
import { BINGO_CELLS, BINGO_SIZE, DEFIS, gridFor } from '@/lib/bingo-defis';
import { getParticipantId } from '@/lib/session';
import { canPreview } from '@/lib/seasons';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'BingoZ · aperçu', robots: { index: false, follow: false } };

/**
 * BingoZ (saison 2) en préparation : visible seulement des comptes « can_preview » (Adrien), 404 pour tous les autres.
 */
export default async function BingoPreview() {
  const pid = await getParticipantId();
  if (!(await canPreview(pid))) notFound();
  const n = BINGO_SIZE;
  const grid = gridFor('apercu');
  // Numéro de case = sa place dans la grille (1 à 48, ligne par ligne, sans la case du milieu)
  let k = 0;
  const cells: GridCell[] = grid.map((c) => {
    if (c === 'center') return { kind: 'center', done: false };
    const num = ++k;
    return c ? { kind: 'defi', ...c, num, done: false } : { kind: 'todo', num, done: false };
  });
  return (
    <BingoGrid cells={cells} inLine={[]} size={n}
      stats={{ team: 'Aperçu', done: 0, total: BINGO_CELLS, lines: 0, points: 0, defis: DEFIS.length }} />
  );
}
