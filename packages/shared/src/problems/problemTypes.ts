/**
 * Le modèle commun des messages d'erreur — UNE source pour le web, le bureau,
 * le mobile et la tablette ; chaque plateforme ne fait que le rendre.
 *
 * Une erreur se dit en trois temps, comme sur l'Apple TV :
 * - QUOI : ce qui n'a pas marché, du point de vue de celui qui regarde
 *   (« La lecture n'a pas pu démarrer ») — le CONTEXTE ;
 * - POURQUOI : la CAUSE, en mots de spectateur (« Le serveur Tentacle ne
 *   répond pas »), et une phrase d'aide (« Il redémarre peut-être… ») ;
 * - QUOI FAIRE : une à trois actions, la première étant la principale.
 * Les détails techniques (code HTTP, moteur, codec, message brut) sont
 * repliés sous « Détails », avec « Copier » : jamais un code nu à la place
 * du message.
 */

/** Ce qui n'a pas marché — le titre du message. */
export type ProblemContext =
  | "playbackStart"
  | "playbackStopped"
  | "offlinePlayback"
  | "page"
  | "connect"
  | "signIn"
  | "pairing"
  | "action"
  | "extension"
  | "watchTogether"
  // ── Ajouts du mobile (20/10) ──
  /** Un transfert pour garder un titre hors ligne. */
  | "offlineTransfer"
  /** Les notifications de l'app. */
  | "notifications"
  /** La diffusion vers une TV (Cast, AirPlay). */
  | "cast"
  /** L'image dans l'image. */
  | "pictureInPicture"
  /** La session de profil (Famille) de cet appareil. */
  | "profile"
  /** Un écran qui a planté en se dessinant (limite d'erreur). */
  | "screen";

/** Pourquoi — une cause, une phrase de spectateur. */
export type ProblemCause =
  // Joindre le serveur
  | "deviceOffline"
  | "serverUnreachable"
  | "serverTimeout"
  | "certificate"
  | "insecureBlocked"
  | "notTentacle"
  | "serverError"
  | "serverTooOld"
  | "jellyfinUnreachable"
  | "jellyfinError"
  // Le compte
  | "sessionExpired"
  | "notAllowed"
  /** La politique Jellyfin du compte interdit la lecture (`EnableMediaPlayback`, 403 `playback_not_allowed`). */
  | "playbackNotAllowed"
  // Le titre et sa lecture
  | "itemNotFound"
  | "fileMissing"
  | "noCompatibleStream"
  | "transcodeNotAllowed"
  | "transcodeFailed"
  | "subtitleBurnFailed"
  | "tooManyStreams"
  | "connectionLost"
  | "bandwidthTooLow"
  | "startTimeout"
  /** Après un saut pendant une conversion, la vidéo ne revient pas (`player/transcodeSeek.ts`). */
  | "seekTimeout"
  | "decodeFailed"
  | "engineFailed"
  | "offlineFileMissing"
  | "offlineFileDamaged"
  | "offlineMode"
  // Le reste
  | "extensionMissing"
  // ── Ajouts du mobile (20/10) — catalogue : `problemCatalogMore.ts` ──
  // La connexion au compte
  | "wrongCredentials"
  | "accountDisabled"
  | "accountLockedOut"
  | "accountOutsideSchedule"
  | "accountMaxSessions"
  | "tooManyAttempts"
  | "databaseMigrating"
  // Famille et droits
  | "profileSessionExpired"
  | "parentalBlocked"
  // Watch Together
  | "wtJoinFailed"
  | "wtMemberLeft"
  | "wtMemberDisconnected"
  | "wtRoomClosed"
  | "wtRemoved"
  | "wtInviteExpired"
  | "wtAccessRevoked"
  | "wtAlreadyInGroup"
  | "wtHostOnly"
  | "wtTitleUnavailable"
  | "wtDesync"
  // Hors ligne
  | "transferFailed"
  | "storageFull"
  | "wifiRequired"
  | "transferSourceGone"
  | "offlineRightsRevoked"
  // Notifications
  | "pushDenied"
  | "pushUnavailable"
  // Diffusion, image dans l'image
  | "castFailed"
  | "castLost"
  | "castFormatUnsupported"
  | "pipUnavailable"
  // Un écran qui plante
  | "renderCrash"
  | "unknown";

