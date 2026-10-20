import type { CauseEntry } from "./problemCatalog";

/**
 * Les causes ajoutées pour le mobile et la tablette (20/10) — connexion au
 * compte, Famille, Watch Together, hors ligne, notifications, diffusion,
 * écran qui plante. Même forme que `problemCatalog.ts`, qui les fusionne :
 * une seule table pour toutes les plateformes. Les clés de phrases sont dans
 * `i18n/locales/{fr,en}/errorsMore.ts` (espace `errors`).
 */
export const MORE_CAUSES = {
  // ── La connexion au compte ──
  wrongCredentials: {
    icon: "user", reason: "reasonWrongCredentials", hint: "hintWrongCredentials",
    actions: ["retry"], transient: false, severity: "warning", presentation: "banner",
  },
  accountDisabled: {
    icon: "lock", reason: "reasonAccountDisabled", hint: "hintAccountAdmin",
    actions: ["back"], transient: false, presentation: "screen",
  },
  accountLockedOut: {
    icon: "lock", reason: "reasonAccountLockedOut", hint: "hintAccountAdmin",
    actions: ["back"], transient: false, presentation: "screen",
  },
  accountOutsideSchedule: {
    icon: "clock", reason: "reasonAccountOutsideSchedule", hint: "hintAccountOutsideSchedule",
    actions: ["back"], transient: false, presentation: "screen",
  },
  accountMaxSessions: {
    icon: "users", reason: "reasonAccountMaxSessions", hint: "hintAccountMaxSessions",
    actions: ["retry", "back"], transient: false, presentation: "screen",
  },
  tooManyAttempts: {
    icon: "clock", reason: "reasonTooManyAttempts", hint: "hintTooManyAttempts",
    actions: ["retry"], transient: true, severity: "warning", presentation: "banner",
  },
  databaseMigrating: {
    icon: "server", reason: "reasonDatabaseMigrating", hint: "hintDatabaseMigrating",
    actions: ["retry"], transient: true, severity: "info", presentation: "screen",
  },
  // ── Famille et droits ──
  profileSessionExpired: {
    icon: "user", reason: "reasonProfileSessionExpired", hint: "hintProfileSessionExpired",
    actions: ["switchProfile", "back"], transient: false, presentation: "screen",
  },
  parentalBlocked: {
    icon: "lock", reason: "reasonParentalBlocked", hint: "hintParentalBlocked",
    actions: ["back", "switchProfile"], transient: false,
  },
  // ── Watch Together ──
  wtJoinFailed: {
    icon: "users", reason: "reasonWtJoinFailed", hint: "hintWtJoinFailed",
    actions: ["rejoin", "dismiss"], transient: true, presentation: "banner",
  },
  wtMemberLeft: {
    icon: "users", reason: "reasonWtMemberLeft", hint: null,
    actions: [], transient: false, severity: "info", presentation: "banner",
  },
  wtMemberDisconnected: {
    icon: "wifiOff", reason: "reasonWtMemberDisconnected", hint: "hintWtMemberDisconnected",
    actions: [], transient: true, severity: "info", presentation: "banner",
  },
  wtRoomClosed: {
    icon: "users", reason: "reasonWtRoomClosed", hint: "hintWtRoomClosed",
    actions: ["dismiss"], transient: false, severity: "info", presentation: "banner",
  },
  wtRemoved: {
    icon: "users", reason: "reasonWtRemoved", hint: null,
    actions: ["dismiss"], transient: false, severity: "warning", presentation: "banner",
  },
  wtInviteExpired: {
    icon: "clock", reason: "reasonWtInviteExpired", hint: "hintWtInviteExpired",
    actions: ["dismiss"], transient: false, severity: "warning", presentation: "banner",
  },
  wtAccessRevoked: {
    icon: "lock", reason: "reasonWtAccessRevoked", hint: "hintNotAllowed",
    actions: ["dismiss"], transient: false, presentation: "banner",
  },
  wtAlreadyInGroup: {
    icon: "users", reason: "reasonWtAlreadyInGroup", hint: "hintWtAlreadyInGroup",
    actions: ["dismiss"], transient: false, severity: "warning", presentation: "banner",
  },
  wtHostOnly: {
    icon: "users", reason: "reasonWtHostOnly", hint: null,
    actions: ["dismiss"], transient: false, severity: "info", presentation: "banner",
  },
  wtTitleUnavailable: {
    icon: "film", reason: "reasonWtTitleUnavailable", hint: "hintWtTitleUnavailable",
    actions: ["dismiss"], transient: false, severity: "warning", presentation: "banner",
  },
  wtDesync: {
    icon: "users", reason: "reasonWtDesync", hint: "hintWtDesync",
    actions: ["rejoin", "back"], transient: false, presentation: "card",
  },
  // ── Hors ligne ──
  transferFailed: {
    icon: "storage", reason: "reasonTransferFailed", hint: "hintTransferFailed",
    actions: ["retry", "manageOffline"], transient: false, presentation: "banner",
  },
  storageFull: {
    icon: "storage", reason: "reasonStorageFull", hint: "hintStorageFull",
    actions: ["manageOffline", "dismiss"], transient: false, presentation: "banner",
  },
  wifiRequired: {
    icon: "wifiOff", reason: "reasonWifiRequired", hint: "hintWifiRequired",
    actions: ["manageOffline", "dismiss"], transient: true, severity: "info", presentation: "banner",
  },
  transferSourceGone: {
    icon: "file", reason: "reasonTransferSourceGone", hint: "hintTransferSourceGone",
    actions: ["manageOffline", "dismiss"], transient: false, presentation: "banner",
  },
  offlineRightsRevoked: {
    icon: "lock", reason: "reasonOfflineRightsRevoked", hint: "hintOfflineRightsRevoked",
    actions: ["back"], transient: false,
  },
  // ── Notifications ──
  pushDenied: {
    icon: "bell", reason: "reasonPushDenied", hint: "hintPushDenied",
    actions: ["openSettings", "dismiss"], transient: false, severity: "warning", presentation: "banner",
  },
  pushUnavailable: {
    icon: "bell", reason: "reasonPushUnavailable", hint: "hintPushUnavailable",
    actions: ["retry", "dismiss"], transient: true, severity: "warning", presentation: "banner",
  },
  // ── Diffusion, image dans l'image ──
  castFailed: {
    icon: "cast", reason: "reasonCastFailed", hint: "hintCastFailed",
    actions: ["retry", "playHere"], transient: false, presentation: "card",
  },
  castLost: {
    icon: "cast", reason: "reasonCastLost", hint: "hintCastLost",
    actions: ["playHere", "retry"], transient: true, presentation: "card",
  },
  castFormatUnsupported: {
    icon: "cast", reason: "reasonCastFormatUnsupported", hint: "hintCastFormatUnsupported",
    actions: ["playHere", "lowerQuality"], transient: false, presentation: "card",
  },
  pipUnavailable: {
    icon: "film", reason: "reasonPipUnavailable", hint: "hintPipUnavailable",
    actions: ["openSettings", "dismiss"], transient: false, severity: "info", presentation: "banner",
  },
  // ── Un écran qui plante en se dessinant ──
  renderCrash: {
    icon: "alert", reason: "reasonRenderCrash", hint: "hintRenderCrash",
    actions: ["retry", "back"], transient: false, presentation: "screen",
  },
} satisfies Record<string, CauseEntry>;

/** Les causes de cette table : le catalogue de base a tout le reste. */
export type MoreProblemCause = keyof typeof MORE_CAUSES;
