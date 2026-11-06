'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { SCATTER_H, SCATTER_W, type Rewind } from '@/lib/rewind';
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
function Count({ to, dec = 0, on }: { to: number; dec?: number; on: boolean }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!on) { setV(0); return; }
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { setV(to); return; }
    let raf = 0; const s = performance.now();
    const f = (n: number) => { const k = Math.min(1, (n - s) / 1400); setV(to * (1 - Math.pow(1 - k, 3))); if (k < 1) raf = requestAnimationFrame(f); };
    raf = requestAnimationFrame(f);
    return () => cancelAnimationFrame(raf);
  }, [on, to]);
  return <>{nf(v, dec)}</>;
}

export default function RewindStories({ r }: { r: Rewind }) {
  const team = r.teamColor ?? '#fc5200';
  const teamInk = light(team) ? '#111' : '#fff';
  const first = r.name.split(' ')[0];
  const sportTotal = Math.max(1, r.split.run + r.split.walk + r.split.trail + r.split.hike);
  const sports = [
    { k: 'Course', e: '🏃', v: r.split.run, c: '#FA8F18' },
    { k: 'Marche', e: '🚶', v: r.split.walk, c: '#78AF5F' },
    { k: 'Trail', e: '⛰️', v: r.split.trail, c: '#3847C4' },
    { k: 'Rando', e: '🥾', v: r.split.hike, c: '#9A1325' },
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

  const slides: { cls: string; lt?: boolean; style?: React.CSSProperties; body: (on: boolean) => React.ReactNode }[] = [
    { cls: 's-intro', lt: true, body: () => (<>
      <img className="r rw-logo" src="/logo.svg" alt="RunZ by Colorz" />
      <div className="r rw-kicker" style={{ marginTop: 18 }}>{dFr(r.start)} → {dFr(r.end)}</div>
      <div className="r rw-mid" style={{ marginTop: 22 }}>{r.days} jours.<br />{r.podium.length} équipes.<br />Et toi, {first} ?</div>
      <div className="r rw-small" style={{ marginTop: 22 }}>Touche à droite pour avancer →</div>
    </>) },
    { cls: 's-km', style: { background: team, color: teamInk }, body: (on) => (<>
      <div className="r rw-kicker">Au total, tu as parcouru</div>
      <div className="r rw-big"><Count to={r.totalKm} dec={1} on={on} /><small> km</small></div>
      {r.trip && <div className="r rw-sub">Soit {r.trip.label.includes('→') ? 'un ' : ''}<b>{r.trip.label}</b> à la force des mollets.</div>}
      <div className="r rw-road"><i style={{ background: teamInk }} /><span className={on ? 'go' : ''}>🏃</span></div>
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
    { cls: 's-days', body: (on) => (<>
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
      <div className="r rw-legend"><span>Plus la case est claire, plus tu as fait de km</span><span style={{ color: '#FA8F18' }}>▢ ta série</span></div>
      <div className="r rw-sub">🔥 Plus longue série : <b>{r.longestStreak} jour{r.longestStreak > 1 ? 's' : ''} d’affilée</b><br />
        📌 <b>{r.activities} sortie{r.activities > 1 ? 's' : ''}</b>{r.capDays > 0 && <>, dont {r.capDays} jour{r.capDays > 1 ? 's' : ''} au palier des 10 km</>}</div>
    </>) },
    { cls: 's-rec', body: () => (<>
      <div className="r rw-kicker">Tes records</div>
      <div className="r rw-mid">Le jour où tu as tout donné</div>
      <div className="r rw-rec">
        {r.longest && <div><b>{nf(r.longest.km, 1)} km</b><span>Plus longue sortie · {dFr(r.longest.day)}</span></div>}
        {r.bestDay && <div><b>{nf(r.bestDay.km, 1)} km</b><span>Plus grosse journée · {dFr(r.bestDay.day)}</span></div>}
        {r.bestPace && <div><b>{r.bestPace}</b><span>Meilleure allure moyenne en course</span></div>}
        <div><b>{nf(r.elevation)} m</b><span>D+ cumulé{r.eiffel >= 0.5 ? ` · ${nf(r.eiffel, 1)} tour${r.eiffel >= 2 ? 's' : ''} Eiffel` : ''}</span></div>
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
    { cls: 's-boost', body: (on) => (<>
      <div className="r rw-kicker">Chasse aux boosts</div>
      <div className="r rw-big" style={{ color: '#FA8F18' }}>+<Count to={r.boostKm} dec={1} on={on} /><small> km</small></div>
      <div className="r rw-sub">gagnés grâce aux boosts pour {r.teamName ? `la team ${r.teamName}` : 'ton équipe'}</div>
      <div className="r">{r.boosts.map((b) => <span key={b.name} className="rw-chip">{b.name}{b.count > 1 ? ` ×${b.count} sorties` : ''}</span>)}</div>
      {r.boostsTotal > 0 && <div className="r" style={{ marginTop: 16 }}>
        <div className="rw-small">Boosts attrapés : {r.boostsCaught} sur {r.boostsTotal}</div>
        <div className="rw-gauge"><i style={{ width: on ? `${(r.boostsCaught / r.boostsTotal) * 100}%` : 0 }} /></div>
      </div>}
    </>) },
    ...(r.shape ? [{ cls: 's-shape', lt: true, body: (on: boolean) => (<>
      <div className="r rw-kicker" style={{ color: '#FC4C02' }}>#TRACEZ</div>
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
          <circle cx="60" cy="60" r="44" stroke="#111" strokeDasharray={on ? `${r.teamShare * D} ${D}` : `0 ${D}`} style={{ transition: 'stroke-dasharray 1.4s .3s cubic-bezier(.2,.8,.2,1)' }} /></svg>
        {r.teamRankInside && <div className="r rw-small" style={{ textAlign: 'center' }}>{r.teamRankInside === 1 ? '1re' : `${r.teamRankInside}e`} contribution sur {r.teamMembers} · {nf(r.countedKm, 0)} km sur {nf(r.teamKm, 0)}</div>}
        <div className="r rw-podium">
          {order.map((t, i) => (
            <div key={t.id} style={{ background: t.color, color: light(t.color) ? '#111' : '#fff', height: on ? `${30 + (t.km / max) * 70}%` : 0, transitionDelay: `${0.2 + i * 0.15}s`, outline: t.mine ? '3px solid #111' : undefined }}>
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
            <path d={t.path} pathLength={1} stroke={trackColor(t.sport)} vectorEffect="non-scaling-stroke" className={on ? 'draw' : ''} style={{ transitionDelay: `${0.2 + i * 0.05}s` }} />
          </g>
        ))}
      </svg>
      <div className="r rw-small" style={{ marginTop: 8 }}>
        <span style={{ color: '#FC4C02' }}>●</span> course <span style={{ color: '#4c8a33', marginLeft: 8 }}>●</span> marche
        {r.tracksTotal > r.tracks.length && <> · les {r.tracks.length} plus longues</>}
      </div>
      <div className="r" style={{ textAlign: 'center' }}><button className="rw-btn" onClick={() => shareImage(drawTracks(r), `runz-traces-${slug(r.name)}.png`)}>⬇ Télécharger mes tracés</button></div>
    </>) }] : []),
    ...(r.gallery.length ? [{ cls: 's-gallery', body: (on: boolean) => (<>
      <div className="r rw-kicker" style={{ color: '#FC4C02' }}>La galerie #TRACEZ</div>
      <div className="r rw-mid">{r.gallery.length} forme{r.gallery.length > 1 ? 's' : ''} dessinée{r.gallery.length > 1 ? 's' : ''} par les Colorz</div>
      <div className="r rw-gal" style={{ gridTemplateColumns: `repeat(${galCols(r.gallery.length)}, 1fr)` }}>
        {r.gallery.map((g, i) => (
          <svg key={i} viewBox="0 0 100 100" className={g.mine ? 'mine' : ''}>
            <path d={g.path} pathLength={1} className={on ? 'draw' : ''} style={{ transitionDelay: `${0.3 + i * 0.06}s` }} />
          </svg>
        ))}
      </div>
      {r.gallery.some((g) => g.mine) && <div className="r rw-small" style={{ marginTop: 8 }}><span style={{ color: '#FC4C02' }}>●</span> ta forme</div>}
      <div className="r" style={{ textAlign: 'center' }}><button className="rw-btn light" onClick={() => shareImage(drawGallery(r), 'runz-galerie-tracez.png')}>⬇ Télécharger la galerie</button></div>
      <div className="r rw-small" style={{ textAlign: 'center', marginTop: 8 }}>Merci d’avoir marché et couru avec nous 🧡</div>
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
      if (e.key === 'ArrowRight') go(idx + 1);
      if (e.key === 'ArrowLeft') go(idx - 1);
      if (e.key === ' ') { e.preventDefault(); setPaused((p) => !p); }
    };
    addEventListener('keydown', k); return () => removeEventListener('keydown', k);
  }, [idx, go]);

  const hold = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);
  const down = () => { held.current = false; hold.current = setTimeout(() => { held.current = true; setPaused(true); }, 250); };
  const up = (dir: number) => { if (hold.current) clearTimeout(hold.current); if (held.current) { setPaused(false); held.current = false; return; } go(idx + dir); };

  return (
    <div className="rw">
      <div className={`rw-phone${slides[idx].lt ? ' lt' : ''}`}>
        <div className="rw-bars">
          {slides.map((_, i) => <div key={i} className="rw-bar"><i ref={(el) => { bars.current[i] = el; }} /></div>)}
        </div>
        <div className="rw-who">{r.avatar
          ? <img className="rw-av" src={r.avatar} alt="" referrerPolicy="no-referrer" />
          : <span className="rw-av" style={{ background: team, color: teamInk }}>{first[0]}</span>}{r.name}{r.teamName ? ` · ${r.teamName}` : ''}</div>
        <div className="rw-tap l" onPointerDown={down} onPointerUp={() => up(-1)} onPointerLeave={() => { if (hold.current) clearTimeout(hold.current); if (held.current) { setPaused(false); held.current = false; } }} />
        <div className="rw-tap r" onPointerDown={down} onPointerUp={() => up(1)} onPointerLeave={() => { if (hold.current) clearTimeout(hold.current); if (held.current) { setPaused(false); held.current = false; } }} />
        {slides.map((s, i) => (
          <section key={s.cls} className={`rw-slide ${s.cls}${i === idx ? ' on' : ''}`} style={s.style} aria-hidden={i !== idx}>
            {s.body(i === idx)}
          </section>
        ))}
      </div>
      <div className="rw-ctrl">
        <button className="btn" onClick={() => go(idx - 1)}>‹ Précédent</button>
        <button className="btn" onClick={() => setPaused((p) => !p)}>{paused ? 'Lecture' : 'Pause'}</button>
        <button className="btn" onClick={() => go(idx + 1)}>Suivant ›</button>
      </div>
    </div>
  );
}

const slug = (x: string) => x.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const galCols = (n: number) => (n <= 4 ? 2 : n <= 9 ? 3 : n <= 20 ? 4 : n <= 30 ? 5 : 6);

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

const trackColor = (sport: string) => (['Walk', 'Hike'].includes(sport) ? '#4c8a33' : '#FC4C02');
/** Ses tracés 1080×1920, fond blanc. */
async function drawTracks(r: Rewind) {
  const { c, g, F, W, logo } = await canvasBase();
  g.fillStyle = '#fff'; g.fillRect(0, 0, W, 1920);
  g.fillStyle = '#111'; g.textAlign = 'left';
  g.font = `800 40px ${F}`; g.fillText('MON MOIS EN TRACÉS', 80, 150);
  g.font = `900 64px ${F}`; g.fillText(`${r.tracksTotal} sorties · ${nf(r.totalKm, 0)} km`, 80, 230);
  const k = 960 / SCATTER_W, ox = 60, oy = 300 + (1340 - SCATTER_H * k) / 2;
  r.tracks.forEach((t) => {
    g.save(); g.translate(ox + t.x * k, oy + t.y * k); g.rotate((t.rot * Math.PI) / 180);
    const sc = (t.size * k) / 100; g.translate((-t.size * k) / 2, (-t.size * k) / 2); g.scale(sc, sc);
    g.strokeStyle = trackColor(t.sport); g.lineWidth = 4 / sc; g.lineCap = 'round'; g.lineJoin = 'round';
    g.stroke(new Path2D(t.path)); g.restore();
  });
  g.textAlign = 'center'; g.fillStyle = '#6f6f6f'; g.font = `600 34px ${F}`;
  g.fillText(`${r.name} · RunZ Challenge`, W / 2, 1660);
  drawLogo(g, logo, W, 1720, 120);
  return c;
}

/** Galerie 1080×1920 : toutes les formes #TRACEZ, la sienne en orange. */
async function drawGallery(r: Rewind) {
  const { c, g, F, W, logo } = await canvasBase();
  g.fillStyle = '#111'; g.fillRect(0, 0, W, 1920);
  g.fillStyle = '#FC4C02'; g.textAlign = 'center';
  g.font = `900 44px ${F}`; g.fillText('LA GALERIE #TRACEZ', W / 2, 150);
  g.fillStyle = '#fff'; g.font = `800 58px ${F}`; g.fillText(`${r.gallery.length} formes · RunZ by Colorz`, W / 2, 230);
  const top = 300, bottom = 1640, pad = 60, n = r.gallery.length;
  // nombre de colonnes qui donne les plus grandes formes
  const cols = [1, 2, 3, 4, 5, 6, 7, 8].reduce((best, k) =>
    Math.min((W - 2 * pad) / k, (bottom - top) / Math.ceil(n / k)) > Math.min((W - 2 * pad) / best, (bottom - top) / Math.ceil(n / best)) ? k : best, 1);
  const rows = Math.ceil(n / cols);
  const cell = Math.min((W - 2 * pad) / cols, (bottom - top) / rows);
  const ox = (W - cell * cols) / 2, oy = top + (bottom - top - cell * rows) / 2;
  r.gallery.forEach((s, i) => {
    const x = ox + (i % cols) * cell, y = oy + Math.floor(i / cols) * cell;
    g.save(); g.translate(x + cell * 0.08, y + cell * 0.08); g.scale(cell * 0.84 / 100, cell * 0.84 / 100);
    g.strokeStyle = s.mine ? '#FC4C02' : '#fff'; g.lineWidth = s.mine ? 3.2 : 2.2; g.lineCap = 'round'; g.lineJoin = 'round';
    g.stroke(new Path2D(s.path)); g.restore();
  });
  drawLogo(g, logo, W, 1700, 120, true);
  return c;
}
