import type { ProblemActionKey, ProblemCause, ProblemContext, ProblemIcon } from "./problemTypes";

/**
 * Le catalogue des causes : pour chacune, son icône, sa phrase (clés de
 * l'espace `errors`, en mots de spectateur), sa phrase d'aide, et les gestes
 * utiles DANS L'ORDRE où les proposer — le premier offert devient l'action
 * principale. `describeProblem` n'en garde que ceux qui peuvent aboutir ici,
 * trois au plus.
 */
export interface CauseEntry {
  icon: ProblemIcon;
  reason: string;
  hint: string | null;
  /** Une aide propre à la lecture (« La lecture reprendra où elle s'est arrêtée »). */
  playbackHint?: string;
  actions: readonly ProblemActionKey[];
  /** Peut se réparer seule : réseau, serveur qui redémarre. */
  transient: boolean;
}

export const CAUSES: Record<ProblemCause, CauseEntry> = {
  deviceOffline: {
    icon: "wifiOff", reason: "reasonDeviceOffline", hint: "hintDeviceOffline",
    actions: ["retry", "offlineLibrary", "back"], transient: true,
  },
  serverUnreachable: {
    icon: "server", reason: "reasonServerUnreachable", hint: "hintServerUnreachable",
    actions: ["retry", "editAddress", "back"], transient: true,
  },
  serverTimeout: {
    icon: "clock", reason: "reasonServerTimeout", hint: "hintServerTimeout",
    actions: ["retry", "lowerQuality", "back"], transient: true,
  },
  certificate: {
    icon: "shield", reason: "reasonCertificate", hint: "hintCertificate",
    actions: ["editAddress", "retry", "back"], transient: false,
  },
  insecureBlocked: {
    icon: "shield", reason: "reasonInsecureBlocked", hint: "hintInsecureBlocked",
    actions: ["editAddress", "back"], transient: false,
  },
  notTentacle: {
    icon: "server", reason: "reasonNotTentacle", hint: "hintNotTentacle",
    actions: ["editAddress", "retry", "back"], transient: false,
  },
  serverError: {
    icon: "server", reason: "reasonServerError", hint: "hintServerError",
    actions: ["retry", "back"], transient: false,
  },
  serverTooOld: {
    icon: "server", reason: "reasonServerTooOld", hint: "hintServerTooOld",
    actions: ["back"], transient: false,
  },
  jellyfinUnreachable: {
    icon: "server", reason: "reasonJellyfinUnreachable", hint: "hintJellyfinUnreachable",
    actions: ["retry", "back"], transient: true,
  },
  jellyfinError: {
    icon: "server", reason: "reasonJellyfinError", hint: "hintServerError",
    actions: ["retry", "otherVersion", "back"], transient: false,
  },
  sessionExpired: {
    icon: "user", reason: "reasonSessionExpired", hint: "hintSessionExpired",
    actions: ["signIn", "back"], transient: false,
  },
  notAllowed: {
    icon: "lock", reason: "reasonNotAllowed", hint: "hintNotAllowed",
    actions: ["back"], transient: false,
  },
  itemNotFound: {
    icon: "film", reason: "reasonItemNotFound", hint: "hintItemNotFound",
    actions: ["back"], transient: false,
  },
  fileMissing: {
    icon: "file", reason: "reasonFileMissing", hint: "hintFileMissing",
    actions: ["otherVersion", "retry", "back"], transient: false,
  },
  noCompatibleStream: {
    icon: "film", reason: "reasonNoCompatibleStream", hint: "hintNoCompatibleStream",
    actions: ["otherVersion", "back"], transient: false,
  },
  transcodeNotAllowed: {
    icon: "lock", reason: "reasonTranscodeNotAllowed", hint: "hintTranscodeNotAllowed",
    actions: ["otherVersion", "back"], transient: false,
  },
  transcodeFailed: {
    icon: "server", reason: "reasonTranscodeFailed", hint: "hintTranscodeFailed",
    actions: ["lowerQuality", "retry", "otherVersion", "back"], transient: false,
  },
  subtitleBurnFailed: {
    icon: "subtitles", reason: "reasonSubtitleBurnFailed", hint: "hintSubtitleBurnFailed",
    actions: ["withoutSubtitles", "retry", "back"], transient: false,
  },
  tooManyStreams: {
    icon: "users", reason: "reasonTooManyStreams", hint: "hintTooManyStreams",
    actions: ["retry", "back"], transient: false,
  },
  connectionLost: {
    icon: "wifiOff", reason: "reasonConnectionLost", hint: "hintConnectionLost",
    playbackHint: "hintConnectionLostPlayback", actions: ["retry", "back"], transient: true,
  },
  bandwidthTooLow: {
    icon: "gauge", reason: "reasonBandwidthTooLow", hint: "hintBandwidthTooLow",
    actions: ["lowerQuality", "retry", "back"], transient: false,
  },
  startTimeout: {
    icon: "clock", reason: "reasonStartTimeout", hint: "hintStartTimeout",
    actions: ["retry", "lowerQuality", "back"], transient: false,
  },
  decodeFailed: {
    icon: "film", reason: "reasonDecodeFailed", hint: "hintDecodeFailed",
    actions: ["lowerQuality", "otherVersion", "back"], transient: false,
  },
  engineFailed: {
    icon: "film", reason: "reasonEngineFailed", hint: "hintEngineFailed",
    actions: ["retry", "back"], transient: false,
  },
  offlineFileMissing: {
    icon: "file", reason: "reasonOfflineFileMissing", hint: "hintOfflineFile",
    actions: ["playOnline", "back"], transient: false,
  },
  offlineFileDamaged: {
    icon: "file", reason: "reasonOfflineFileDamaged", hint: "hintOfflineFile",
    actions: ["playOnline", "back"], transient: false,
  },
  offlineMode: {
    icon: "wifiOff", reason: "reasonOfflineMode", hint: "hintOfflineMode",
    actions: ["goOnline", "offlineLibrary", "back"], transient: false,
  },
  extensionMissing: {
    icon: "puzzle", reason: "reasonExtensionMissing", hint: "hintExtensionMissing",
    actions: ["back"], transient: false,
  },
  unknown: {
    icon: "alert", reason: "reasonUnknown", hint: "hintUnknown",
    actions: ["retry", "back"], transient: false,
  },
};

/** QUOI : le titre de chaque contexte. */
export const CONTEXT_TITLES: Record<ProblemContext, string> = {
  playbackStart: "titlePlaybackStart",
  playbackStopped: "titlePlaybackStopped",
  offlinePlayback: "titleOfflinePlayback",
  page: "titlePage",
  connect: "titleConnect",
  signIn: "titleSignIn",
  pairing: "titlePairing",
  action: "titleAction",
  extension: "titleExtension",
  watchTogether: "titleWatchTogether",
};

/** Les libellés des actions ; « Retour » dit où l'on va quand c'est la fiche. */
export const ACTION_LABELS: Record<ProblemActionKey, string> = {
  retry: "actionRetry",
  lowerQuality: "actionLowerQuality",
  otherVersion: "actionOtherVersion",
  withoutSubtitles: "actionWithoutSubtitles",
  playOnline: "actionPlayOnline",
  offlineLibrary: "actionOfflineLibrary",
  goOnline: "actionGoOnline",
  signIn: "actionSignIn",
  editAddress: "actionEditAddress",
  back: "actionBack",
};

/** Les contextes de LECTURE : « Retour » y ramène à la fiche. */
export const PLAYBACK_CONTEXTS: ReadonlySet<ProblemContext> = new Set(["playbackStart", "playbackStopped", "offlinePlayback"]);
