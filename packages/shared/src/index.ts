export * from "./types/media";
export * from "./types/auth";
export * from "./utils/trickplay";
// Résolution des images de carte (bannière 16:9, affiche 2:3) — une seule
// vérité pour le web ET le téléviseur : tag porté (URL adressée par contenu),
// chaîne de repli, et « la donnée prouve l'absence » → zéro requête.
export * from "./utils/cardImage";
export * from "./utils/cardRating";
export * from "./utils/cardMarkers";
export * from "./utils/cardMarkerGlyphs";
export * from "./utils/cardOverlay";
export * from "./utils/externalCardOverlay";
export * from "./utils/mediaQuality";
export * from "./utils/streamLanguages";
export * from "./utils/mediaVersions";
export * from "./utils/mediaFacts";
// La scène de la fiche : galerie de la vue plein écran et état de reprise.
export * from "./utils/detailStage";
export * from "./utils/qualityLadder";
export * from "./utils/scrubStep";
export * from "./utils/playbackRates";
export * from "./utils/episodeCode";
export * from "./utils/seasonSelection";
export * from "./utils/seasonExtras";
export * from "./utils/textSearch";
// Le moteur de recherche du serveur : le texte plié (index, requête,
// surlignage — une seule forme pour les trois) et le contrat de /api/search.
export * from "./search/searchText";
export * from "./search/searchHighlight";
export * from "./search/searchTypes";
// Ce que disent les résultats (« Série · 2008–2013 », « Avec Tom Hanks ») et
// la recherche hors bibliothèque des plugins, validée champ par champ — une
// seule lecture pour le web et le mobile.
export * from "./search/searchLabels";
export * from "./search/pluginSearch";
export * from "./search/pluginTitles";
export * from "./search/searchSuggestions";
// La page d'une personne : sa fiche Jellyfin et sa filmographie en bibliothèque.
export * from "./person/personProfile";
export * from "./person/filmography";
export * from "./person/castCredits";
// La saga TMDB d'un film : le contrat de /api/sagas (miroir backend), son ordre,
// la rangée de la fiche en logique pure et ses libellés.
export * from "./saga/sagaTypes";
export * from "./saga/sagaModel";
export * from "./saga/sagaLabels";
// La compatibilité Jellyfin : la forme du manifeste que produit la suite de
// tests (compat/jellyfin.json, miroir backend), le verdict d'une version, et les
// contrats de /api/admin/jellyfin/compat et /api/admin/jellyfin/setup.
export * from "./jellyfinCompat/compatManifest";
export * from "./jellyfinCompat/compatVerdict";
export * from "./jellyfinCompat/compatReport";
export * from "./jellyfinCompat/setupContract";
// Le formulaire qu'un plugin déclare pour se brancher (`setup` de son
// manifeste) : rendu par l'administration sans rien savoir du plugin.
export * from "./plugins/pluginSetup";
// L'aide : le guide « Bandes-annonces » (sa structure ; ses mots sont dans
// l'espace i18n `trailerHelp`) et les rappels qu'un compte masque pour de bon
// (contrat de /api/preferences/hints, miroir backend).
export * from "./help/trailerGuide";
export * from "./help/dismissibleHints";
export * from "./types/websocket";
export * from "./types/sessionChannelMessages";
export * from "./types/adminSessionsDto";
// Le tableau de bord des sessions, en logique pure : la sorte de diffusion,
// le retour d'une commande, les mises en forme et le nom de l'application —
// une seule lecture pour le tableau de bord du web et celui du mobile.
export * from "./adminSessions/delivery";
export * from "./adminSessions/commandFeedback";
export * from "./adminSessions/format";
export * from "./adminSessions/sessionApp";
// Les invitations : le contrat de `/api/invites`, ses bornes, le statut et le lien.
export * from "./adminInvites/invites";
export * from "./types/watchTogether";
export * from "./constants";
// Familles de plateformes de streaming (ids TMDB frères, motifs de nom) :
// la source unique des filtres « selon vos abonnements », reflétée dans le
// backend (cf. l'en-tête de platforms.ts).
export * from "./platforms";
export * from "./subtitles/vtt";
export * from "./subtitles/srt";
export * from "./subtitles/sanitize";
export * from "./watchState";
// La décision « faut-il sauter l'intro, et quand » — une machine à états pure,
// partagée par le web, le bureau, l'Apple TV, l'Android TV et la LG.
export * from "./player/introSkip";
// La correction de dérive d'un lecteur en séance Watch Together : un
// contrôleur proportionnel pur, partagé par tous les lecteurs.
export * from "./player/driftController";
// Le contrat des segments de lecture (v1) et son résolveur — UNE implémentation,
// appelée par le backend (via miroir, cf. l'en-tête de segmentTypes.ts) et par
// la lecture locale hors ligne du bureau. Ré-exports NOMMÉS : TICKS_PER_MS y
// reste interne (le nom est déjà exporté par types/watchTogether).
export {
  PLAYBACK_SEGMENTS_VERSION,
  MIN_CREDIBLE_OUTRO_MS,
  POST_CREDITS_MIN_MS,
  POST_CREDITS_THRESHOLD_MS,
  SEGMENT_TYPES,
  emptyPlaybackSegments,
  findSegment,
  isSegmentType,
  parsePlaybackSegmentsResponse,
  type PlaybackSegmentsResponse,
  type ResolvedSegment,
  type SegmentType,
} from "./playback/segmentTypes";
export * from "./playback/segmentChapters";
export * from "./playback/resolveSegments";
export * from "./playback/segmentPlugins";
export * from "./playback/claimGuards";
export * from "./playback/tailVerdict";
export * from "./playback/audioVerdict";
export * from "./playback/playbackSettings";
export * from "./playback/playbackPresets";
export * from "./playback/segmentWindow";
export * from "./playback/skipCandidate";
export * from "./playback/nextTriggers";
export * from "./playback/overlayArbiter";
export * from "./playback/skipMuting";
export * from "./playback/autoNextEngine";
export * from "./playback/playbackSettingsStore";
export * from "./player/deviceSettings";
// Résolution des pistes selon les préférences : même algorithme côté backend
// (en ligne) et côté client (lecteur local hors ligne).
export * from "./preferences";
export * from "./trackChoice";
export * from "./serverConnection";
export { initI18n, detectLanguage, i18n } from "./i18n";
export * from "./data/media-licenses";
export * from "./theme";
export * from "./trailers";
// Les extras d'un titre : genre et titre lisibles, tuiles d'une rangée, cible
// du bouton « Bande-annonce » (la locale d'abord) — toutes plateformes.
export * from "./extras";
// Les statistiques de visionnage : le contrat de /api/stats/me (miroir côté
// backend), ses mises en forme sans Intl (Hermes), la lecture du rythme et le
// profil de spectateur — une seule lecture pour le web et le mobile.
export * from "./types/viewingStats";
export * from "./types/viewingStatsShare";
export * from "./viewingStats/format";
export * from "./viewingStats/habits";
export * from "./viewingStats/insights";
export * from "./viewingStats/badges";
export * from "./viewingStats/timeZone";
export * from "./viewingStats/statsFormatter";
export * from "./viewingStats/compat";
export * from "./viewingStats/titleReasons";
export * from "./viewingStats/publicStats";
