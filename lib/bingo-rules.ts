// BingoZ (saison 2) : le manuel du jeu, affiché dans la modale « Les règles du jeu » de /bingoz.
// À compléter quand les derniers points seront tranchés (dates, quota par personne).

export type RuleSection = { icon: string; title: string; items: string[] };

export const BINGO_RULES: RuleSection[] = [
  { icon: '🎯', title: 'Le but', items: [
    'Chaque équipe a sa grille de 7 × 7 cases : 48 défis sportifs et un défi imposé au centre.',
    'Une ligne, une colonne ou une diagonale complète rapporte des points. La grille entière, c’est le carton plein.',
    'Tous les défis sont connus dès le premier jour : tu t’organises comme tu veux.',
  ] },
  { icon: '📅', title: 'Le calendrier', items: [
    'La saison dure un mois : {dates}.',
    'Une seule case par jour et par personne : inutile de tout faire le même week-end.',
  ] },
  { icon: '🤝', title: 'Jouer en équipe', items: [
    'Une même personne ne peut pas valider plus d’un quart de la grille (12 cases) : toute l’équipe doit jouer.',
    'Certaines cases ×2 doivent être réussies par deux personnes différentes de l’équipe.',
    'Au centre, le défi imposé est écrit par une autre équipe.',
  ] },
  { icon: '✅', title: 'Valider une case', items: [
    'Enregistre ta sortie sur Strava : le site coche la case tout seul, en choisissant celle qui t’aide le plus (une ligne à finir d’abord).',
    'Une activité ne coche qu’une case.',
    'Défis photo : mets ta photo sur l’activité Strava et #BINGOZ dans le titre. Un admin valide, comme pour les tracés et l’Hyrox.',
  ] },
  { icon: '🏆', title: 'Les points', items: [
    'Une ligne complète : 1 point.',
    'Première ligne de toute la boîte : +1 point.',
    'Défi imposé réussi : +1 point.',
    'Carton plein : +5 points, et la partie s’arrête pour tout le monde.',
    'Le MVP est choisi par l’organisation.',
  ] },
  { icon: '🛡️', title: 'Fair-play', items: [
    'Seules les vraies activités Strava comptent : pas de saisie manuelle, pas d’activité fusionnée ou découpée.',
    'Les chiffres de Strava font foi (distance, dénivelé, temps en mouvement) et l’heure de départ décide du jour.',
    '« Ensemble » veut dire parti à moins de 10 min et 300 m l’un de l’autre.',
    'En cas de doute, les admins ont le dernier mot.',
  ] },
];
