'use client';
import { useEffect, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import ShapeSvg from './ShapeSvg';
import { voteDuel } from './battle-actions';

/**
 * Vote « Tracé GPS » : bannière d'accès (sous les règles du jeu) + fenêtre de vote plein écran au clic.
 * Chaque votant a son tirage : chaque forme n'apparaît qu'une fois pour lui, dans un seul duel.
 */
export default function BattleModal({ pairs, paths, until, test = false }: { pairs: [string, string][]; paths: Record<string, string>; until: string; test?: boolean }) {
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);
  const [err, setErr] = useState('');
  const [pending, start] = useTransition();
  const done = i >= pairs.length;
  const [a, b] = pairs[Math.min(i, pairs.length - 1)] ?? ['', ''];

  // Page figée derrière la fenêtre (pas de défilement), Échap pour fermer
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [open]);

  const pick = (w: string) => start(async () => {
    const r = await voteDuel(a, b, w, test);
    setErr(!r.ok && r.error ? r.error : '');
    setI((n) => n + 1);
  });

  const modal = (
    <div className="battle-overlay" role="dialog" aria-modal="true" aria-labelledby="battle-title" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
      <div className="battle">
        <button className="battle-close" aria-label="Fermer" title="Fermer" onClick={() => setOpen(false)}>×</button>
        <p className="eyebrow">{test ? <><b style={{ color: 'var(--red)' }}>Mode test · admins</b> · ouverture à tous le {until}</> : <>Tracé GPS · vote jusqu’au {until}</>}</p>
        {done ? (
          <>
            <h2 id="battle-title">Merci pour tes votes ! 🙌</h2>
            <p className="muted">Tu as voté pour tous tes duels. Résultats à la fin du vote.</p>
            <button className="btn primary" onClick={() => setOpen(false)}>Fermer</button>
          </>
        ) : (
          <>
            <h2 id="battle-title">Quelle forme préfères-tu ?</h2>
            <div className="battle-duel">
              {[a, b].map((id, k) => (
                <button key={id} className="battle-card" disabled={pending} onClick={() => pick(id)} aria-label={`Choisir la forme ${k === 0 ? 'de gauche' : 'de droite'}`}>
                  <ShapeSvg path={paths[id]} size="100%" bg="var(--soft)" color="var(--strava)" />
                </button>
              ))}
              <span className="battle-vs" aria-hidden="true">VS</span>
            </div>
            <p className="muted small">Duel {i + 1} sur {pairs.length} · les formes sont anonymes{err ? ` · ${err}` : ''}</p>
            <button className="btn small" onClick={() => setOpen(false)}>Continuer plus tard</button>
          </>
        )}
      </div>
    </div>
  );

  // Tout est voté : la bannière disparaît (une fois la fenêtre de remerciement fermée)
  if (done && !open) return null;

  return (
    <>
      <button type="button" className="battle-entry" onClick={() => setOpen(true)}>
        <span className="battle-entry-title">Tracé GPS</span>
        <span className="battle-entry-cta">Voter <span aria-hidden="true">→</span></span>
      </button>
      {/* Rendue à la racine de la page : couvre tout l'écran, quel que soit le conteneur */}
      {open && createPortal(modal, document.body)}
    </>
  );
}
