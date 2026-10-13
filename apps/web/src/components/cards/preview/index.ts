/**
 * La mini-carte d'aperçu de bande-annonce — SEULE porte d'entrée des cartes.
 *
 * Les cartes n'importent que d'ici : le client des téléviseurs LG substitue
 * ce fichier (`apps/tv-webos/config/substitutionTable.ts`) et ne compile
 * jamais le reste du dossier — ni la mini-carte, ni sa feuille.
 */
export { useCardPreview } from "./useCardPreview";
export type { CardPreviewController, CardPreviewOptions, CardPreviewSource } from "./useCardPreview";
export { CardPreview } from "./CardPreview";
