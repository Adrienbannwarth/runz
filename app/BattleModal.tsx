'use client';
import { useState, useTransition } from 'react';
import ShapeSvg from './ShapeSvg';
import { voteDuel } from './battle-actions';

/**
 * Battle TraceZ : encart d'accès (sous les règles du jeu) + fenêtre de vote ouverte au clic.
 * Deux formes anonymes, on clique sur sa préférée, puis le duel suivant.
 */
export default function BattleModal({ pairs, paths, until, test = false }: { pairs: [string, string][]; paths: Record<string, string>; until: string; test?: boolean }) {
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);
  const [err, setErr] = useState('');
  const [pending, start] = useTransition();
  const left = Math.max(0, pairs.length - i);
  const done = left === 0;
  const [a, b] = pairs[Math.min(i, pairs.length - 1)] ?? ['', ''];
  const pick = (w: string) => start(async () => {
    const r = await voteDuel(a, b, w, test);
    setErr(!r.ok && r.error ? r.error : '');
    setI((n) => n + 1);
  });
  return (
    <>
      <button type="button" className="battle-entry" onClick={() => setOpen(true)} disabled={done}>
        <span className="battle-entry-text">
          <b>Battle TraceZ{test ? ' · mode test admins' : ''}</b>
        </span>
        {!done && <span className="battle-entry-cta">Jouer <span aria-hidden="true">→</span></span>}
      </button>
      {open && (
        <div className="battle-overlay" role="dialog" aria-modal="true" aria-labelledby="battle-title" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="battle">
            <button className="battle-close" aria-label="Fermer" title="Fermer" onClick={() => setOpen(false)}>×</button>
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
                <p className="muted small">Duel {i + 1} sur {pairs.length} · les formes sont anonymes{err ? ` · ${err}` : ''}</p>
                <button className="btn small" onClick={() => setOpen(false)}>Continuer plus tard</button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
