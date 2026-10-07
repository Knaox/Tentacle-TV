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
  doneRemote_off: "Not set up yet: Tentacle works at home. Administration › Remote access whenever you like.",
  doneOpen: "Open Tentacle",
};
