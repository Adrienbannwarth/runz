import { notFound } from 'next/navigation';
import BingoGrid from './BingoGrid';
import { DEFIS, gridFor } from '@/lib/bingo-defis';
import { getParticipantId } from '@/lib/session';
import { canPreview } from '@/lib/seasons';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'BingoZ · aperçu', robots: { index: false, follow: false } };

/** BingoZ (saison 2) en préparation : visible seulement des comptes « can_preview » (Adrien), 404 pour tous les autres. */
export default async function BingoPreview() {
  const pid = await getParticipantId();
  if (!(await canPreview(pid))) notFound();
  const grid = gridFor('apercu').map((c) => (c === 'center' ? { kind: 'center' as const } : c ? { kind: 'defi' as const, ...c } : { kind: 'todo' as const }));
  return (
    <div className="bz">
      <div className="bz-head">
        <div>
          <p className="eyebrow">Saison 2 · aperçu privé, visible par toi seul</p>
          <h1>Bingo<span className="bz-z">Z</span></h1>
        </div>
        <p className="muted small">{DEFIS.length} défis validés sur 48 · les cases « ? » restent à définir</p>
      </div>
      <BingoGrid cells={grid} />
    </div>
  );
}
