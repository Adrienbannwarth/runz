// BingoZ (saison 2) : catalogue des défis validés (onglets « Défis validés » et « Défis restants (cadrés) » du doc de cadrage).
// V1 : affichage seulement ; les règles de validation automatique (sport, distance, horaire…) viendront avec le moteur.

export type BingoLevel = 'Facile' | 'Moyen' | 'Costaud' | 'Exploit';
export type BingoDefi = { id: number; family: string; label: string; short: string; level: BingoLevel; check: 'strava' | 'admin' | 'photo'; double?: boolean };

export const BINGO_SIZE = 7;                 // grille 7 × 7
export const BINGO_CELLS = BINGO_SIZE * BINGO_SIZE;
export const BINGO_CENTER = Math.floor(BINGO_CELLS / 2); // case du milieu : défi imposé par une autre équipe

export const DEFIS: BingoDefi[] = [
  { id: 1, family: 'Course', label: '10 km de course d’une traite', short: '10 km de course', level: 'Moyen', check: 'strava' },
  { id: 2, family: 'Course', label: 'Semi-marathon : 21,1 km de course', short: 'Semi-marathon', level: 'Exploit', check: 'strava' },
  { id: 6, family: 'Course', label: '1 h 30 de course sans t’arrêter', short: '1 h 30 de course', level: 'Costaud', check: 'strava' },
  { id: 7, family: 'Course', label: '3 courses dans la même semaine (minimum 40 min)', short: '3 courses / semaine', level: 'Moyen', check: 'strava' },
  { id: 10, family: 'Trail et rando', label: '500 m de dénivelé en une sortie', short: '500 m D+', level: 'Moyen', check: 'strava' },
  { id: 11, family: 'Trail et rando', label: '1 000 m de dénivelé en une sortie', short: '1 000 m D+', level: 'Exploit', check: 'strava' },
  { id: 12, family: 'Trail et rando', label: 'Une rando de 15 km', short: 'Rando 15 km', level: 'Moyen', check: 'strava' },
  { id: 14, family: 'Vélo', label: '50 km de vélo', short: '50 km de vélo', level: 'Moyen', check: 'strava' },
  { id: 15, family: 'Vélo', label: '80 km de vélo', short: '80 km de vélo', level: 'Exploit', check: 'strava' },
  { id: 21, family: 'Eau', label: '1 km de natation', short: '1 km de nage', level: 'Facile', check: 'strava' },
  { id: 22, family: 'Eau', label: '2 km de natation d’une traite', short: '2 km de nage', level: 'Costaud', check: 'strava' },
  { id: 24, family: 'Eau', label: '10 km de rameur ou d’aviron', short: '10 km de rameur', level: 'Moyen', check: 'strava' },
  { id: 26, family: 'Salle et autres', label: '3 séances de salle dans la semaine', short: 'Salle × 3', level: 'Moyen', check: 'strava' },
  { id: 29, family: 'Salle et autres', label: '1 h de padel, tennis ou badminton', short: '1 h de raquette', level: 'Facile', check: 'strava' },
  { id: 30, family: 'Salle et autres', label: '45 min de cours collectif (HIIT, crossfit, danse)', short: 'Cours collectif', level: 'Facile', check: 'strava' },
  { id: 109, family: 'Salle et autres', label: '1 h de séance d’Hyrox avec Adri', short: 'Hyrox avec Adri', level: 'Moyen', check: 'admin' },
  { id: 31, family: 'Multisport', label: 'Brique : 30 km de vélo puis 5 km de course enchaînés', short: 'Brique vélo + course', level: 'Costaud', check: 'strava' },
  { id: 32, family: 'Multisport', label: 'Triathlon maison : nage, vélo et course le même jour', short: 'Triathlon maison', level: 'Exploit', check: 'strava' },
  { id: 74, family: 'Multisport', label: 'Aquathlon : 1 km de nage puis 5 km de course, le même jour', short: 'Aquathlon', level: 'Costaud', check: 'strava' },
  { id: 33, family: 'Multisport', label: '3 sports différents dans la même semaine', short: '3 sports / semaine', level: 'Moyen', check: 'strava' },
  { id: 34, family: 'Multisport', label: '5 sports différents pendant la saison', short: '5 sports / saison', level: 'Moyen', check: 'strava' },
  { id: 80, family: 'Endurance', label: 'Marathon en 7 jours : 42,2 km de course sur une semaine', short: 'Marathon en 7 jours', level: 'Costaud', check: 'strava' },
  { id: 39, family: 'Horaires', label: 'Pause déj sportive 3 fois dans la semaine', short: 'Pause déj × 3', level: 'Moyen', check: 'strava' },
  { id: 41, family: 'Régularité', label: '7 jours actifs d’affilée (au moins 45 min)', short: '7 jours d’affilée', level: 'Costaud', check: 'strava' },
  { id: 45, family: 'Ensemble', label: 'Duo : 10 km de course à deux', short: 'Duo 10 km', level: 'Facile', check: 'strava' },
  { id: 48, family: 'Ensemble', label: 'Une sortie avec quelqu’un d’une autre équipe (45 min minimum)', short: 'Avec une autre équipe', level: 'Facile', check: 'strava' },
  { id: 49, family: 'Ensemble', label: 'Toute l’équipe active le même jour', short: 'Toute l’équipe le même jour', level: 'Moyen', check: 'strava' },
  { id: 98, family: 'Équipe', label: 'Everest d’équipe : 8 849 m de dénivelé cumulés par l’équipe en une semaine', short: 'Everest d’équipe', level: 'Exploit', check: 'strava' },
  { id: 58, family: 'Tracés', label: 'Un tracé en forme d’animal (5 km minimum)', short: 'Tracé animal', level: 'Costaud', check: 'admin' },
  { id: 66, family: 'Photo et fun', label: 'Une sortie sous la pluie', short: 'Sous la pluie', level: 'Facile', check: 'photo' },
  { id: 149, family: 'Équipe', label: 'Les 24 h du week-end : l’équipe cumule 24 h d’activité entre samedi 0 h et dimanche 23 h 59 (tous les membres y contribuent, 3 h maximum par activité)', short: '24 h du week-end', level: 'Costaud', check: 'strava' },
  { id: 150, family: 'Ensemble', label: 'Trois à 10 : trois coéquipiers font chacun au moins 10 km de course le même jour (une sortie chacun, tapis exclu)', short: 'Trois à 10', level: 'Moyen', check: 'strava' },
];

/** Position des défis dans une grille (propre à chaque équipe, reproductible) : null = case « ? » pas encore définie. */
export function gridFor(seed: string, defis: BingoDefi[] = DEFIS): (BingoDefi | null | 'center')[] {
  const slots: (BingoDefi | null)[] = [...defis, ...Array(Math.max(0, BINGO_CELLS - 1 - defis.length)).fill(null)].slice(0, BINGO_CELLS - 1);
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const rnd = () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
  for (let i = slots.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [slots[i], slots[j]] = [slots[j], slots[i]]; }
  const out: (BingoDefi | null | 'center')[] = [...slots];
  out.splice(BINGO_CENTER, 0, 'center');
  return out;
}
