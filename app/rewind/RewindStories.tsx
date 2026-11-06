'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Rewind } from '@/lib/rewind';
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
  const slotTop = (['morning', 'lunch', 'evening'] as const).slice().sort((a, b) => r.slots[b] - r.slots[a])[0];
  const slotTitle = { morning: 'Lève-tôt certifié ☀️', lunch: 'Roi·reine de la pause déj 🥪', evening: 'Oiseau de nuit 🌙' }[slotTop];

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
    { cls: 's-clock', lt: true, body: (on) => {
      const C = 2 * Math.PI * 80; let acc = 0;
      return (<>
        <div className="r rw-kicker">Ton créneau</div>
        <div className="r rw-mid">{slotTitle}</div>
        <svg className="r rw-clock" viewBox="0 0 200 200">
          <circle cx="100" cy="100" r="80" fill="none" stroke="#1d3a1222" strokeWidth="22" />
          {([['morning', '#FA8F18'], ['lunch', '#78AF5F'], ['evening', '#3847C4']] as const).map(([k, c], i) => {
            const p = r.slots[k]; const rot = -90 + acc * 360; acc += p;
            return p > 0 && <circle key={k} cx="100" cy="100" r="80" fill="none" stroke={c} strokeWidth="22"
              strokeDasharray={`${Math.max(0, p * C - 3)} ${C}`} strokeDashoffset={on ? 0 : p * C}
              transform={`rotate(${rot} 100 100)`} style={{ transition: `stroke-dashoffset 1.1s ${0.25 + i * 0.35}s cubic-bezier(.2,.8,.2,1)` }} />;
          })}
        </svg>
        <div className="r rw-sub" style={{ textAlign: 'center' }}><b style={{ color: '#c86a00' }}>{pct(r.slots.morning)}</b> avant 9h30 · <b style={{ color: '#4c8a33' }}>{pct(r.slots.lunch)}</b> à la pause déj · <b style={{ color: '#3847C4' }}>{pct(r.slots.evening)}</b> le reste du temps</div>
        {r.earliest && <div className="r rw-small" style={{ textAlign: 'center', marginTop: 6 }}>Départ le plus matinal : {r.earliest.time}, {dFr(r.earliest.day)}</div>}
      </>);
    } },
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
    { cls: 's-team', style: { background: team, color: teamInk }, body: (on) => {
      const max = Math.max(1, ...r.podium.map((t) => t.km));
      const order = [...r.podium].sort((a, b) => a.rank - b.rank);
      const D = 2 * Math.PI * 44;
      return (<>
        <div className="r rw-kicker">Ta part dans l’équipe</div>
        <div className="r rw-mid">Tu pèses <Count to={Math.round(r.teamShare * 100)} on={on} /> % de la team {r.teamName}</div>
        <svg className="r rw-donut" viewBox="0 0 120 120"><circle cx="60" cy="60" r="44" stroke={teamInk === '#fff' ? 'rgba(255,255,255,.25)' : 'rgba(0,0,0,.15)'} />
          <circle cx="60" cy="60" r="44" stroke={teamInk} strokeDasharray={on ? `${r.teamShare * D} ${D}` : `0 ${D}`} style={{ transition: 'stroke-dasharray 1.4s .3s cubic-bezier(.2,.8,.2,1)' }} /></svg>
        {r.teamRankInside && <div className="r rw-small" style={{ textAlign: 'center' }}>{r.teamRankInside === 1 ? '1re' : `${r.teamRankInside}e`} contribution sur {r.teamMembers} · {nf(r.countedKm, 0)} km sur {nf(r.teamKm, 0)}</div>}
        <div className="r rw-podium">
          {order.map((t, i) => (
            <div key={t.id} style={{ background: t.color, color: light(t.color) ? '#111' : '#fff', height: on ? `${30 + (t.km / max) * 70}%` : 0, transitionDelay: `${0.2 + i * 0.15}s`, outline: t.mine ? `3px solid ${teamInk}` : undefined }}>
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
    { cls: 's-end', lt: true, body: () => (<>
      <div className="r rw-kicker">Ton RunZ en une carte</div>
      <div className="r rw-card" style={{ borderTopColor: team }}>
        <div className="rw-card-name">{r.name}{r.teamName ? ` · ${r.teamName}` : ''}</div>
        {endRows(r).map(([k, v]) => <div key={k} className="rw-row"><span>{k}</span><b>{v}</b></div>)}
      </div>
      <div className="r" style={{ textAlign: 'center' }}><button className="rw-btn" onClick={(e) => { e.stopPropagation(); downloadCard(r, team, teamInk); }}>⬇ Télécharger ma story</button></div>
      <div className="r rw-small" style={{ textAlign: 'center', marginTop: 8 }}>Merci d’avoir couru avec nous 🧡</div>
    </>) },
  ];

  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const fill = useRef<HTMLElement | null>(null);
  const elapsed = useRef(0);
  const go = useCallback((i: number) => { elapsed.current = 0; setIdx(Math.max(0, Math.min(slides.length - 1, i))); }, [slides.length]);

  useEffect(() => {
    let raf = 0, last = performance.now();
    const tick = (n: number) => {
      if (!paused) elapsed.current += n - last;
      last = n;
      if (fill.current) fill.current.style.width = `${Math.min(100, (elapsed.current / DUR) * 100)}%`;
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
          {slides.map((_, i) => <div key={i} className="rw-bar"><i ref={i === idx ? (el) => { fill.current = el; } : undefined} style={{ width: i < idx ? '100%' : 0 }} /></div>)}
        </div>
        <div className="rw-who"><span className="rw-av" style={{ background: team, color: teamInk }}>{first[0]}</span>{r.name}{r.teamName ? ` · ${r.teamName}` : ''}</div>
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

function endRows(r: Rewind): [string, string][] {
  const rows: [string, string][] = [
    ['Km parcourus', `${nf(r.totalKm, 1)} km`],
    ['Km comptés pour l’équipe', `${nf(r.countedKm, 1)} km`],
    ['Jours actifs', `${r.activeDays} / ${r.days}`],
    ['Plus longue série', `${r.longestStreak} j`],
    ['Bonus des boosts', `+${nf(r.boostKm, 1)} km`],
  ];
  const m = r.podium.find((t) => t.mine);
  if (m) rows.push([r.final ? 'Classement équipe' : 'Équipe (provisoire)', m.rank === 1 ? '1re 🏆' : `${m.rank}e`]);
  return rows;
}

/** Carte finale en image 1080×1920 (format story). */
async function downloadCard(r: Rewind, team: string, ink: string) {
  const W = 1080, H = 1920, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  await document.fonts?.ready;
  const F = getComputedStyle(document.body).fontFamily;
  g.fillStyle = '#F5F5F5'; g.fillRect(0, 0, W, H);
  g.fillStyle = team; g.fillRect(0, 0, W, 560);
  const logo = await new Promise<HTMLImageElement | null>((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = '/logo.svg'; });
  g.fillStyle = ink; g.textAlign = 'left';
  g.font = `800 44px ${F}`; g.fillText('MON RUNZ REWIND', 80, 140);
  g.font = `900 190px ${F}`; g.fillText(nf(r.totalKm, 1), 80, 360);
  g.font = `700 56px ${F}`; g.fillText('km parcourus', 80, 450);
  g.fillStyle = '#fff'; roundRect(g, 60, 620, W - 120, 1000, 36); g.fill();
  g.fillStyle = '#111'; g.font = `800 52px ${F}`; g.fillText(`${r.name}${r.teamName ? ` · ${r.teamName}` : ''}`.slice(0, 32), 110, 720);
  const rows = endRows(r).slice(1);
  if (r.split.run || r.split.walk) rows.unshift(['Course / marche', `${nf(r.split.run + r.split.trail, 0)} / ${nf(r.split.walk + r.split.hike, 0)} km`]);
  rows.forEach(([k, v], i) => {
    const y = 840 + i * 118;
    g.fillStyle = '#6f6f6f'; g.font = `500 40px ${F}`; g.textAlign = 'left'; g.fillText(k, 110, y);
    g.fillStyle = '#111'; g.font = `800 48px ${F}`; g.textAlign = 'right'; g.fillText(v, W - 110, y);
    if (i < rows.length - 1) { g.fillStyle = '#e5e5e5'; g.fillRect(110, y + 40, W - 220, 3); }
  });
  g.textAlign = 'left';
  if (logo) { const h = 150, w = (logo.width / logo.height) * h || 300; g.drawImage(logo, (W - w) / 2, 1700, w, h); }
  const a = document.createElement('a');
  a.download = `runz-rewind-${r.name.toLowerCase().replace(/[^a-z0-9]+/gi, '-')}.png`;
  a.href = c.toDataURL('image/png'); a.click();
}
function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, rr: number) {
  g.beginPath(); g.moveTo(x + rr, y); g.arcTo(x + w, y, x + w, y + h, rr); g.arcTo(x + w, y + h, x, y + h, rr);
  g.arcTo(x, y + h, x, y, rr); g.arcTo(x, y, x + w, y, rr); g.closePath();
}
