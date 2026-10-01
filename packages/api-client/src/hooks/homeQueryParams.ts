/**
 * Les paramètres communs des requêtes de l'accueil (`useHome.ts`) : champs,
 * images et données utilisateur — sortis du fichier des crochets, qui
 * dépassait les 300 lignes.
 */

// MediaSources est requis pour afficher le badge qualité (4K / HDR / Dolby)
// sur les items du hero. Payload +~5KB par item — acceptable pour un Limit=12.
export const FIELDS = "Overview,Genres,PrimaryImageAspectRatio,MediaSources,ProviderIds";
export const IMAGE_OPTS = "EnableImageTypes=Primary,Backdrop,Thumb&ImageTypeLimit=1";
// Les deux sources de la bannière (reprise, mis en avant) demandent AUSSI les
// logos : Jellyfin n'annonce un logo — le sien, ou celui de la série d'un
// épisode (`ParentLogoItemId`) — que si la requête les demande. Sans eux, la
// bannière demandait le logo d'une série à l'aveugle (404, image cassée).
// Quelques dizaines d'octets par titre.
export const HERO_IMAGE_OPTS = "EnableImageTypes=Primary,Backdrop,Thumb,Logo&ImageTypeLimit=1";
export const USER_DATA = "EnableUserData=true";

// Champs pour le rendu épisode (image, label SxxExx, navigation). MediaSources
// inclus pour alimenter la méta qualité/langues (CardMetaOverlay au hover sur
// les ajouts récents d'épisodes uniques). Overview/Genres restent exclus.
export const EPISODE_FIELDS = "PrimaryImageAspectRatio,SeriesName,SeriesId,ParentIndexNumber,IndexNumber,MediaSources";
