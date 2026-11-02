'use client';
import { useState, useTransition } from 'react';
import ShapeSvg from './ShapeSvg';
import { voteDuel } from './battle-actions';

/** Fenêtre de vote « Battle TraceZ » : deux formes anonymes, on clique sur sa préférée. */
export default function BattleModal({ pairs, paths, until, test = false }: { pairs: [string, string][]; paths: Record<string, string>; until: string; test?: boolean }) {
  const [open, setOpen] = useState(true);
  const [i, setI] = useState(0);
  const [err, setErr] = useState('');
  const [pending, start] = useTransition();
  if (!open || pairs.length === 0) return null;
  const done = i >= pairs.length;
  const [a, b] = pairs[Math.min(i, pairs.length - 1)];
  const pick = (w: string) => start(async () => {
    const r = await voteDuel(a, b, w, test);
    if (!r.ok && r.error) setErr(r.error);
    setI((n) => n + 1);
  });
  return (
    <div className="battle-overlay" role="dialog" aria-modal="true" aria-labelledby="battle-title">
      <div className="battle">
        <button className="battle-close" aria-label="Plus tard" title="Plus tard" onClick={() => setOpen(false)}>×</button>
        <p className="eyebrow">{test ? <><b style={{ color: 'var(--red)' }}>Mode test · admins</b> · ouverture à tous le {until}</> : <>Battle TraceZ · vote jusqu’au {until}</>}</p>
        {done ? (
          <>
            <h2 id="battle-title">Merci pour tes votes ! 🙌</h2>
            <p className="muted">Tu as voté pour tous les duels disponibles. Résultats à la fin du vote.</p>
            <button className="btn primary" onClick={() => setOpen(false)}>Fermer</button>
          </>
        ) : (
          <>
            <h2 id="battle-title">Quelle forme préfères-tu ?</h2>
            <div className="battle-duel">
              {[a, b].map((id, k) => (
                <button key={id} className="battle-card" disabled={pending} onClick={() => pick(id)} aria-label={`Choisir la forme ${k === 0 ? 'de gauche' : 'de droite'}`}>
                  <ShapeSvg path={paths[id]} size="100%" bg="#fff" />
                </button>
              ))}
              <span className="battle-vs" aria-hidden="true">VS</span>
            </div>
            <p className="muted small">Duel {i + 1} sur {pairs.length} · les formes sont anonymes · {err}</p>
            <button className="btn small" onClick={() => setOpen(false)}>Plus tard</button>
          </>
        )}
      </div>
    </div>
  );
}
