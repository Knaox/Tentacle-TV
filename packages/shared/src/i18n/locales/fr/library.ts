/**
 * Les pages Bibliothèque — la barre d'outils (recherche, tri, filtres), le
 * compte de titres et les états vides ou de chargement. Web, bureau, miroir
 * mobile du web et app mobile.
 *
 * Mobile : aucun mot de la famille « téléchargement » ici — ces écrans sont
 * ouverts par les relecteurs d'Apple (cf. CLAUDE.md).
 */
export default {
  toolbar: "Recherche, tri et filtres",
  titles_one: "{{count}} titre",
  titles_other: "{{count}} titres",
  sortedBy: "Trié par {{sort}}",
  reverseOrder: "Inverser l'ordre",
  orderAscending: "Ordre croissant — inverser",
  orderDescending: "Ordre décroissant — inverser",
  watchStatus: "Visionnage",
  activeFilters: "Filtres actifs",
  removeFilter: "Retirer le filtre {{name}}",
  loading: "Chargement du catalogue…",
  emptyTitle: "Cette bibliothèque est vide",
  emptyHint: "Aucun titre n'y a encore été ajouté sur le serveur.",
  emptyFilteredTitle: "Aucun titre ne correspond",
  emptyFilteredHint: "Élargissez les filtres ou retirez-en un pour retrouver des titres.",
  noLibraries: "Aucune bibliothèque",
  noLibrariesHint: "Ce serveur ne partage encore aucune bibliothèque de films ou de séries avec ce compte.",
  sortShort: "Tri",
  filtersShort: "Filtres",
  // Refonte TV — la barre de filtres et ses grandes listes en surimpression.
  clearAll: "Tout effacer",
  selected_one: "{{count}} sélectionné",
  selected_other: "{{count}} sélectionnés",
  multipleChoice: "Plusieurs choix possibles",
  decades: "Décennies",
  ratingAndUp: "et plus",
  sortCriterion: "Critère",
  // Ma liste et Favoris sur TV : le type, et le tri par ARRIVÉE dans la
  // bibliothèque (aucune date d'ajout à la liste n'existe).
  contentType: "Type",
  sortArrival: "Arrivée en bibliothèque",
  sortArrivalDesc: "Derniers arrivés",
  sortArrivalAsc: "Premiers arrivés",
  // La carte qui s'ouvre (TV) : une collection rangée en rangées.
  groupBy: "Ranger par",
  group_genre: "Genre",
  group_year: "Année",
  group_alpha: "A → Z",
  group_rating: "Note",
  group_type: "Type",
  groupOtherGenres: "Autres genres",
  groupDecade: "Années {{decade}}",
  groupBefore: "Avant {{year}}",
  groupRatingAtLeast: "{{min}} et plus",
  groupRatingBetween: "De {{min}} à {{max}}",
  groupRatingBelow: "Moins de {{max}}",
  groupNoRating: "Sans note",
  groupType_movies: "Films",
  groupType_series: "Séries",
  groupType_anime: "Animés",
} as const;
