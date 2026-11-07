'use client';
import { useEffect, useRef, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import ShapeSvg from './ShapeSvg';
import { voteDuel } from './battle-actions';

/**
 * Vote « Tracé GPS » : bannière d'accès (sous les règles du jeu) + fenêtre de vote plein écran au clic.
 * Chaque votant a son tirage : chaque forme n'apparaît qu'une fois pour lui, dans un seul duel.
 */
type Info = { path: string; km: number; label: string };

/** Tag sur une ligne : « … » si le nom est trop long, puis le texte défile pour être lu en entier, en boucle. */
function MarqueeTag({ text }: { text: string }) {
  const box = useRef<HTMLSpanElement>(null);
  const [shift, setShift] = useState(0); // décalage à parcourir (px), 0 = le nom tient
  const [moving, setMoving] = useState(false);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setShift(Math.max(0, el.scrollWidth - el.clientWidth));
    measure();
    const ro = new ResizeObserver(measure); ro.observe(el);
    return () => ro.disconnect();
  }, [text]);
  useEffect(() => {
    if (!shift || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const dur = Math.max(1500, shift * 40);
    let t: ReturnType<typeof setTimeout>;
    const loop = (m: boolean) => { setMoving(m); t = setTimeout(() => loop(!m), m ? dur + 1200 : 1800); };
    t = setTimeout(() => loop(true), 1800);
    return () => clearTimeout(t);
  }, [shift]);
  const dur = Math.max(1500, shift * 40);
  return (
    <span ref={box} className={`shape-tag label${moving ? ' moving' : ''}`} title={text}>
      <span style={moving ? { transform: `translateX(-${shift}px)`, transition: `transform ${dur}ms linear` } : undefined}>{text}</span>
    </span>
  );
}
const km = (n: number) => `${n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} km`;

export default function BattleModal({ pairs, shapes, until, preview }: { pairs: [string, string][]; shapes: Record<string, Info>; until: string; preview?: string }) {
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
    const r = await voteDuel(a, b, w);
    setErr(!r.ok && r.error ? r.error : '');
    setI((n) => n + 1);
  });

  const modal = (
    <div className="battle-overlay" role="dialog" aria-modal="true" aria-labelledby="battle-title" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
      <div className="battle">
        <button className="battle-close" aria-label="Fermer" title="Fermer" onClick={() => setOpen(false)}>
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
        </button>
        <p className="eyebrow">{preview ? <><b style={{ color: 'var(--red)' }}>Aperçu admins</b> · ouverture à tous le {preview} · les votes comptent (à supprimer dans l’admin après les tests)</> : <>Tracé GPS · vote jusqu’au {until}</>}</p>
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
                <button key={id} className="battle-card" disabled={pending} onClick={() => pick(id)} aria-label={`Choisir la forme ${k === 0 ? 'de gauche' : 'de droite'}${shapes[id]?.label ? ` : ${shapes[id].label}` : ''}, ${km(shapes[id]?.km ?? 0)}`}>
                  <ShapeSvg path={shapes[id]?.path ?? null} size="100%" bg="transparent" color="var(--strava)" stroke={1.3} />
                  <span className="shape-tags">
                    {shapes[id]?.label && <MarqueeTag text={shapes[id].label} />}
                    <span className="shape-tag km">{km(shapes[id]?.km ?? 0)}</span>
                  </span>
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
