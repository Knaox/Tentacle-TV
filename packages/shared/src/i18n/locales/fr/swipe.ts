/**
 * Onglet « Affiner » : une pile de films et séries à juger d'un geste.
 * Lu par le web, le bureau et le mobile — aucun mot de la famille de
 * « téléchargement » ici (règle du mobile, cf. offline.ts).
 */
export default {
  title: "Affiner",
  subtitle: "Jugez des films et des séries : vos recommandations apprennent de chaque geste.",

  like: "J'aime",
  superlike: "Coup de cœur",
  dislike: "Pas pour moi",
  skip: "Passer",
  undo: "Annuler le dernier geste",
  undoShort: "Annuler",
  showInfo: "Voir le synopsis",
  hideInfo: "Revenir à l'affiche",

  stampLike: "J'aime",
  stampSuper: "Coup de cœur",
  stampNope: "Non merci",
  stampSkip: "Passer",

  movie: "Film",
  series: "Série",
  seasons_one: "{{count}} saison",
  seasons_other: "{{count}} saisons",
  runtime: "{{minutes}} min",
  inLibrary: "Dans votre bibliothèque",
  notInLibrary: "Hors bibliothèque",
  reason: "Parce que vous avez aimé {{title}}",
  sourcePopular: "Tendance",
  sourceExplore: "Découverte",
  noOverview: "Pas de synopsis pour ce titre.",
  cardLabel: "{{title}} ({{year}})",

  countsLabel: "Vos jugements",
  countLike_one: "{{count}} j'aime",
  countLike_other: "{{count}} j'aime",
  countSuper_one: "{{count}} coup de cœur",
  countSuper_other: "{{count}} coups de cœur",
  countDislike_one: "{{count}} refus",
  countDislike_other: "{{count}} refus",

  libraryOnlyTitle: "Votre bibliothèque seulement",
  libraryOnlyBody:
    "Aucune clé TMDB n'est configurée sur ce serveur : la pile ne propose que des titres de votre bibliothèque. Un administrateur peut en ajouter une dans Administration › Métadonnées.",

  libraryOnlyShort: "Aucune clé TMDB sur ce serveur : titres de votre bibliothèque uniquement.",

  emptyTitle: "Vous avez tout passé en revue",
  emptyBody: "Plus aucun titre à juger pour l'instant. Revenez plus tard : la pile se renouvelle.",
  emptyCta: "Voir mes recommandations",
  errorTitle: "Impossible de charger la pile",
  retry: "Réessayer",
  saveFailed: "Ce jugement n'a pas été enregistré — la carte est revenue en haut de la pile.",
  undone: "Dernier geste annulé",

  hint: "Glissez : à droite j'aime, à gauche non merci, en haut coup de cœur, en bas passer.",
  shortcutsLabel: "Raccourcis clavier",
  keyLeft: "Pas pour moi",
  keyRight: "J'aime",
  keyUp: "Coup de cœur",
  keyDown: "Passer",
  keyUndo: "Annuler",
  keyInfo: "Synopsis",
  keySpace: "Espace",

  // La pile vit DANS la page Recommandations : deux sections, un segment.
  sectionsLabel: "Sections des recommandations",
  sectionForYou: "Pour vous",
  sectionRefine: "Affiner",
  teaserTitle: "Affinez vos recommandations",
  teaserBody: "Quelques titres à juger d'un geste : chaque verdict affine ce qui vous est proposé ici.",
  teaserCta: "Commencer",
};
