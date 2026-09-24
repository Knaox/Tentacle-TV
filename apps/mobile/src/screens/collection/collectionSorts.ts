/**
 * Les quatre tris de Ma liste et de Mes favoris, ceux du bureau — partagés par
 * la barre (pastille du tri actif) et la feuille « Trier et filtrer ».
 */
export const COLLECTION_SORTS = [
  { key: "sortDateDesc", sortBy: "DateCreated", sortOrder: "Descending" },
  { key: "sortTitleAsc", sortBy: "SortName", sortOrder: "Ascending" },
  { key: "sortYearDesc", sortBy: "ProductionYear", sortOrder: "Descending" },
  { key: "sortRatingDesc", sortBy: "CommunityRating", sortOrder: "Descending" },
] as const;

export const DEFAULT_COLLECTION_SORT = COLLECTION_SORTS[0];
