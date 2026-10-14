/**
 * Les bandes-annonces — fichiers recopiés tels quels dans le backend
 * (`apps/backend/src/trailers/`, test miroir) : la liste (fusion, langue,
 * type), le contrat de l'aperçu au survol (`/api/trailers/preview`) et celui
 * du catalogue (`/api/trailers/catalog`) avec ses règles.
 */

export * from "./trailerList";
export * from "./trailerPreview";
export * from "./trailerCatalog";
export * from "./trailerCatalogRank";
