/**
 * L'assistant d'installation : « Et maintenant ? » — où déposer ses fichiers,
 * le petit tuto (dossier → film → analyse par Jellyfin → le titre dans
 * Tentacle), les applications, le QR code, l'accès à distance. Fondu dans
 * `setupWizard` ; aucune clé renommée en le déplaçant ici.
 */
export default {
  doneTitle: "Et maintenant\u00a0?",
  doneSubtitle: "Tentacle est installé.",
  doneMediaTitle: "Déposez vos films et vos séries",
  doneMediaHost: "Sur cette machine, dans\u00a0:",
  doneMediaGeneric: "Dans les dossiers de vos bibliothèques.",
  doneMediaScan: "Jellyfin les trouve tout seul à sa prochaine analyse, ou tout de suite par «\u00a0Analyser toutes les médiathèques\u00a0» dans son tableau de bord.",
  doneAppsTitle: "Les applications",
  app_web: "Navigateur",
  app_macos: "macOS",
  app_windows: "Windows",
  app_linux: "Linux",
  app_ios: "iPhone et iPad",
  app_android: "Android",
  app_appletv: "Apple TV",
  app_androidtv: "Android TV",
  app_webos: "TV LG (webOS)",
  doneQrTitle: "Sur votre téléphone",
  doneQrBody: "Scannez pour ouvrir ce serveur, puis connectez-vous avec votre compte.",
  doneQrAlt: "QR code de l'adresse {{url}}",
  doneRemoteTitle: "Accès à distance",
  doneRemote_secure: "Joignable depuis Internet, en HTTPS.",
  doneRemote_exposed: "Joignable depuis Internet, mais en HTTP\u00a0: passez par HTTPS (Administration › Accès à distance).",
  doneRemote_unverified: "Réglé, pas encore vérifié depuis Internet.",
  doneRemote_off: "Pas encore réglé\u00a0: Tentacle marche à la maison. Administration › Accès à distance quand vous voudrez.",
  doneOpen: "Ouvrir Tentacle",
};
