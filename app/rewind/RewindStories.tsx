'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SCATTER_H, SCATTER_W, fmtDuration, fmtPace as fmtPaceKm, type Rewind, type Track } from '@/lib/rewind';
import './rewind.css';

const DUR = 6500;
const nf = (n: number, d = 0) => n.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = (x: number) => `${Math.round(x * 100)} %`;
const dFr = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
const light = (hex: string | null) => {
  const m = (hex ?? '').replace('#', '').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return false;
  const [r, g, b] = m.slice(1).map((x) => parseInt(x, 16));
  return 0.299 * r + 0.587 * g + 0.114 * b > 160;
};

/** Compteur animé (de 0 à `to`) à chaque fois que la story devient visible. */
const paceSec = (p: string) => { const m = p.match(/(\d+)'(\d+)/); return m ? Number(m[1]) * 60 + Number(m[2]) : 0; };
const fmtPace = (v: number) => { const s = Math.round(v); return `${Math.floor(s / 60)}'${String(s % 60).padStart(2, '0')}"`; };

function Count({ to, dec = 0, on, fmt }: { to: number; dec?: number; on: boolean; fmt?: (v: number) => string }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!on) { setV(0); return; }
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { setV(to); return; }
    let raf = 0; const s = performance.now();
    const f = (n: number) => { const k = Math.min(1, (n - s) / 1400); setV(to * (1 - Math.pow(1 - k, 3))); if (k < 1) raf = requestAnimationFrame(f); };
    raf = requestAnimationFrame(f);
    return () => cancelAnimationFrame(raf);
  }, [on, to]);
  return <>{fmt ? fmt(v) : nf(v, dec)}</>;
}

/** Ferme le Rewind : retour à la page précédente du site, sinon l'accueil. */
function closeRewind() {
  if (document.referrer.startsWith(location.origin) && history.length > 1) history.back();
  else location.href = '/';
}

/** Palette du Rewind : on alterne beige, rose et noir ; jamais de blanc pur (blanc cassé). Codes à ajuster ici. */
export const PAL = { noir: '#272727', beige: '#EEEFE8', creme: '#EEEFE8', rose: '#F5BCC4', orange: '#FC4C02' };

