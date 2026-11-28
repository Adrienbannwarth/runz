'use client';
import { useEffect, useState } from 'react';

/** Compte à rebours jusqu'à `to` (ISO avec fuseau) ; recharge la page à l'échéance pour afficher les résultats. */
export default function Countdown({ to }: { to: string }) {
  const target = Date.parse(to);
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => {
      const ms = target - Date.now();
      setLeft(Math.max(0, ms));
      if (ms <= 0) window.location.reload();
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [target]);
  const s = Math.floor((left ?? 0) / 1000);
  const parts: [number, string][] = [[Math.floor(s / 86400), 'jours'], [Math.floor(s / 3600) % 24, 'heures'], [Math.floor(s / 60) % 60, 'min'], [s % 60, 'sec']];
  return (
    <div className="se-countdown" role="timer" aria-label="Temps restant avant les résultats">
      {parts.map(([v, l]) => (
        <div key={l} className="se-cd"><b>{left === null ? '–' : String(v).padStart(2, '0')}</b><span>{l}</span></div>
      ))}
    </div>
  );
}
