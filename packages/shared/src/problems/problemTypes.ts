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
  | "watchTogether";

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
  | "decodeFailed"
  | "engineFailed"
  | "offlineFileMissing"
  | "offlineFileDamaged"
  // Le reste
  | "extensionMissing"
  | "unknown";

/** Quoi faire. */
export type ProblemActionKey =
  | "retry"
  | "lowerQuality"
  | "otherVersion"
  | "withoutSubtitles"
  | "playOnline"
  | "offlineLibrary"
  | "signIn"
  | "editAddress"
  | "back";

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
  | "alert";

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
}