export default function RewindStories({ r, children }: { r: Rewind; children?: React.ReactNode }) {
  const team = r.teamColor ?? '#fc5200';
  const teamInk = light(team) ? '#111' : '#fff';
  const first = r.name.split(' ')[0];
  const sportTotal = Math.max(1, r.split.run + r.split.walk + r.split.trail + r.split.hike);
  const sports = [
    { k: 'Course', e: '🏃', v: r.split.run, c: PAL.orange },
    { k: 'Marche', e: '🚶', v: r.split.walk, c: PAL.rose },
    { k: 'Trail', e: '⛰️', v: r.split.trail, c: PAL.beige },
    { k: 'Rando', e: '🥾', v: r.split.hike, c: PAL.creme },
  ].filter((s) => s.v > 0);
  const maxSport = Math.max(1, ...sports.map((s) => s.v));
  const top = sports.slice().sort((a, b) => b.v - a.v)[0];
  const SLOTS = [
    { k: 'morning', e: '☀️', l: 'Le matin', d: 'avant 9h30', t: 'Team du matin ☀️' },
    { k: 'lunch', e: '🥪', l: 'La pause déj', d: '11h30-14h', t: 'Team pause déj 🥪' },
    { k: 'day', e: '🏙️', l: 'En journée', d: '9h30-11h30, 14h-18h', t: 'Team de la journée 🏙️' },
    { k: 'evening', e: '🌙', l: 'Le soir', d: 'après 18h', t: 'Team du soir 🌙' },
  ] as const;
  const slotTop = SLOTS.slice().sort((a, b) => r.slots[b.k] - r.slots[a.k])[0];

  const [withStats, setWithStats] = useState(false); // story tracés : tracés seuls ou avec distance / allure / temps
  const slides: { cls: string; lt?: boolean; style?: React.CSSProperties; body: (on: boolean) => React.ReactNode }[] = [
    { cls: 's-intro', lt: true, body: () => (<>
      <img className="r rw-logo" src="/logo.svg" alt="RunZ by Colorz" />
      <div className="r rw-year"><span>Rewind</span><b>{r.end.slice(0, 4)}</b></div>
      <div className="r rw-kicker">{dFr(r.start)} → {dFr(r.end)}</div>
      <div className="r rw-mid rw-intro-q">{r.days} jours. {r.podium.length} équipes.<br />Et toi, {first} ?</div>
      <div className="r rw-small" style={{ marginTop: 22 }}>Touche à droite pour avancer →</div>
    </>) },
    { cls: 's-km', lt: true, body: (on) => (<>
      <div className="r rw-kicker">Au total, tu as parcouru</div>
      <div className="r rw-big"><Count to={r.totalKm} dec={1} on={on} /><small> km</small></div>
      {r.trip && <div className="r rw-sub">Soit {r.trip.label.includes('→') ? 'un ' : ''}<b>{r.trip.label}</b> à la force des mollets.</div>}
      <div className="r rw-road"><i /><span className={on ? 'go' : ''}>🏃</span></div>
      <div className="r rw-sub" style={{ fontSize: 14 }}><b>{nf(r.countedKm, 1)} km</b> comptés pour l’équipe (plafond et boosts inclus)</div>
    </>) },
    ...(sports.length ? [{ cls: 's-split', body: (on: boolean) => (<>
      <div className="r rw-kicker">Plutôt baskets ou semelles ?</div>
      <div className="r rw-mid">Team <span style={{ color: top.c }}>{top.k.toLowerCase()}</span> à {pct(top.v / sportTotal)}</div>
      <div className="r rw-split">
        {sports.map((s) => (
          <div key={s.k} className="rw-col">
            <b><Count to={s.v} on={on} /> km</b>
            <div className="rw-fill" style={{ background: s.c, height: on ? `${Math.max(4, (s.v / maxSport) * 100)}%` : 0 }} />
            <span>{s.e} {s.k}</span>
          </div>
        ))}
      </div>
      {(r.runPace || r.walkSpeed) && <div className="r rw-sub" style={{ fontSize: 14 }}>
        {r.runPace && <>Allure moyenne en course : <b>{r.runPace}/km</b></>}{r.runPace && r.walkSpeed && ' · '}
        {r.walkSpeed && <>en marche : <b>{r.walkSpeed} km/h</b></>}
      </div>}
    </>) }] : []),
    { cls: 's-days', lt: true, body: (on) => (<>
      <div className="r rw-kicker">Ta régularité</div>
      <div className="r rw-mid"><Count to={r.activeDays} on={on} /> jour{r.activeDays > 1 ? 's' : ''} actif{r.activeDays > 1 ? 's' : ''} sur {r.days}</div>
      <div className="r rw-cal">
        {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => <em key={i}>{d}</em>)}
        {Array.from({ length: (new Date(`${r.start}T12:00:00Z`).getUTCDay() + 6) % 7 }, (_, i) => <i key={`x${i}`} className="pad" />)}
        {r.calendar.map((d, i) => (
          <i key={d.day} title={`${dFr(d.day)} · ${nf(d.km, 1)} km`} className={`l${d.level}${d.streak ? ' streak' : ''}`}
            style={{ animationDelay: `${i * 35}ms` }} />
        ))}
      </div>
      <div className="r rw-legend"><span>Plus la case est claire, plus tu as fait de km</span><span style={{ color: PAL.orange }}>▢ ta série</span></div>
      <div className="r rw-sub">🔥 Plus longue série : <b>{r.longestStreak} jour{r.longestStreak > 1 ? 's' : ''} d’affilée</b><br />
        📌 <b>{r.activities} sortie{r.activities > 1 ? 's' : ''}</b>{r.capDays > 0 && <>, dont {r.capDays} jour{r.capDays > 1 ? 's' : ''} au palier des 10 km</>}</div>
    </>) },
    { cls: 's-rec', lt: true, body: (on) => (<>
      <div className="r rw-kicker">Tes records</div>
      <div className="r rw-records">
        {r.longest && <div><b><Count to={r.longest.km} dec={1} on={on} /><small> km</small></b><span>ta plus longue sortie · {dFr(r.longest.day)}</span></div>}
        {r.bestDay && <div><b><Count to={r.bestDay.km} dec={1} on={on} /><small> km</small></b><span>ta plus grosse journée · {dFr(r.bestDay.day)}</span></div>}
        {r.bestPace && <div><b><Count to={paceSec(r.bestPace)} on={on} fmt={fmtPace} /><small> /km</small></b><span>ta meilleure allure en course</span></div>}
        <div><b><Count to={r.elevation} on={on} /><small> m D+</small></b>{r.climb ? <span className="rw-orange">{r.climb}</span> : <span>de dénivelé cumulé</span>}</div>
      </div>
      {r.favDay && <div className="r rw-sub" style={{ fontSize: 14 }}>Jour préféré : <b>le {r.favDay.name}</b> ({r.favDay.count} fois)</div>}
    </>) },
    { cls: 's-clock', body: (on) => (<>
      <div className="r rw-kicker">Ton créneau</div>
      <div className="r rw-mid">{slotTop.t}</div>
      <div className="r rw-slots">
        {SLOTS.filter((x) => x.k !== 'day' || r.slots.day > 0).map((x, i) => (
          <div key={x.k} className={`rw-slot${x.k === slotTop.k ? ' top' : ''}`}>
            <div className="rw-slot-head"><span>{x.e} {x.l} <small>{x.d}</small></span><b><Count to={Math.round(r.slots[x.k] * 100)} on={on} /> %</b></div>
            <div className="rw-slot-bar"><i style={{ width: on ? `${r.slots[x.k] * 100}%` : 0, transitionDelay: `${0.3 + i * 0.15}s` }} /></div>
          </div>
        ))}
      </div>
      {r.earliest && <div className="r rw-small" style={{ marginTop: 14 }}>Départ le plus matinal : {r.earliest.time}, {dFr(r.earliest.day)}</div>}
    </>) },
    { cls: 's-boost', lt: true, body: (on) => (<>
      <div className="r rw-kicker">Chasse aux boosts</div>
      <div className="r rw-big">+<Count to={r.boostKm} dec={1} on={on} /><small> km</small></div>
      <div className="r rw-sub">gagnés grâce aux boosts pour {r.teamName ? `la team ${r.teamName}` : 'ton équipe'}</div>
      <div className="r">{r.boosts.map((b) => <span key={b.name} className="rw-chip">{b.name}{b.count > 1 ? ` ×${b.count} sorties` : ''}</span>)}</div>
      {r.boostsTotal > 0 && <div className="r" style={{ marginTop: 16 }}>
        <div className="rw-small">{r.boostsCaught === r.boostsTotal ? <>Boosts attrapés : <b>{r.boostsTotal} sur {r.boostsTotal}, tous !</b> 🎯</> : <>Boosts attrapés : {r.boostsCaught} sur {r.boostsTotal}</>}</div>
        {/* une case par boost : pleine = attrapé, contour seul = raté */}
        <div className="rw-gauge">
          {Array.from({ length: r.boostsTotal }, (_, i) => <i key={i} className={i < r.boostsCaught && on ? 'on' : ''} style={{ transitionDelay: `${0.3 + i * 0.15}s` }} />)}
        </div>
      </div>}
    </>) },
    ...(r.shape ? [{ cls: 's-shape', lt: true, body: (on: boolean) => (<>
      <div className="r rw-kicker" style={{ color: PAL.orange, opacity: 1 }}>#TRACEZ</div>
      <div className="r rw-mid">Ton œuvre d’art GPS</div>
      <svg className="r rw-shape" viewBox="0 0 100 100"><path d={r.shape!.path} pathLength={1} className={on ? 'draw' : ''} /></svg>
      <div className="r rw-sub">« {r.shape!.label || 'Ma forme'} » · <b>{nf(r.shape!.km, 2)} km</b> · {dFr(r.shape!.day)}</div>
      {r.shape!.duels > 0 && <div className="r rw-small">🗳️ {r.shape!.wins} duel{r.shape!.wins > 1 ? 's' : ''} gagné{r.shape!.wins > 1 ? 's' : ''} sur {r.shape!.duels} à la Battle{r.shape!.rank ? ` · ${r.shape!.rank === 1 ? '1re' : `${r.shape!.rank}e`} forme` : ''}</div>}
    </>) }] : []),
    { cls: 's-team', lt: true, body: (on) => {
      const max = Math.max(1, ...r.podium.map((t) => t.km));
      const order = [...r.podium].sort((a, b) => a.rank - b.rank);
      const D = 2 * Math.PI * 44;
      return (<>
        <div className="r rw-kicker">Ta part dans l’équipe</div>
        <div className="r rw-mid">Tu pèses <Count to={Math.round(r.teamShare * 100)} on={on} /> % de la team {r.teamName}</div>
        <svg className="r rw-donut" viewBox="0 0 120 120"><circle cx="60" cy="60" r="44" stroke="rgba(0,0,0,.1)" />
          <circle cx="60" cy="60" r="44" stroke={PAL.noir} strokeDasharray={on ? `${r.teamShare * D} ${D}` : `0 ${D}`} style={{ transition: 'stroke-dasharray 1.4s .3s cubic-bezier(.2,.8,.2,1)' }} /></svg>
        {r.teamRankInside && <div className="r rw-small" style={{ textAlign: 'center' }}>{r.teamRankInside === 1 ? '1re' : `${r.teamRankInside}e`} contribution sur {r.teamMembers} · {nf(r.countedKm, 0)} km sur {nf(r.teamKm, 0)}</div>}
        <div className="r rw-podium">
          {order.map((t, i) => (
            <div key={t.id} style={{ background: t.color, color: light(t.color) ? '#111' : '#fff', height: on ? `${30 + (t.km / max) * 70}%` : 0, transitionDelay: `${0.2 + i * 0.15}s`, outline: t.mine ? `3px solid ${PAL.noir}` : undefined }}>
              {t.rank}
            </div>
          ))}
        </div>
        <div className="r rw-sub" style={{ textAlign: 'center' }}>
          {(() => { const m = r.podium.find((t) => t.mine); if (!m) return null;
            return r.final ? (m.rank === 1 ? <>🏆 La team {m.name} gagne le RunZ !</> : <>La team {m.name} termine <b>{m.rank}e</b></>)
              : <>Classement provisoire : team {m.name} <b>{m.rank === 1 ? '1re' : `${m.rank}e`}</b></>; })()}
        </div>
      </>);
    } },
    ...(r.tracks.length ? [{ cls: 's-tracks', lt: true, body: (on: boolean) => (<>
      <div className="r rw-kicker">Ton mois en tracés</div>
      <div className="r rw-mid">{r.tracksTotal} sortie{r.tracksTotal > 1 ? 's' : ''}, {r.tracksTotal > 1 ? 'autant de dessins' : 'un dessin'}</div>
      <svg className="r rw-scatter" viewBox={`0 0 ${SCATTER_W} ${SCATTER_H}`}>
        {r.tracks.map((t, i) => (
          <g key={i} transform={`translate(${t.x - t.size / 2} ${t.y - t.size / 2}) rotate(${t.rot} ${t.size / 2} ${t.size / 2}) scale(${t.size / 100})`}>
            {/* avec les temps : tracé un peu réduit + distance, allure et temps en dessous (façon partage Strava) */}
            <g transform={withStats ? 'translate(16 -4) scale(.68)' : undefined}>
              <path d={t.path} pathLength={1} stroke={trackColor(t.sport)} vectorEffect="non-scaling-stroke" className={on ? 'draw' : ''} style={{ transitionDelay: `${0.2 + i * 0.05}s` }} />
            </g>
            {withStats && <>
              <text x="50" y="80" textAnchor="middle" className="rw-st-km">{nf(t.km, 2)} km</text>
              <text x="50" y="92" textAnchor="middle" className="rw-st-sub">{statLine(t)}</text>
            </>}
          </g>
        ))}
      </svg>
      {r.tracksTotal > r.tracks.length && <div className="r rw-small" style={{ marginTop: 8 }}>Les {r.tracks.length} plus longues</div>}
      {withStats && <div className="r rw-small" style={{ textAlign: 'center' }}>Données Powered by Strava</div>}
      <div className="r rw-tracks-actions">
        <button className="rw-btn" onClick={() => shareImage(drawTracks(r, withStats), `runz-traces${withStats ? '-temps' : ''}-${slug(r.name)}.png`)}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg>Télécharger</button>
        <button className="rw-switch" role="switch" aria-checked={withStats} onClick={() => setWithStats((v) => !v)}>
          <span className="rw-switch-track"><span className="rw-switch-knob" /></span>Avec les temps
        </button>
      </div>
    </>) }] : []),
  ];

  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const bars = useRef<(HTMLElement | null)[]>([]);
  const elapsed = useRef(0);
  const go = useCallback((i: number) => { elapsed.current = 0; setIdx(Math.max(0, Math.min(slides.length - 1, i))); }, [slides.length]);

  // Jauges : pleines avant la story en cours, vides après (aussi quand on revient en arrière)
  useEffect(() => {
    bars.current.forEach((b, i) => { if (b) b.style.width = i < idx ? '100%' : '0%'; });
  }, [idx]);

  useEffect(() => {
    let raf = 0, last = performance.now();
    const tick = (n: number) => {
      if (!paused) elapsed.current += n - last;
      last = n;
      const cur = bars.current[idx];
      if (cur) cur.style.width = `${Math.min(100, (elapsed.current / DUR) * 100)}%`;
      if (elapsed.current >= DUR && idx < slides.length - 1) { go(idx + 1); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [idx, paused, go, slides.length]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') { if (idx === slides.length - 1) closeRewind(); else go(idx + 1); }
      if (e.key === 'ArrowLeft') go(idx - 1);
      if (e.key === ' ') { e.preventDefault(); setPaused((p) => !p); }
      if (e.key === 'Escape') closeRewind();
    };
    addEventListener('keydown', k); return () => removeEventListener('keydown', k);
  }, [idx, go]);

  const hold = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);
  const down = () => { held.current = false; hold.current = setTimeout(() => { held.current = true; setPaused(true); }, 250); };
  const up = (dir: number) => {
    if (hold.current) clearTimeout(hold.current);
    if (held.current) { setPaused(false); held.current = false; return; }
    if (dir > 0 && idx === slides.length - 1) { closeRewind(); return; } // après la dernière story : on ferme
    go(idx + dir);
  };

  // Rendu dans <body> : plein écran au-dessus du site, quel que soit le conteneur de la page
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => setHost(document.body), []);
  if (!host) return null;
  return createPortal(
    <div className={`rw-overlay${children ? ' has-admin' : ''}`} role="dialog" aria-modal="true" aria-label="Mon RunZ Rewind">
      <div className={`rw-phone${slides[idx].lt ? ' lt' : ''}`} style={{ ['--noir' as string]: PAL.noir, ['--beige' as string]: PAL.beige, ['--creme' as string]: PAL.creme, ['--rose' as string]: PAL.rose, ['--orange' as string]: PAL.orange }}>
        <div className="rw-bars">
          {slides.map((_, i) => <div key={i} className="rw-bar"><i ref={(el) => { bars.current[i] = el; }} /></div>)}
        </div>
        <div className="rw-who">{r.avatar
          ? <img className="rw-av" src={r.avatar} alt="" referrerPolicy="no-referrer" />
          : <span className="rw-av" style={{ background: team, color: teamInk }}>{first[0]}</span>}{r.name}{r.teamName ? ` · ${r.teamName}` : ''}</div>
        <button className="rw-close" onClick={closeRewind} aria-label="Fermer le Rewind">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
        <div className="rw-tap l" onPointerDown={down} onPointerUp={() => up(-1)} onPointerLeave={() => { if (hold.current) clearTimeout(hold.current); if (held.current) { setPaused(false); held.current = false; } }} />
        <div className="rw-tap r" onPointerDown={down} onPointerUp={() => up(1)} onPointerLeave={() => { if (hold.current) clearTimeout(hold.current); if (held.current) { setPaused(false); held.current = false; } }} />
        {slides.map((s, i) => (
          <section key={s.cls} className={`rw-slide ${s.cls}${i === idx ? ' on' : ''}`} style={s.style} aria-hidden={i !== idx}>
            {s.body(i === idx)}
          </section>
        ))}
      </div>
      {children && <div className="rw-admin">{children}</div>}
    </div>,
    host,
  );
}

