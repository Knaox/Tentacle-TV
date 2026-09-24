/**
 * Les huit tris d'un catalogue de bibliothèque — des chaînes de tri SERVEUR
 * (Jellyfin), par paires croissant / décroissant. Lus par la requête et par la
 * feuille « Trier et filtrer ».
 */
export const SORT_OPTIONS = [
  { labelKey: "sortDateDesc", sortBy: "DateCreated", sortOrder: "Descending" },
  { labelKey: "sortDateAsc", sortBy: "DateCreated", sortOrder: "Ascending" },
  { labelKey: "sortTitleAsc", sortBy: "SortName", sortOrder: "Ascending" },
  { labelKey: "sortTitleDesc", sortBy: "SortName", sortOrder: "Descending" },
  { labelKey: "sortYearDesc", sortBy: "ProductionYear,SortName", sortOrder: "Descending" },
  { labelKey: "sortYearAsc", sortBy: "ProductionYear,SortName", sortOrder: "Ascending" },
  { labelKey: "sortRatingDesc", sortBy: "CommunityRating,SortName", sortOrder: "Descending" },
  { labelKey: "sortRatingAsc", sortBy: "CommunityRating,SortName", sortOrder: "Ascending" },
] as const;
