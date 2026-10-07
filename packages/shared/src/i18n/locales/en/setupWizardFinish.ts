/**
 * The setup wizard: “What's next?” — where to drop the files, the short
 * tutorial (folder → movie → Jellyfin scan → the title in Tentacle), the
 * apps, the QR code, remote access. Merged into `setupWizard`; no key was
 * renamed when moving them here.
 */
export default {
  doneTitle: "What's next?",
  doneSubtitle: "Tentacle is set up.",
  doneMediaTitle: "Add your movies and shows",
  doneMediaHost: "On this machine, in:",
  doneMediaGeneric: "In your libraries' folders.",
  doneMediaScan: "Jellyfin finds them on its next scan, or right away with \"Scan All Libraries\" in its dashboard.",
  doneAppsTitle: "The apps",
  app_web: "Browser",
  app_macos: "macOS",
  app_windows: "Windows",
  app_linux: "Linux",
  app_ios: "iPhone and iPad",
  app_android: "Android",
  app_appletv: "Apple TV",
  app_androidtv: "Android TV",
  app_webos: "LG TV (webOS)",
  doneQrTitle: "On your phone",
  doneQrBody: "Scan to open this server, then sign in with your account.",
  doneQrAlt: "QR code for {{url}}",
  doneRemoteTitle: "Remote access",
  doneRemote_secure: "Reachable from the Internet, over HTTPS.",
  doneRemote_exposed: "Reachable from the Internet, but over HTTP: switch to HTTPS (Administration › Remote access).",
  doneRemote_unverified: "Set up, not checked from the Internet yet.",
  doneRemote_off: "Access from outside is off: Tentacle works at home. Administration › Remote access whenever you like.",
  doneOpen: "Open Tentacle",

  // ── The short tutorial: adding content ───────────────────────────────
  addTitle: "To add content",
  addLead: "Drop your files into their library's folder, on your server:",
  addLeadNone: "First create a library in Jellyfin (Dashboard › Libraries), then drop your files into it.",
  addOnServer: "on your server",
  addSeenByJellyfin: "seen by Jellyfin: {{path}}",
  addStep1: "The folder",
  addStep1Body: "Movies, Shows…",
  addStep2: "Your movie",
  addStep2Body: "One folder per title",
  addStep3: "Jellyfin scans it",
  addStep3Body: "Artwork and details",
  addStep4: "It shows up in Tentacle",
  addStep4Body: "On all your devices",
  addSchemaLabel: "In four steps: the folder, your movie, Jellyfin's scan, the title in Tentacle.",
  addNaming: "One folder per movie, named after the title and its year: “Dune (2021)/Dune (2021).mkv”. For a show: “Show name/Season 01/…”.",
  addTiming: "How long? Jellyfin spots a new file in about a minute when real-time monitoring is on (it is for the libraries Tentacle creates); otherwise at its next scheduled scan, every 12 hours. Then count a few seconds to a few minutes per title.",
  addRescan: "To scan right away: in Jellyfin, Dashboard › Libraries › “Scan All Libraries”.",
  addGuide: "The full guide",
};