const slug = (x: string) => x.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Partage (mobile : feuille de partage → story) ou téléchargement de l'image. */
async function shareImage(canvasP: Promise<HTMLCanvasElement>, name: string) {
  try {
    const c = await canvasP;
    const blob = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/png'));
    if (!blob) return;
    const file = new File([blob], name, { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] }) && matchMedia('(pointer: coarse)').matches) {
      try { await navigator.share({ files: [file] }); return; } catch (e) { if ((e as Error).name === 'AbortError') return; }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  } catch (e) { console.error('Rewind : image', e); alert('Impossible de créer l’image, réessaie.'); }
}

async function canvasBase() {
  const W = 1080, H = 1920, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  await document.fonts?.ready;
  const F = getComputedStyle(document.body).fontFamily;
  const logo = await new Promise<HTMLImageElement | null>((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = '/logo.svg'; });
  return { c, g, F, W, H, logo };
}
function drawLogo(g: CanvasRenderingContext2D, logo: HTMLImageElement | null, W: number, y: number, h: number, invert = false) {
  if (!logo) return;
  const w = (logo.naturalWidth && logo.naturalHeight ? logo.naturalWidth / logo.naturalHeight : 2.4) * h;
  if (invert) g.filter = 'invert(1)';
  g.drawImage(logo, (W - w) / 2, y, w, h);
  g.filter = 'none';
}

