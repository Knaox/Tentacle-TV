export default {
  offlineChip: "Offline",
  offlineChipManual: "Offline (manual)",
  offlinePopoverTitle: "Offline mode",
  offlineReasonBackend: "The Tentacle server is not responding.",
  offlineReasonJellyfin: "Jellyfin is not responding.",
  offlineManualEnabled: "Offline mode enabled manually.",
  offlineServerReachable: "The server is reachable.",
  offlineServerUnreachable: "The server is unreachable.",
  offlineAutoHint: "The app will go back online automatically as soon as the server responds.",
  offlineRetry: "Retry",
  offlineStayOffline: "Stay offline",
  offlineGoOnline: "Go back online",
  sessionExpiredTitle: "Reconnection required",
  sessionExpiredMessage:
    "The offline session has expired (more than 30 days without contacting the server). An online reconnection is required to verify the account and access downloads again. Local data is preserved.",
} as const;
