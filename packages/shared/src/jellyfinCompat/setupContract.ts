/**
 * Le contrat de `GET /api/admin/jellyfin/setup` : les réglages de Jellyfin qui
 * rendent Tentacle complet, chacun avec l'état RÉEL du serveur connecté — fait,
 * à faire, en attente d'un redémarrage — et le moyen de le régler : un geste en
 * un clic quand l'API de Jellyfin le permet sans risque, sinon la bonne page
 * de son tableau de bord.
 *
 * MIROIR : recopié octet pour octet dans
 * `apps/backend/src/services/jellyfinCompat/` — voir l'en-tête de
 * `compatManifest.ts`. Aucun import : le fichier compile seul des deux côtés.
 */

export type SetupCheckId =
  | "metadataTmdb"
  | "metadataLanguage"
  | "trailers"
  | "trickplay"
  | "segmentsProvider"
  | "realtimeMonitor"
  | "hardwareAcceleration"
  | "chapterImages";

/** Ce que coûte de s'en passer : un pan de Tentacle, un confort, ou rien de visible. */
export type SetupLevel = "essential" | "recommended" | "optional";

/**
 * `done` : réglé ; `todo` : à faire ; `pending-restart` : fait, mais Jellyfin
 * doit redémarrer pour l'appliquer ; `not-needed` : Tentacle n'en a pas besoin ;
 * `unknown` : Jellyfin n'a pas répondu sur ce point (ou rien à juger : aucune
 * bibliothèque de films ni de séries).
 */
export type SetupState = "done" | "todo" | "pending-restart" | "not-needed" | "unknown";

/** Les gestes en un clic — une liste fermée, qu'aucun corps de requête n'élargit. */
export type SetupActionId =
  | "enableTrickplay"
  | "enableRealtimeMonitor"
  | "setMetadataLanguage"
  | "installChapterSegments"
  | "generateTrickplay"
  | "scanMediaSegments"
  | "refreshMissingMetadata";

/** Une bibliothèque de films, de séries ou mixte, et ce réglage chez elle. */
export interface SetupLibrary {
  id: string;
  name: string;
  enabled: boolean;
}

export type SetupPluginState = "active" | "restart" | "disabled" | "missing";

export interface SetupPlugin {
  name: string;
  state: SetupPluginState;
  /** Publié dans le dépôt OFFICIEL de Jellyfin : s'installe en un clic. */
  official: boolean;
  /** La page du projet, pour un greffon qui s'installe à la main. */
  homepage: string | null;
  /** Le manifeste à ajouter aux dépôts de Jellyfin, pour un greffon tiers. */
  repositoryUrl: string | null;
}

/** Une tâche planifiée de Jellyfin qui fait le travail d'un réglage. */
export interface SetupTask {
  state: "idle" | "running";
  /** 0 à 100, pendant qu'elle tourne. */
  progress: number | null;
  lastRunAt: string | null;
  lastStatus: string | null;
}

/**
 * Les bandes-annonces, mesurées (`trailers`) : Tentacle en tire de trois
 * sources — celles que TMDB donne à Jellyfin (`RemoteTrailers`), les fichiers
 * locaux, et Jellyseerr quand Vigie y est branchée.
 */
export interface SetupTrailers {
  /** Films et séries lus — plafonnés, voir `sampled`. */
  titles: number;
  /** Ceux qui ont un identifiant TMDB : les seuls dont TMDB peut donner une bande-annonce. */
  withTmdb: number;
  /** Ceux qui ont au moins une bande-annonce, distante ou locale. */
  withTrailer: number;
  /** Au-delà du plafond, seuls les premiers titres ont été lus. */
  sampled: boolean;
  /** TMDB écarté — greffon coupé, ou retiré des fournisseurs d'une bibliothèque : la cause première. */
  tmdbBlocked: boolean;
  /** Jellyseerr branché par Vigie : chaque fiche y cherche aussi les vidéos TMDB. */
  jellyseerr: boolean;
  /** Une actualisation de bibliothèque tourne dans Jellyfin. */
  refreshing: boolean;
  /** Ce que la compatibilité de la version installée dit des bonus et bandes-annonces. */
  compatGaps: Array<{ label: { fr: string; en: string }; note: { fr: string; en: string } | null }>;
}

export interface SetupCheck {
  id: SetupCheckId;
  level: SetupLevel;
  state: SetupState;
  /** Pour un réglage par bibliothèque : chacune et son réglage. */
  libraries: SetupLibrary[] | null;
  /** La valeur en place quand il n'y en a qu'une (« fr · FR », « vaapi »). */
  current: string | null;
  /** Titres de films et de séries sans identifiant TMDB (`metadataTmdb`). */
  missingTmdb: number | null;
  plugins: SetupPlugin[] | null;
  task: SetupTask | null;
  trailers: SetupTrailers | null;
  /** Le geste en un clic, quand il existe et qu'il y a quelque chose à faire. */
  action: SetupActionId | null;
  /** La page du tableau de bord de Jellyfin, à partir de sa racine (« /web/#/dashboard/libraries »). */
  dashboardPath: string;
}

/** Pourquoi Jellyfin n'a pas pu être lu. */
export type SetupFailure = "not-configured" | "unreachable" | "rejected" | "invalid";

export interface JellyfinSetupReport {
  checkedAt: string;
  jellyfinVersion: string | null;
  /**
   * La racine du tableau de bord pour le navigateur de l'administrateur :
   * l'adresse publique de Jellyfin si elle est posée, sinon celle que joint
   * le serveur Tentacle.
   */
  dashboardUrl: string | null;
  /** Jellyfin attend un redémarrage (greffon installé, par exemple). */
  restartPending: boolean;
  error: SetupFailure | null;
  checks: SetupCheck[];
}

/** Pourquoi les bandes-annonces manquent, vu d'un client. */
export type TrailerReadinessReason = "tmdb-plugin-disabled" | "tmdb-fetcher-disabled" | "few-trailers";

/**
 * `GET /api/trailers/readiness` — le diagnostic des bandes-annonces résumé
 * pour TOUT compte connecté (pas seulement l'administration) : une fiche sans
 * bande-annonce peut dire « le serveur est mal réglé » sans rien révéler de
 * ses bibliothèques. Gardé dix minutes côté serveur. `unknown` : Jellyfin
 * muet, aucune bibliothèque, lecture ratée — rien à dire.
 */
export interface TrailerReadiness {
  state: "ready" | "misconfigured" | "unknown";
  reasons: TrailerReadinessReason[];
  /** Part des titres connus de TMDB qui ont au moins une bande-annonce (0 à 1) ; `null` : pas mesurée. */
  coverage: number | null;
  checkedAt: string;
}

/** Le corps de `POST /api/admin/jellyfin/setup/apply`. */
export interface SetupApplyRequest {
  action: SetupActionId;
  /** `setMetadataLanguage` : « fr », puis le pays, « FR ». */
  language?: string;
  country?: string;
}
