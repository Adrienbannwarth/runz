'use client';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { sendAvis } from './actions';
import { DISLIKED, LIKED, NEXT, RATINGS, RHYTHMS, SPORTS, type Feedback } from '@/lib/feedback-core';

function Chips({ options, value, onChange, multi }: { options: readonly string[]; value: string[]; onChange: (v: string[]) => void; multi: boolean }) {
  return (
    <div className="avis-chips">
      {options.map((o) => {
        const on = value.includes(o);
        return (
          <button key={o} type="button" className={`avis-chip${on ? ' on' : ''}`} aria-pressed={on}
            onClick={() => onChange(multi ? (on ? value.filter((x) => x !== o) : [...value, o]) : on ? [] : [o])}>
            {o}
          </button>
        );
      })}
    </div>
  );
}

export default function AvisForm({ initial, loggedIn }: { initial: Feedback | null; loggedIn: boolean }) {
  const [rating, setRating] = useState<number | null>(initial?.rating ?? null);
  const [liked, setLiked] = useState<string[]>(initial?.liked ?? []);
  const [disliked, setDisliked] = useState<string[]>(initial?.disliked ?? []);
  const [rhythm, setRhythm] = useState<string[]>(initial?.rhythm ? [initial.rhythm] : []);
  const [next, setNext] = useState<string[]>(initial?.next_season ? [initial.next_season] : []);
  const [sports, setSports] = useState<string[]>(initial?.sports ?? []);
  const [challenge, setChallenge] = useState(initial?.challenge ?? '');
  const [comment, setComment] = useState(initial?.comment ?? '');
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');
  const [pending, start] = useTransition();

  const submit = () => start(async () => {
    setErr('');
    const r = await sendAvis({ rating, liked, disliked, rhythm: rhythm[0] ?? null, next_season: next[0] ?? null, sports, challenge, comment });
    if (r.ok) { setDone(true); window.scrollTo({ top: 0, behavior: 'smooth' }); } else setErr(r.error ?? 'Erreur');
  });

  if (done) {
    return (
      <div className="avis-done">
        <p className="avis-done-title">Merci pour ton avis&nbsp;! 🙌</p>
        <p>On s’en sert pour préparer la prochaine saison.{loggedIn ? ' Tu peux revenir le modifier quand tu veux.' : ''}</p>
        <Link href="/" className="btn primary">Retour à l’accueil</Link>
      </div>
    );
  }

  return (
    <form className="avis-form" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <fieldset className="avis-q">
        <legend><span className="avis-n">1</span> Ta note pour RunZ</legend>
        <div className="avis-rating">
          {RATINGS.map((x) => (
            <button key={x.v} type="button" className={`avis-rate${rating === x.v ? ' on' : ''}`} aria-pressed={rating === x.v} onClick={() => setRating(rating === x.v ? null : x.v)}>
              <span aria-hidden="true">{x.emoji}</span>{x.label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="avis-q">
        <legend><span className="avis-n">2</span> Ce que tu as le plus aimé <small>plusieurs choix possibles</small></legend>
        <Chips options={LIKED} value={liked} onChange={setLiked} multi />
      </fieldset>

      <fieldset className="avis-q">
        <legend><span className="avis-n">3</span> Ce qui t’a moins plu <small>plusieurs choix possibles</small></legend>
        <Chips options={DISLIKED} value={disliked} onChange={setDisliked} multi />
      </fieldset>

      <fieldset className="avis-q">
        <legend><span className="avis-n">4</span> Le bon rythme pour la suite</legend>
        <Chips options={RHYTHMS} value={rhythm} onChange={setRhythm} multi={false} />
      </fieldset>

      <fieldset className="avis-q">
        <legend><span className="avis-n">5</span> Partant·e pour une saison 2, plus variée&nbsp;?</legend>
        <Chips options={NEXT} value={next} onChange={setNext} multi={false} />
      </fieldset>

      <fieldset className="avis-q">
        <legend><span className="avis-n">6</span> Les sports que tu aimerais voir compter <small>enregistrables sur Strava, avec ton téléphone ou ta montre</small></legend>
        <Chips options={SPORTS} value={sports} onChange={setSports} multi />
      </fieldset>

      <fieldset className="avis-q">
        <legend><span className="avis-n">7</span> Un défi que tu aimerais relever ces prochains mois&nbsp;? <small>facultatif</small></legend>
        <input className="avis-input" value={challenge} onChange={(e) => setChallenge(e.target.value)} maxLength={300} placeholder="Ex. courir mon premier 10 km, nager 1 km, faire 100 km à vélo…" aria-label="Le défi que tu aimerais relever" />
      </fieldset>

      <fieldset className="avis-q">
        <legend><span className="avis-n">8</span> Un dernier mot&nbsp;? <small>facultatif</small></legend>
        <textarea className="avis-input" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1500} placeholder="Une idée, un bug, un merci…" aria-label="Un dernier mot" />
      </fieldset>

      {err && <p className="avis-err" role="alert">{err}</p>}
      <div className="avis-send">
        <button type="submit" className="btn primary" disabled={pending}>{pending ? 'Envoi…' : initial ? 'Mettre à jour mon avis' : 'Envoyer mon avis'}</button>
        <span className="muted small">{loggedIn ? 'Ton avis est lié à ton compte, tu pourras le modifier.' : 'Tu n’es pas connecté·e : ton avis sera anonyme.'}</span>
      </div>
    </form>
  );
}
