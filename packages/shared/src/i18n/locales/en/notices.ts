/**
 * Client pop-up notices — web, desktop, mobile, iPad (shared policy:
 * `notices/noticePolicy.ts`). Read by mobile: the word "download" never
 * appears here (guarded by `errorsVocabulary`).
 */
export default {
  close: "Close",
  undo: "Undo",
  dismissForGood: "Don't show again",
  // The Tentacle server is older than this client REQUIRES (minServer): blocking.
  serverUpdateTitle: "Tentacle server needs an update",
  serverUpdateText: "This app requires Tentacle server v{{required}} or later; yours is v{{server}}. Please update it.",
  // `serverUpdateDismiss` / `serverUpdateDismissed`: no longer shown (the required notice can't be hidden), kept.
  serverUpdateDismiss: "Don't show again until the next required update",
  serverUpdateDismissed: "Hidden until the next required update.",
  serverUpdateHow: "See how to update",
  // The server meets the requirement, but a new feature of this app needs a newer server.
  serverNewsTitle: "New features available",
  serverNewsText: "To enjoy the latest features, update your Tentacle server.",
  serverNewsDismiss: "Don't show again until the next new features",
  serverNewsDismissed: "Hidden until the next new features.",
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
