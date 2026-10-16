'use client';
import { useEffect, useRef, useState } from 'react';

type T = { id: number; name: string; color: string; active: boolean };

/** Liste déroulante d'équipes avec la pastille de la vraie couleur (code hexa). Envoie `name` dans le formulaire. */
export default function TeamSelect({ teams, name = 'team_id', defaultValue = '' }: { teams: T[]; name?: string; defaultValue?: number | string | null }) {
  const [value, setValue] = useState(defaultValue == null ? '' : String(defaultValue));
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  const current = teams.find((t) => String(t.id) === value);
  const options: (T | null)[] = [null, ...teams];
  return (
    <div className="team-select" ref={ref}>
      <input type="hidden" name={name} value={value} />
      <button type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}>
        <span className={`dot${current ? '' : ' empty'}`} style={current ? { background: current.color } : undefined} />
        {current ? current.name : 'Sans équipe'}
      </button>
      {open && (
        <ul role="listbox">
          {options.map((t) => (
            <li key={t ? t.id : 'none'}>
              <button type="button" role="option" aria-selected={(t ? String(t.id) : '') === value}
                onClick={() => { setValue(t ? String(t.id) : ''); setOpen(false); }}>
                <span className={`dot${t ? '' : ' empty'}`} style={t ? { background: t.color } : undefined} />
                {t ? t.name : 'Sans équipe'}{t && !t.active ? <span className="muted small">(inactive)</span> : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
