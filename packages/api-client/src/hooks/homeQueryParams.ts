/**
 * Les paramètres communs des requêtes de l'accueil (`useHome.ts`) : champs,
 * images et données utilisateur — sortis du fichier des crochets, qui
 * dépassait les 300 lignes.
 */

// MediaSources est requis pour afficher le badge qualité (4K / HDR / Dolby)
// sur les items du hero. Payload +~5KB par item — acceptable pour un Limit=12.
export const FIELDS = "Overview,Genres,PrimaryImageAspectRatio,MediaSources,ProviderIds";
export const IMAGE_OPTS = "EnableImageTypes=Primary,Backdrop,Thumb&ImageTypeLimit=1";
export const USER_DATA = "EnableUserData=true";

// Champs pour le rendu épisode (image, label SxxExx, navigation). MediaSources
// inclus pour alimenter la méta qualité/langues (CardMetaOverlay au hover sur
// les ajouts récents d'épisodes uniques). Overview/Genres restent exclus.
export const EPISODE_FIELDS = "PrimaryImageAspectRatio,SeriesName,SeriesId,ParentIndexNumber,IndexNumber,MediaSources";