const trackColor = (_sport: string) => PAL.orange; // course et marche, tout en orange
/** Ses tracés 1080×1920, fond blanc. */
/** « 5:48 /km · 30:12 » (temps seul si pas d'allure). */
const statLine = (t: Track) => [fmtPaceKm(t.timeS, t.km), t.timeS ? fmtDuration(t.timeS) : ''].filter(Boolean).join(' · ');

async function drawTracks(r: Rewind, withStats = false) {
  const { c, g, F, W, logo } = await canvasBase();
  g.fillStyle = PAL.creme; g.fillRect(0, 0, W, 1920);
  g.fillStyle = PAL.noir; g.textAlign = 'left';
  g.font = `500 40px ${F}`; g.fillText('Mon mois en tracés', 80, 150);
  g.font = `600 66px ${F}`; g.fillText(`${r.tracksTotal} sorties · ${nf(r.totalKm, 0)} km`, 80, 230);
  const k = 960 / SCATTER_W, ox = 60, oy = 300 + (1340 - SCATTER_H * k) / 2;
  r.tracks.forEach((t) => {
    g.save(); g.translate(ox + t.x * k, oy + t.y * k); g.rotate((t.rot * Math.PI) / 180);
    const sc = (t.size * k) / 100; g.translate((-t.size * k) / 2, (-t.size * k) / 2); g.scale(sc, sc);
    g.save();
    if (withStats) { g.translate(16, -4); g.scale(0.68, 0.68); }
    g.strokeStyle = trackColor(t.sport); g.lineWidth = (withStats ? 4 / 0.68 : 4) / sc; g.lineCap = 'round'; g.lineJoin = 'round';
    g.stroke(new Path2D(t.path)); g.restore();
    if (withStats) {
      g.fillStyle = PAL.noir; g.textAlign = 'center';
      g.font = `600 11px ${F}`; g.fillText(`${nf(t.km, 2)} km`, 50, 80);
      g.font = `400 7.5px ${F}`; g.fillText(statLine(t), 50, 92);
    }
    g.restore();
  });
  g.textAlign = 'center'; g.fillStyle = '#6f6f6f'; g.font = `600 34px ${F}`;
  g.fillText(`${r.name} · RunZ Challenge${withStats ? ' · Powered by Strava' : ''}`, W / 2, 1660);
  drawLogo(g, logo, W, 1720, 120);
  return c;
}

