/**
 * La page « Ma liste » — bureau, web et mobile.
 *
 * ⚠️ Lue aussi par le mobile : jamais « téléchargement », « télécharger »,
 * « téléchargé » ni « download » ici (cf. l'en-tête de `offline`).
 */
export default {
  // Étapes de visionnage — les pastilles de filtre
  stageFilterLabel: "Filtrer par progression",
  typeFilterLabel: "Filtrer par type",
  stageAll: "Tout",
  stageNew: "À découvrir",
  stageInProgress: "En cours",
  stageWatched: "Terminés",

  // Résumé sous le titre
  statTotal_one: "{{count}} titre",
  statTotal_other: "{{count}} titres",
  statInProgress: "{{count}} en cours",
  statWatched_one: "{{count}} terminé",
  statWatched_other: "{{count}} terminés",

  // La file « Reprendre »
  resumeTitle: "Reprendre",
  resumeHint: "Là où vous vous êtes arrêté",

  // Progression d'un titre
  progressPercent: "{{percent}} % vu",
  remainingMinutes: "Reste {{count}} min",
  remainingHours: "Reste {{hours}} h {{minutes}} min",
  remainingEpisodes_one: "{{count}} épisode restant",
  remainingEpisodes_other: "{{count}} épisodes restants",
  notStarted: "Pas encore commencé",
  finished: "Terminé",

  // Actions
  play: "Lire",
  resume: "Reprendre",
  playTitle: "Lire {{title}}",
  openDetail: "Voir la fiche",
  remove: "Retirer de Ma liste",
  removeTitle: "Retirer {{title}} de Ma liste",
  removed: "{{title}} a quitté Ma liste",
  undo: "Annuler",

  // Affichage
  viewLabel: "Affichage",
  viewGrid: "Grille",
  viewList: "Liste",

  // États
  loading: "Chargement de votre liste",
  emptyBody: "Gardez ici les films et les séries que vous voulez voir. Le signet d'une fiche les y ajoute.",
  emptyExplore: "Explorer l'accueil",
  emptySearch: "Chercher un titre",
  stageEmptyNew: "Vous avez commencé tout ce que contient votre liste.",
  stageEmptyInProgress: "Aucun titre commencé pour l'instant.",
  stageEmptyWatched: "Aucun titre terminé dans votre liste.",
  showAll: "Tout afficher",
} as const;
