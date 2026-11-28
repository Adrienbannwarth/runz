import { notFound } from 'next/navigation';
import BingoGrid, { type GridCell } from './BingoGrid';
import { BINGO_CELLS, BINGO_SIZE, DEFIS, gridFor } from '@/lib/bingo-defis';
import { getParticipantId } from '@/lib/session';
import { canPreview } from '@/lib/seasons';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'BingoZ · aperçu', robots: { index: false, follow: false } };

/** Toutes les lignes gagnantes possibles : 7 lignes, 7 colonnes, 2 diagonales. */
function lines(): number[][] {
  const n = BINGO_SIZE, out: number[][] = [];
  for (let r = 0; r < n; r++) out.push(Array.from({ length: n }, (_, c) => r * n + c));
  for (let c = 0; c < n; c++) out.push(Array.from({ length: n }, (_, r) => r * n + c));
  out.push(Array.from({ length: n }, (_, i) => i * n + i), Array.from({ length: n }, (_, i) => i * n + (n - 1 - i)));
  return out;
}

/**
 * BingoZ (saison 2) en préparation : visible seulement des comptes « can_preview » (Adrien), 404 pour tous les autres.
 * Par défaut, une partie de démo (cases cochées fictives) pour juger le rendu ; ?vide=1 montre une grille vierge.
 */
export default async function BingoPreview({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const pid = await getParticipantId();
  if (!(await canPreview(pid))) notFound();
  const empty = (await searchParams).vide === '1';
  const n = BINGO_SIZE;
  // Démo : la première ligne et la première colonne sans case « ? » sont complètes, plus quelques cases éparses
  const grid = gridFor('apercu');
  const free = (l: number[]) => l.every((i) => grid[i] !== null);
  const all = lines();
  const row = all.slice(0, n).find(free) ?? [], col = all.slice(n, 2 * n).find(free) ?? [];
  const scattered = grid.map((c, i) => (c && c !== 'center' && i % 5 === 2 ? i : -1)).filter((i) => i >= 0);
  const done = new Set(empty ? [] : [...row, ...col, ...scattered]);
  const who = ['Camille', 'Léa', 'Paul', 'Mario', 'Jeanne'];
  const cells: GridCell[] = grid.map((c, i) => {
    const state = done.has(i) ? { done: true, by: who[i % who.length], on: `${(i % 20) + 1} déc.` } : { done: false };
    if (c === 'center') return { kind: 'center', ...state };
    if (!c) return { kind: 'todo', done: false };
    return { kind: 'defi', ...c, ...state };
  });
  const won = all.filter((l) => l.every((i) => cells[i].done));
  const inLine = [...new Set(won.flat())];
  const points = won.length + (won.length ? 1 : 0) + (cells[Math.floor(BINGO_CELLS / 2)].done ? 1 : 0);
  return (
    <BingoGrid cells={cells} inLine={inLine} size={n}
      stats={{ team: 'Équipe démo', done: done.size, total: BINGO_CELLS, lines: won.length, points, defis: DEFIS.length, empty }} />
  );
}
