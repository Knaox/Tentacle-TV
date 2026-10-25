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
    choose: "Choisissez un profil. La musique reste ouverte.",
    close: "Fermer",
  },
  pinSheet: {
    cancel: "Annuler",
  },
  track: {
    goToAlbum: "Voir l'album",
    goToArtist: "Voir l'artiste",
    openAlbum: "Ouvrir l'album {{album}}",
    openArtist: "Ouvrir l'artiste {{artist}}",
  },
};