/** Quoi faire. */
export type ProblemActionKey =
  | "retry"
  | "lowerQuality"
  | "otherVersion"
  | "withoutSubtitles"
  | "playOnline"
  | "offlineLibrary"
  | "goOnline"
  | "signIn"
  | "editAddress"
  | "back"
  // ── Ajouts du mobile (20/10) ──
  /** Les réglages du SYSTÈME (notifications, réseau). */
  | "openSettings"
  /** Les titres gardés hors ligne, pour faire de la place ou relancer. */
  | "manageOffline"
  /** Rejoindre de nouveau la séance Watch Together. */
  | "rejoin"
  /** Changer de profil (« Qui regarde ? »). */
  | "switchProfile"
  /** Lire sur cet appareil (la diffusion s'est arrêtée). */
  | "playHere"
  /** Fermer un message qui ne demande rien. */
  | "dismiss";

/** L'icône du message, dans un vocabulaire commun que chaque plateforme dessine. */
export type ProblemIcon =
  | "wifiOff"
  | "server"
  | "shield"
  | "lock"
  | "user"
  | "file"
  | "film"
  | "subtitles"
  | "gauge"
  | "clock"
  | "users"
  | "puzzle"
  | "alert"
  // ── Ajouts du mobile (20/10) ──
  | "bell"
  | "cast"
  | "storage"
  | "info";

/** Ce qui est possible ICI : une action n'est offerte que si elle peut aboutir. */
export interface ProblemAvailability {
  /** Faux : réessayer ne changerait rien (défaut : vrai). */
  canRetry?: boolean;
  /** Un palier de qualité plus bas existe (et donc un transcodage). */
  canLowerQuality?: boolean;
  /** Le titre a une autre version (`MediaSources` > 1). */
  hasOtherVersion?: boolean;
  /** Des sous-titres sont choisis. */
  subtitlesActive?: boolean;
  /** Lecture hors ligne et le serveur est joignable : le flux en ligne existe. */
  canPlayOnline?: boolean;
  /** L'appareil a des titres gardés hors ligne à proposer. */
  hasOfflineLibrary?: boolean;
  /** Il y a un écran où revenir (défaut : vrai). */
  canGoBack?: boolean;
  /** La plateforme sait ouvrir les réglages du système (défaut : faux). */
  canOpenSettings?: boolean;
  /** La séance existe encore et cet appareil peut la rejoindre. */
  canRejoin?: boolean;
  /** Cet appareil a d'autres profils (Famille) à proposer. */
  canSwitchProfile?: boolean;
}

export interface ProblemAction {
  key: ProblemActionKey;
  /** Clé i18n qualifiée (« errors:actionRetry »). */
  labelKey: string;
}

/** Une ligne des détails techniques, à traduire par la plateforme (clé de l'espace `errors`). */
export interface ProblemDetail {
  key: string;
  values: Record<string, string | number>;
}

export interface ProblemModel {
  cause: ProblemCause;
  context: ProblemContext;
  icon: ProblemIcon;
  /** QUOI — clé i18n qualifiée. */
  titleKey: string;
  /** POURQUOI — clé i18n qualifiée. */
  reasonKey: string;
  /** Une phrase d'aide qui suit la raison. */
  hintKey: string | null;
  /** Les valeurs des clés (« {{measured}} »). */
  values: Record<string, string | number>;
  /** Une à trois actions ; la première est la principale. */
  actions: ProblemAction[];
  /** Les lignes techniques, repliées sous « Détails ». */
  details: ProblemDetail[];
  /** La cause peut se réparer seule (réseau, serveur qui redémarre). */
  transient: boolean;
  /**
   * Le code lisible pour le support (« playbackStart/transcodeFailed ») —
   * dit EN PETIT sous le message, jamais à sa place. Stable : il traverse les
   * rapports, il ne se renomme jamais.
   */
  code: string;
  /** La gravité : `info` (un constat), `warning` (gênant, ça peut repartir), `error` (bloqué). */
  severity: ProblemSeverity;
  /** La forme d'affichage (`problemPresentation.ts`). */
  presentation: ProblemPresentation;
}

/** La gravité d'un message — sa couleur et son pictogramme. */
export type ProblemSeverity = "info" | "warning" | "error";

/**
 * Les trois formes d'un message, les mêmes sur le téléphone et la tablette :
 * - `banner` : bandeau discret, non bloquant, qui s'efface seul (« Léa a quitté la séance ») ;
 * - `card` : carte dans le lecteur, sur l'image, avec ses actions ;
 * - `screen` : écran plein — impossible de continuer ici.
 */
export type ProblemPresentation = "banner" | "card" | "screen";
