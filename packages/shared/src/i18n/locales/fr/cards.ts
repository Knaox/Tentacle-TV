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

  // Notation (fiche mobile, feuille d'appui long).
  rateTitle: "Noter ce titre",
  rateHint: "Touchez une étoile — la moitié gauche vaut une demi-étoile.",
  ratedHint: "Touchez de nouveau votre note pour la retirer.",
  ratingUnavailable: "Ce titre ne peut pas être noté : il n'a pas d'identifiant TMDB.",

  // Survol unifié (`cardOverlay.ts`) : extras du plateau, et feuilles d'actions.
  dismiss: "Ne plus me proposer",
  keepOffline: "Garder hors ligne",
} as const;
