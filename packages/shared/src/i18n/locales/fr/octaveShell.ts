/**
 * Octave — la coquille du mode musique : la signature de Tentacle, le retour
 * aux films, le repère de la première fois, le menu du profil et sa feuille de
 * code PIN. Mêmes consignes que `music` : aucune source hors bibliothèque
 * nommée, jamais le mot « téléchargement ».
 */
export default {
  signature: {
    of: "Tentacle",
    label: "Octave, le mode musique de Tentacle",
  },
  backToFilms: {
    label: "Films et séries",
    hint: "Quitter le mode musique et revenir aux films et séries de Tentacle",
  },
  firstVisit: {
    title: "Octave, le mode musique de Tentacle",
    body: "Pour revenir aux films et séries, c'est ici.",
    dismiss: "Compris",
  },
  profile: {
    button: "Profil {{name}}",
    menu: "Profil",
    current: "Profil actuel",
    guest: "Profil invité",
    switch: "Changer de profil",
    manage: "Gérer les profils",
    whoListens: "Qui écoute ?",
    choose: "Choisissez un profil. Vous restez dans Octave.",
    close: "Fermer",
  },
  pinSheet: {
    cancel: "Annuler",
  },
  appearance: {
    title: "Octave",
    caption: "Le mode musique a sa propre apparence, sur cet appareil.",
    theme: "Apparence d'Octave",
    themeSame: "Comme Tentacle",
    themeLight: "Clair",
    themeDark: "Sombre",
    glass: "Liquid Glass dans Octave",
    tentacleGlass: "Liquid Glass dans Tentacle",
  },
  settings: {
    kicker: "Octave",
    title: "Réglages d'Octave",
    appearance: "Apparence",
    startup: "Démarrage",
    nav: "Réglages",
    shortcut: "Réglages d'Octave…",
    open: "Ouvrir les réglages d'Octave",
  },
  artistMore: {
    elsewhere: "Pas encore dans votre bibliothèque",
    library: "Aussi dans votre bibliothèque",
  },
  track: {
    goToArtistNamed: "Voir {{artist}}",
  },
};
