'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { votePhoto } from './battle-actions';
import { REACTIONS, type ReactionKey } from '@/lib/photo-core';

/**
 * Vote « Photo couleur » par réactions : une photo à la fois, on touche une réaction et la suivante arrive.
 * Que des réactions positives (aucune photo n'est « mal notée ») ; « Passer » pour ne pas réagir.
 * Chaque photo n'apparaît qu'une fois par votant. En mode démo (aperçu admin sans vraies photos), rien n'est enregistré.
 */
export type SwipeEntry = { id: string; url: string; title: string; caption: string; km: number; sport?: string };
const SPORT: Record<string, string> = { Walk: 'Marche', Hike: 'Rando', Run: 'Course', TrailRun: 'Trail', VirtualRun: 'Tapis' };

const km = (n: number) => `${n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} km`;
const OUT_MS = 520; // durée de l'effet de réaction + sortie de la carte

export default function PhotoSwipe({ entries, until, preview, demo }: { entries: SwipeEntry[]; until: string; preview?: string; demo?: boolean }) {
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);
  const [err, setErr] = useState('');
  const [picked, setPicked] = useState<ReactionKey | 'skip' | null>(null); // réaction en cours d'animation
  const done = i >= entries.length;
  const cur = entries[i];
  const next = entries[i + 1];

  // Page figée derrière, Échap pour fermer
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [open]);

  // Précharge la photo suivante
  useEffect(() => { if (next) { const im = new Image(); im.src = next.url; } }, [next]);

  function react(r: ReactionKey | 'skip') {
    if (!cur || picked) return;
    setPicked(r);
    if (!demo) votePhoto(cur.id, r === 'skip' ? null : r).then((x) => setErr(!x.ok && x.error ? x.error : '')).catch(() => setErr('Réaction non enregistrée, réessaie.'));
    setTimeout(() => { setI((n) => n + 1); setPicked(null); }, OUT_MS);
  }

  const emoji = picked && picked !== 'skip' ? REACTIONS.find((x) => x.key === picked)?.emoji : null;

  const modal = (
    <div className="swipe-overlay" role="dialog" aria-modal="true" aria-labelledby="swipe-title" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
      <div className="swipe">
        <div className="swipe-head">
          <p className="swipe-eyebrow">
            {preview ? <><b>Aperçu admins{demo ? ' · photos de démo' : ''}</b> · ouverture à tous le {preview}{demo ? ' · rien n’est enregistré' : ' · les réactions comptent'}</> : <>Photo couleur · réactions jusqu’au {until}</>}
          </p>
          <button className="swipe-close" aria-label="Fermer" onClick={() => setOpen(false)}>
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 2l8 8M10 2L2 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
          </button>
        </div>
        {done ? (
          <div className="swipe-done">
            <h2 id="swipe-title">Merci pour tes réactions ! 📸</h2>
            <p>Tu as vu toutes les photos. Le MVP sera annoncé par l’organisation.</p>
            <button className="btn primary" onClick={() => setOpen(false)}>Fermer</button>
          </div>
        ) : (
          <>
            <h2 id="swipe-title" className="sr-only">Photo {i + 1} sur {entries.length}</h2>
            <div className="swipe-stack">
              {/* key : chaque nouvelle photo rejoue l'animation d'entrée ; « out » fait sortir la carte après la réaction */}
              <div key={cur.id} className={`swipe-card-wrap swipe-enter${picked ? ' out' : ''}`}>
                <Card e={cur} />
                {emoji && <span className="swipe-burst" aria-hidden="true">{emoji}</span>}
              </div>
            </div>
            <div className="swipe-reactions" role="group" aria-label="Ta réaction">
              {REACTIONS.map((x) => (
                <button key={x.key} className={`swipe-react ${x.key}${picked === x.key ? ' on' : ''}`} disabled={!!picked} onClick={() => react(x.key)} aria-label={x.label} title={x.label}>
                  <span aria-hidden="true">{x.emoji}</span>
                </button>
              ))}
            </div>
            <div className="swipe-foot">
              <span className="swipe-count">{i + 1} / {entries.length}</span>
              <button className="linkish swipe-skip" disabled={!!picked} onClick={() => react('skip')}>Passer</button>
            </div>
            {err && <p className="swipe-err">{err}</p>}
          </>
        )}
      </div>
    </div>
  );

  // Tout est vu : la bannière disparaît (une fois la fenêtre fermée)
  if (done && !open) return null;
  return (
    <>
      <button type="button" className="battle-entry" onClick={() => setOpen(true)}>
        <span className="battle-entry-title">Photo couleur</span>
        <span className="battle-entry-cta">Réagir <span aria-hidden="true">→</span></span>
      </button>
      {open && createPortal(modal, document.body)}
    </>
  );
}

function Card({ e }: { e: SwipeEntry }) {
  return (
    <div className="swipe-card">
      <div className="swipe-photo"><img src={e.url} alt={e.title || 'Photo couleur'} draggable={false} /></div>
      <div className="swipe-prompt">
        {e.title && <b>{e.title}</b>}
        {e.caption && <p>{e.caption}</p>}
        <span className="swipe-km">{km(e.km)}{e.sport && SPORT[e.sport] ? ` · ${SPORT[e.sport]}` : ''}</span>
      </div>
    </div>
  );
}
