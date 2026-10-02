/**
 * Cartes média : marqueurs d'état et actions révélées au survol.
 *
 * Lu par TOUTES les plateformes, mobile compris : aucun mot de la famille
 * « téléchargement » ici (règle de revue Apple, cf. `offline.ts`).
 */
export default {
  // Libellés accessibles des marqueurs (cf. `cardMarkerLabelParts`).
  communityRating: "Note globale {{score}} sur 10",
  userRating: "Votre note {{score}} sur 10",
  status: {
    watchlist: "Dans ma liste",
    favorite: "Dans les favoris",
    watched: "Déjà vu",
    // « Sur cet appareil » (bureau, mobile) : le titre gardé, ou des épisodes d'une série.
    onDevice: "Sur cet appareil",
    onDeviceSome: "Des épisodes sur cet appareil",
  },

  // Actions de la carte.
  play: "Lire",
  resume: "Reprendre",
  moreInfo: "Plus d'infos",
  addToWatchlist: "Ajouter à ma liste",
  removeFromWatchlist: "Retirer de ma liste",
  addToFavorites: "Ajouter aux favoris",
  removeFromFavorites: "Retirer des favoris",
  markWatched: "Marquer comme vu",
  markUnwatched: "Marquer comme non vu",
  // Le « ⋯ » d'une ligne tactile : la feuille des actions de la carte.
  moreActions: "Plus d'actions",
  // La télécommande : sur une carte horizontale (où OK lit), maintenir OK
  // ouvre la feuille d'actions — l'indication du focus (Apple TV).
  holdForOptions: "Maintenir OK : plus d'options",

  // Notation (fiche mobile, feuille d'appui long).
  rateTitle: "Noter ce titre",
  rateHint: "Touchez une étoile — la moitié gauche vaut une demi-étoile.",
  ratedHint: "Touchez de nouveau votre note pour la retirer.",
  ratingUnavailable: "Ce titre ne peut pas être noté : il n'a pas d'identifiant TMDB.",
  // L'échelle horizontale de la télécommande (grand panneau de l'appui maintenu, « Noter » de la fiche).
  currentRating: "Votre note actuelle",
  notRatedYet: "Pas encore noté",
  removeRating: "Retirer la note",
  ratingRulerHint: "choisir · OK : noter",

  // Survol unifié (`cardOverlay.ts`) : extras du plateau, et feuilles d'actions.
  dismiss: "Ne plus me proposer",
  keepOffline: "Garder hors ligne",

  // Cartes hors bibliothèque (`externalCardOverlay.ts`) : Ma liste et le cœur
  // à l'arrivée, et ce qu'on dit quand l'extension de demandes ne suit pas.
  addToWatchlistOnArrival: "Ajouter à ma liste dès son arrivée",
  removeFromWatchlistOnArrival: "Ne plus l'ajouter à son arrivée",
  watchlistOnArrival: "Dans ma liste dès son arrivée",
  addToFavoritesOnArrival: "Ajouter aux favoris dès son arrivée",
  removeFromFavoritesOnArrival: "Ne plus l'ajouter aux favoris à son arrivée",
  favoritesOnArrival: "Dans les favoris dès son arrivée",
  requestSent: "Demande envoyée.",
  requestFailed: "La demande n'a pas abouti.",
  watchlistAdded: "Ajouté à ma liste.",
  watchlistOnArrivalAdded: "Il entrera dans ma liste dès son arrivée.",
  watchlistFailed: "Ma liste n'a pas pu être modifiée.",
  favoriteAdded: "Ajouté aux favoris.",
  favoriteOnArrivalAdded: "Aimé — il entrera dans vos favoris dès son arrivée.",
  favoriteFailed: "Les favoris n'ont pas pu être modifiés.",

  // Un titre ABSENT de la bibliothèque (téléviseurs : la saga d'un film) —
  // son badge, et ce qu'on dit quand on l'ouvre.
  notInLibrary: "Pas dans la bibliothèque",
  notInLibraryNotice: "Ce titre n'est pas disponible dans votre bibliothèque.",

  // Ce qu'une carte REGROUPÉE des « Derniers ajouts » apporte de neuf — la
  // ligne discrète de sa légende (`latestAdditionsLine`). Espace insécable
  // entre le nombre et son nom : sur une carte étroite, la ligne passe à la
  // suivante AVANT le compte, jamais au milieu (« Nouvelle saison · » / « 8 épisodes »).
  newEpisodes_one: "{{count}}\u00A0nouvel épisode",
  newEpisodes_other: "{{count}}\u00A0nouveaux épisodes",
  newSeasons_one: "Nouvelle saison",
  newSeasons_other: "{{count}}\u00A0nouvelles saisons",
  newSeries: "Nouvelle série",
  // Le compte des épisodes du groupe, toujours dit : « Nouvelle saison · 8 épisodes ».
  episodeCount_one: "{{count}}\u00A0épisode",
  episodeCount_other: "{{count}}\u00A0épisodes",
} as const;
