export * from "./types/media";
export * from "./types/auth";
export * from "./utils/trickplay";
// Résolution des images de carte (bannière 16:9, affiche 2:3) — une seule
// vérité pour le web ET le téléviseur : tag porté (URL adressée par contenu),
// chaîne de repli, et « la donnée prouve l'absence » → zéro requête.
export * from "./utils/cardImage";
// Le logo d'une œuvre — le sien, sinon celui de sa série — seulement s'il est annoncé.
export * from "./utils/logoImage";
export * from "./hero";
// L'accueil d'un compte sans aucun titre : l'état vide au lieu d'un écran noir.
export * from "./home";
export * from "./utils/cardRating";
export * from "./utils/cardMarkers";
export * from "./utils/cardMarkerGlyphs";
export * from "./utils/cardOverlay";
// Les arrivées dans une rangée : clés stables par titre, ce qui entre et ce qui glisse.
export * from "./utils/rowArrivals";
export * from "./utils/externalCardOverlay";
export * from "./utils/mediaQuality";
// Les badges de qualité d'un titre (4K, Dolby Vision, Dolby Atmos) — Apple TV.
export * from "./utils/qualityBadges";
export * from "./utils/streamLanguages";
export * from "./utils/mediaVersions";
export * from "./utils/mediaFacts";
// La scène de la fiche : galerie de la vue plein écran et état de reprise.
export * from "./utils/detailStage";
export * from "./utils/qualityLadder";
export * from "./utils/transcodeTarget";
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
export * from "./search/pluginTitlesMine";
export * from "./search/pluginTitleOrigin";
export * from "./search/pluginTitleSeasons";
export * from "./search/pluginTitleGaps";
export * from "./search/seasonPick";
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
// Les « Derniers ajouts » regroupés par série au serveur : ce que la carte de
// la série apporte de neuf (miroir backend).
export * from "./latestAdditions/latestAdditionsTypes";
export * from "./utils/latestAdditions";
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
// l'espace i18n `trailerHelp`), les rappels qu'un compte masque pour de bon
// (contrat de /api/preferences/hints, miroir backend) et la règle du rappel
// des fiches, lue sur le diagnostic du serveur.
export * from "./help/trailerGuide";
export * from "./help/dismissibleHints";
// Les capacités du serveur : la liste fermée de ce qu'un serveur sait faire,
// déclarée par `/api/config` (miroir backend) — un client ne montre rien d'autre.
export * from "./serverCapabilities/serverCapabilities";
export * from "./help/trailerHint";
export * from "./tickets/messageLanguage";
// Les avertissements surgissants des clients : leur politique (gravité,
// public, effacement seul, « Ne plus afficher » du compte, un seul à la fois)
// et la règle « serveur à mettre à jour » — masquée jusqu'à la prochaine
// exigence plus haute, lue aussi par le tableau de bord.
export * from "./notices/noticePolicy";
export * from "./notices/serverUpdateNotice";
export * from "./notices/adminKeyHealth";
// « Qualité réduite » sur le lecteur : pourquoi la qualité baisse en Auto (le
// réseau mesuré, la limite Internet de Jellyfin, la conversion du serveur), et
// quand le dire — une info éphémère, masquable par le compte.
export * from "./player/qualityDrop";
export * from "./player/jellyfinOutageCopy";
export * from "./connectivity/connectivityCase";
export * from "./databaseMigration/databaseMigrationView";
export * from "./databaseMigration/currentStacks";
export * from "./player/jellyfinReturn";
export * from "./notices/qualityDropNotice";
// Le saut pendant un transcodage : les sauts rapides regroupés en un seul
// redémarrage, l'attente dite (indicateur, phrase, modèle d'erreur au délai).
export * from "./player/transcodeSeek";
export * from "./player/sourceSwitch";
// Le modèle commun des messages d'erreur : une cause en mots de spectateur
// (quoi, pourquoi, une à trois actions, détails repliés), classée d'un échec
// brut — une seule source pour le web, le bureau, le mobile et la tablette.
export * from "./problems/problemTypes";
export * from "./problems/describeProblem";
export * from "./problems/classifyProblem";
export * from "./problems/problemDetails";
export * from "./problems/engineErrors";
export * from "./problems/diagnose";
export * from "./problems/fromError";
export * from "./problems/playbackDiagnosis";
// Les liens du serveur : le lien public et la lecture directe, sondés par le
// serveur (contrat de /api/admin/server-links, miroir backend), et leur
// verdict — lu par la vue d'ensemble et par l'assistant d'installation.
export * from "./serverLinks/serverLinksContract";
export * from "./serverLinks/serverLinksVerdict";
// L'assistant d'installation du serveur : le contrat de /api/setup/* (miroir
// backend), codes d'erreur traduits par l'espace i18n `setupWizard`.
export * from "./setupWizard/setupWizardContract";
export * from "./setupWizard/setupDiscoveryContract";
export * from "./setupWizard/setupFlowContract";
export * from "./setupWizard/setupLibraryContract";
export * from "./setupWizard/appLinks";
export * from "./setupWizard/setupDocLinks";
export * from "./setupWizard/setupHelp";
// L'accès à distance : protocole du service de test (miroir backend et
// apps/port-check), contrat des réglages (miroir backend), plan des ports,
// verdict du test et extraits de mandataire. Mots : espace i18n `remoteAccess`.
export * from "./remoteAccess/checkProtocol";
export * from "./remoteAccess/remoteAccessContract";
export * from "./remoteAccess/portPlan";
export * from "./remoteAccess/exposurePlan";
export * from "./remoteAccess/remoteVerdict";
export * from "./remoteAccess/proxySnippets";
export * from "./remoteAccess/routerGuides";
export * from "./help/remoteAccessGuide";
// L'adresse du serveur transmise à une TV au jumelage : l'annoncée, sinon celle
// du client — jamais de lien public exigé.
export * from "./pairing/pairingServerUrl";
// La mise à jour du serveur Tentacle : le contrat de /api/admin/server-update
// (miroir backend), ce que la carte du tableau de bord en dit (à jour,
// conseillée, obligatoire) et la commande à copier — sans jamais parler à Docker.
export * from "./serverUpdate/serverUpdateContract";
export * from "./serverUpdate/serverUpdateStatus";
export * from "./serverUpdate/updateCommands";
// Le tableau de bord d'administration : ce qui est À RÉGLER (bloquant, jamais
// masquable) et les RECOMMANDATIONS (masquables par compte), en logique pure.
export * from "./adminAttention/attentionModel";
export * from "./adminAttention/jellyfinAdvice";
// La détection des passages installée par Tentacle (contrat recopié dans le backend).
export * from "./segmentPlugins/segmentPluginsContract";
// La Famille : le contrat (réponses, corps, codes d'erreur, temps réel,
// notifications), la table des routes et de leurs appelants, les règles
// pures (PIN, capacité, invitations, candidats) — miroirs backend — et la
// lecture d'un refus par les clients.
export * from "./family/familyContract";
export * from "./family/familyTvContract";
export * from "./family/familyProtocol";
export * from "./family/familyRoutes";
export * from "./family/familyRules";
export * from "./family/familyRights";
export * from "./family/familyLabels";
export * from "./family/familyClient";
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
export * from "./adminSessions/nowPlaying";
export * from "./adminSessions/explain";
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
// L'étiquette HEVC qu'AVFoundation lit telle quelle (`hvc1`, `dvh1`) : une
// règle pour l'Apple TV, le lecteur système de l'iPhone et de l'iPad, et Safari.
export * from "./playback/hevcTag";
export * from "./playback/engineCapabilities";
export * from "./playback/streamPlan";
export * from "./playback/engineProfiles";
export * from "./playback/deviceMediaProfile";
export * from "./playback/simulatedDeviceProfiles";
export * from "./playback/deviceEngines";
export * from "./playback/deviceVideoSupport";
export * from "./playback/devicePlaybackVerdict";
export * from "./playback/litePlayback";
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
export * from "./player/contentFrameRate";
export * from "./player/displayModeChoice";
// Résolution des pistes selon les préférences : même algorithme côté backend
// (en ligne) et côté client (lecteur local hors ligne).
export * from "./preferences";
export * from "./trackChoice";
export * from "./serverConnection";
export { initI18n, detectLanguage, uiLanguage, i18n } from "./i18n";
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
