'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { votePhoto } from './battle-actions';

/**
 * Vote « Photo couleur » façon appli de rencontre : une photo à la fois, plein écran.
 * Glisser à droite (ou ♥) = oui, à gauche (ou ✕) = non. Chaque photo n'apparaît qu'une fois par votant.
 * En mode démo (aperçu admin sans vraies photos), rien n'est enregistré.
 */
export type SwipeEntry = { id: string; url: string; title: string; caption: string; km: number; sport?: string };
const SPORT: Record<string, string> = { Walk: 'Marche', Hike: 'Rando', Run: 'Course', TrailRun: 'Trail', VirtualRun: 'Tapis' };

const km = (n: number) => `${n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} km`;
const THRESHOLD = 110; // px de glissé pour valider un choix

export default function PhotoSwipe({ entries, until, preview, demo }: { entries: SwipeEntry[]; until: string; preview?: string; demo?: boolean }) {
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);
  const [err, setErr] = useState('');
  const [drag, setDrag] = useState({ x: 0, y: 0, on: false });
  const [fling, setFling] = useState<0 | 1 | -1>(0); // carte qui sort à droite (1) ou à gauche (-1)
  const start = useRef<{ x: number; y: number } | null>(null);
  const frame = useRef<HTMLDivElement>(null);
  const done = i >= entries.length;
  const cur = entries[i];
  const next = entries[i + 1];

  // Page figée derrière, flèches du clavier, Échap pour fermer
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
      if (e.key === 'ArrowRight') choose(true);
      if (e.key === 'ArrowLeft') choose(false);
    };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  });

  // Précharge la photo suivante
  useEffect(() => { if (next) { const im = new Image(); im.src = next.url; } }, [next]);

  function choose(liked: boolean) {
    if (!cur || fling) return;
    setFling(liked ? 1 : -1);
    const id = cur.id;
    if (!demo) votePhoto(id, liked).then((r) => setErr(!r.ok && r.error ? r.error : '')).catch(() => setErr('Vote non enregistré, réessaie.'));
    setTimeout(() => { setI((n) => n + 1); setFling(0); setDrag({ x: 0, y: 0, on: false }); }, 280);
  }

  const onDown = (e: React.PointerEvent) => { if (fling) return; start.current = { x: e.clientX, y: e.clientY }; (e.target as Element).setPointerCapture?.(e.pointerId); setDrag({ x: 0, y: 0, on: true }); };
  const onMove = (e: React.PointerEvent) => { if (!start.current) return; setDrag({ x: e.clientX - start.current.x, y: e.clientY - start.current.y, on: true }); };
  const onUp = () => {
    if (!start.current) return;
    start.current = null;
    if (Math.abs(drag.x) > THRESHOLD) choose(drag.x > 0);
    else setDrag({ x: 0, y: 0, on: false });
  };

  const x = fling ? fling * (frame.current?.clientWidth ?? 420) * 1.3 : drag.x; // sortie de carte limitée au cadre
  const y = fling ? drag.y : drag.y * 0.25;
  const p = Math.max(-1, Math.min(1, x / THRESHOLD)); // -1 (non) … 1 (oui)
  const style = { transform: `translate(${x}px, ${y}px) rotate(${x / 18}deg)`, transition: drag.on && !fling ? 'none' : 'transform .28s ease' };

  const modal = (
    <div className="swipe-overlay" role="dialog" aria-modal="true" aria-labelledby="swipe-title" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
      <div className="swipe" ref={frame}>
        <div className="swipe-head">
          <p className="swipe-eyebrow">
            {preview ? <><b>Aperçu admins{demo ? ' · photos de démo' : ''}</b> · ouverture à tous le {preview}{demo ? ' · rien n’est enregistré' : ' · les votes comptent'}</> : <>Photo couleur · vote jusqu’au {until}</>}
          </p>
          <button className="swipe-close" aria-label="Fermer" onClick={() => setOpen(false)}>
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 2l8 8M10 2L2 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
          </button>
        </div>
        {done ? (
          <div className="swipe-done">
            <h2 id="swipe-title">Merci pour tes votes ! 📸</h2>
            <p>Tu as vu toutes les photos. Le MVP sera annoncé par l’organisation.</p>
            <button className="btn primary" onClick={() => setOpen(false)}>Fermer</button>
          </div>
        ) : (
          <>
            <h2 id="swipe-title" className="sr-only">Photo {i + 1} sur {entries.length}</h2>
            <div className="swipe-stack">
              {next && <Card key={next.id} e={next} back />}
              {/* key : la carte suivante arrive sans animation (elle était déjà visible derrière) */}
              <div key={cur.id} className="swipe-card-wrap" style={style} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
                <Card e={cur} tint={p} />
              </div>
            </div>
            <div className="swipe-actions">
              <button className="swipe-btn no" aria-label="Non" onClick={() => choose(false)}>
                <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
              </button>
              <span className="swipe-count">{i + 1} / {entries.length}</span>
              <button className="swipe-btn yes" aria-label="Oui, j’aime" onClick={() => choose(true)}>
                <svg width="30" height="30" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2z" fill="currentColor" /></svg>
              </button>
            </div>
            {err && <p className="swipe-err">{err}</p>}
          </>
        )}
      </div>
    </div>
  );

  // Tout est voté : la bannière disparaît (une fois la fenêtre fermée)
  if (done && !open) return null;
  return (
    <>
      <button type="button" className="battle-entry" onClick={() => setOpen(true)}>
        <span className="battle-entry-title">Photo couleur</span>
        <span className="battle-entry-cta">Voter <span aria-hidden="true">→</span></span>
      </button>
      {open && createPortal(modal, document.body)}
    </>
  );
}

function Card({ e, back, tint = 0 }: { e: SwipeEntry; back?: boolean; tint?: number }) {
  return (
    <div className={`swipe-card${back ? ' back' : ''}`} aria-hidden={back}>
      <div className="swipe-photo">
        <img src={e.url} alt={e.title || 'Photo couleur'} draggable={false} />
        {/* voile vert (oui) ou rouge (non) pendant le glissé */}
        {tint !== 0 && <span className="swipe-tint" style={{ background: tint > 0 ? `rgba(46,160,67,${tint * 0.5})` : `rgba(200,49,47,${-tint * 0.5})` }} />}
      </div>
      <div className="swipe-prompt">
        {e.title && <b>{e.title}</b>}
        {e.caption && <p>{e.caption}</p>}
        <span className="swipe-km">{km(e.km)}{e.sport && SPORT[e.sport] ? ` · ${SPORT[e.sport]}` : ''}</span>
      </div>
    </div>
  );
}
