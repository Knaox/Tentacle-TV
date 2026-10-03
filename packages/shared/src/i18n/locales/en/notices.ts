/**
 * Client pop-up notices — web, desktop, mobile, iPad (shared policy:
 * `notices/noticePolicy.ts`). Read by mobile: the word "download" never
 * appears here (guarded by `errorsVocabulary`).
 */
export default {
  close: "Close",
  undo: "Undo",
  dismissForGood: "Don't show again",
  // The Tentacle server is older than this client requires.
  serverUpdateTitle: "Tentacle server needs an update",
  serverUpdateText: "Your server (v{{server}}) is older than this app requires (v{{required}} or later): some features may not work.",
  serverUpdateDismiss: "Don't show again until the next required update",
  serverUpdateDismissed: "Hidden until the next required update.",
  serverUpdateHow: "See how to update",
  // No TMDB key on the server.
  tmdbKeyTitle: "No TMDB key",
  tmdbKeyText: "Without it, recommendations stay generic for every account: no \"For you\", no taste profile, no platform filters.",
  tmdbKeyAdd: "Add the key",
  tmdbKeyDismissed: "Hidden. The information stays on the dashboard.",
  // The Jellyfin administration key no longer works.
  adminKeyTitle: "Jellyfin administration key not working",
  adminKeyRevoked: "Jellyfin no longer recognizes the saved key: it was deleted or replaced.",
  adminKeyNoRights: "The saved key no longer has administrator rights on Jellyfin.",
  adminKeyMissing: "No Jellyfin administration key is saved.",
  adminKeyImpact: "Browsing still works, but new-content notifications, invitations, account creation and administration are stopped.",
  adminKeyFix: "Enter a new key",
} as const;
