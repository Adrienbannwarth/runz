export default function Privacy() {
  return (
    <>
      <h1>Confidentialité</h1>
      <div className="card" style={{ lineHeight: 1.6 }}>
        <p style={{ marginTop: 0 }}>
          RunZ est un challenge interne organisé par le CSE de Colorz, à participation volontaire. Cette page explique
          quelles données Strava sont utilisées et comment.
        </p>
        <h2 style={{ marginTop: 8 }}>Données utilisées</h2>
        <ul>
          <li>Ton identifiant Strava, ton prénom et l’initiale de ton nom (pour t’associer à ton équipe).</li>
          <li>Pour chaque activité de la période du challenge : nom, type, date et heure de départ, distance, durée, dénivelé.</li>
          <li>Aucun tracé GPS, aucune position, aucune donnée de santé (fréquence cardiaque, poids…) n’est récupéré.</li>
        </ul>
        <h2>Qui voit quoi</h2>
        <ul>
          <li>Le classement public n’affiche que des totaux et moyennes par équipe.</li>
          <li>Toi seul·e vois le détail de tes activités dans « Mon espace ».</li>
          <li>Les organisateurs du CSE voient les totaux par participant pour valider les bonus et attribuer les prix.</li>
          <li>Les données ne sont ni revendues, ni partagées avec des tiers, ni utilisées pour entraîner un modèle d’IA.</li>
        </ul>
        <h2>Durée et suppression</h2>
        <ul>
          <li>Les données sont supprimées au plus tard 30 jours après la remise des prix.</li>
          <li>Tu peux à tout moment cliquer sur « Retirer l’accès Strava et effacer mes données » dans Mon espace, ou révoquer
            l’application depuis Strava (Paramètres › Mes applications) : tes données Strava sont alors effacées immédiatement.</li>
        </ul>
        <p className="muted small">Contact : CSE Colorz.</p>
      </div>
    </>
  );
}
