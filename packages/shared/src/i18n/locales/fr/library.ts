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
  sortShort: "Tri",
  filtersShort: "Filtres",
} as const;
