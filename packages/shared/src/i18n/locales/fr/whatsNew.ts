// L'écran des nouveautés (desktop, après une mise à jour). Les textes des
// nouveautés elles-mêmes suivent, une paire de clés par nouveauté :
// v<version>_<id>_title / _body — clés plates, sans point. Les clés `scene*`
// sont les libellés propres aux scènes, quand l'app n'a pas déjà le mot.
export default {
  title: "Nouveautés",
  subtitleVersion: "Version {{version}}",
  subtitleSince: "Depuis la version {{version}}",
  kindNew: "Nouveau",
  kindImproved: "Amélioré",
  kindFixed: "Corrigé",
  previous: "Précédent",
  next: "Suivant",
  done: "Terminé",
  seeInApp: "Voir dans l'app",
  featureListLabel: "Liste des nouveautés",
  progress: "{{index}} sur {{total}}",

  // Libellés de scènes
  sceneBandwidth: "Débit mesuré",
  sceneResume: "Reprendre à 42:10",
  sceneTicketSubtitles: "Sous-titres décalés",
  sceneTicketAudio: "Son coupé après 20 min",
  sceneTicketPoster: "Affiche manquante",
  sceneTicketLogin: "Connexion impossible",
  sceneLogoIcon: "Icône",
  sceneLogoSplash: "Splash",
  sceneLogoFavicon: "Favicon",
  sceneLogoAccent: "Rose d'accent",

  // 1.21.0
  v1_21_0_reco_title: "Des recommandations à votre goût",
  v1_21_0_reco_body: "Vos vus, vos favoris et vos notes construisent votre profil. La page Recommandations et l'accueil vous servent des rangées « Pour vous », « À découvrir » et « Parce que vous avez aimé… ».",
  v1_21_0_rate_title: "Notez partout, d'un survol",
  v1_21_0_rate_body: "Des étoiles apparaissent sur chaque affiche, sur la fiche et à la fin d'un épisode. Une note validée fait jaillir des confettis et affine aussitôt vos recommandations.",
  v1_21_0_platforms_title: "Filtrez selon vos abonnements",
  v1_21_0_platforms_body: "Choisissez vos plateformes : seuls les titres disponibles chez elles restent. Le filtre suit votre compte d'un appareil à l'autre, et en changer est instantané.",
  v1_21_0_home_title: "Un accueil qui vous ressemble",
  v1_21_0_home_body: "Dans Réglages → Personnalisation, choisissez et ordonnez les rangées, le bandeau principal et l'équilibre entre valeurs sûres et découvertes.",
  v1_21_0_autoQuality_title: "La qualité Auto suit votre réseau",
  v1_21_0_autoQuality_body: "L'app mesure le débit réel vers votre serveur. Si la connexion ne suit pas, un palier adapté prend le relais — votre choix manuel prime toujours.",
  v1_21_0_playReco_title: "Lancez la lecture depuis une carte",
  v1_21_0_playReco_body: "Au survol d'un titre présent en bibliothèque, un bouton Lecture reprend là où vous en étiez, avec la qualité et les langues de ce qui va être lu.",
  v1_21_0_tickets_title: "Vos tickets sur un tableau",
  v1_21_0_tickets_body: "Une colonne par statut, la fiche en volet latéral, et un clic sur une notification ouvre directement le ticket. L'admin déplace les cartes d'un geste.",
  v1_21_0_logo_title: "« L'Étreinte », le nouveau logo",
  v1_21_0_logo_body: "Le poulpe enlace désormais l'écran : mascotte, splash, icône et favicon suivent, et le rose d'accent entre dans la palette.",
} as const;
