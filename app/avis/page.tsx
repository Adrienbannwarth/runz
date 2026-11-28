import AvisForm from './AvisForm';
import { getParticipantId } from '@/lib/session';
import { myFeedback } from '@/lib/feedback';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Donne ton avis · RunZ' };

/** Formulaire d'avis de fin de saison : 2 minutes, surtout des clics. */
export default async function AvisPage() {
  const pid = await getParticipantId();
  const mine = await myFeedback(pid);
  return (
    <div className="avis">
      <p className="eyebrow">RunZ · Saison 1</p>
      <h1>Donne ton avis</h1>
      <p className="muted">2 minutes, presque que des clics. Toutes les questions sont facultatives ; tes réponses nous aident à préparer la suite.</p>
      <AvisForm initial={mine} loggedIn={!!pid} />
    </div>
  );
}
