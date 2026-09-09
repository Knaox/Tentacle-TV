/**
 * Le hors ligne sur MOBILE.
 *
 * ⚠️ Jamais « téléchargement », « télécharger », « téléchargé » ici : ces
 * textes passent sous les yeux des relecteurs de l'App Store. Les clés de
 * `downloads` qui ne contiennent pas le mot restent réutilisables ; celles qui
 * le contiennent ont leur équivalent ici.
 */
export default {
  // Le vocabulaire retenu
  keepOffline: "Garder hors ligne",
  keepEpisodeOffline: "Garder l'épisode",
  keepSeasonOffline: "Toute la saison",
  keepSeriesOffline: "Toute la série",
  keepSelectionOffline: "Garder la sélection ({{count}})",
  tabOnDevice: "Sur cet appareil",
  stateOnDevice: "Sur l'appareil",
  stateInProgress: "En préparation",
  stateWaitingWifi: "En attente du Wi-Fi",
  stateWaitingNetwork: "En attente du réseau",
  statusPreparing: "En préparation",
  statusReady: "Prêt",
  statusFinalizing: "Finalisation…",
  switchedOfflineTitle: "Serveur injoignable",
  switchedOfflineHint: "Vos titres sur cet appareil restent lisibles.",
  switchedOfflineDismiss: "Masquer",
  switchedOfflineDeviceTitle: "Passage hors ligne",
  errorFinalize: "La finalisation a échoué",
  retryIn: "Nouvelle tentative dans {{seconds}} s",
  retryNow: "Nouvelle tentative…",
  // Le serveur extrait chaque piste à la demande : une extraction trop
  // lente manquait, et rien ne le disait. La réparation les rattrape au
  // retour du réseau.
  subtitlesPartial: "Sous-titres : {{done}} sur {{total}}",
  transferRate: "{{rate}}/s",
  timeLeftHours: "{{hours}} h {{minutes}} min restantes",
  timeLeftMinutes: "{{minutes}} min restantes",
  timeLeftSeconds: "moins d'une minute",
  variantOriginal: "Qualité d'origine",
  variantOriginalDesc: "Le fichier tel quel, avec toutes ses langues et ses sous-titres.",
  variantRemux: "Qualité d'origine (MP4)",
  variantRemuxDesc: "La même image, réemballée pour cet appareil — une seule langue audio.",
  remove: "Retirer de l'appareil",
  myOfflineTitles: "Mes titres hors ligne",

  // Le dialogue
  dialogTitle: "Garder hors ligne",
  dialogTitleSeason: "Garder la saison hors ligne ({{count}} épisodes)",
  dialogTitleSeries: "Garder la série hors ligne",
  dialogTitleSelection: "Garder la sélection hors ligne ({{count}} épisodes)",
  start: "Garder hors ligne",
  queued: "Le titre sera bientôt sur votre appareil.",
  seasonQueued: "{{count}} épisodes en préparation.",
  startFailed: "Impossible de lancer la mise de côté.",
  // Le périmètre, quand la demande part d'un épisode.
  scopeLabel: "Ce qu'on garde",
  scopeEpisode: "Cet épisode",
  scopeSeason: "La saison",
  scopeSeries: "La série",
  scopeLoading: "Lecture des épisodes…",
  scopeFailed: "Impossible de lire les épisodes de la série.",
  noVariantTitle: "Pas de version compatible",
  noVariantMessage:
    "Ce titre ne peut pas être gardé hors ligne sur cet appareil : le serveur ne propose pas de version lisible ici.",
  audioUnplayableWarning: "La piste « {{track}} » ne sera pas lisible sur cet appareil.",
  lightOnlyHint:
    "Cet appareil ne sait pas lire ce fichier tel quel, et il ne peut pas être recopié sans conversion : cette version est recompressée par le serveur, donc moins fine que l'originale.",
  singleAudioTrackHint: "Une seule piste audio est conservée dans cette version.",
  // Jellyfin ne sait sortir qu'UNE piste audio de son transcodage : autant
  // dire laquelle avant de lancer le transfert, plutôt que de le découvrir
  // une fois le titre sur l'appareil.
  audioKeptHint: "Une seule piste audio sera embarquée : {{track}}. Les autres langues resteront sur le serveur.",
  audioLanguagePicker: "Langue à embarquer",
  audioLanguageDefault: "Langue par défaut",
  subtitlesAllKeptHint: "Tous les sous-titres texte sont conservés, dans toutes leurs langues.",
  imageSubsHint: "Les sous-titres image (PGS, VobSub) ne se conservent pas : seule l'incrustation les embarque.",
  dolbyVisionColorsHint: "Couleurs non garanties : le format Dolby Vision de ce titre dépend de la conversion du serveur.",
  presetBitrate: "{{mbps}} Mb/s",
  sizeUnknown: "Taille inconnue",
  totalSize: "Total : {{size}}",
  alreadyOnDevice_one: "{{count}} déjà sur l'appareil",
  alreadyOnDevice_other: "{{count}} déjà sur l'appareil",
  seasonsPickerLabel: "Saisons à garder",
  wifiOnlyHint:
    "Vous êtes en données mobiles : le transfert attendra le Wi-Fi (réglable dans Sur cet appareil).",

  // L'écran de gestion
  // Le geste global : la notification Android le porte aussi.
  pauseAll: "Tout mettre en pause",
  resumeAll: "Tout reprendre",
  manage: "Gérer",
  manageTitle: "Sur cet appareil",
  countTitles_one: "{{count}} titre",
  countTitles_other: "{{count}} titres",
  countActive_one: "{{count}} en cours",
  countActive_other: "{{count}} en cours",
  spaceUsed: "Occupé par vos titres : {{size}}",
  waitingWifiCard_one: "{{count}} transfert attend le Wi-Fi",
  waitingWifiCard_other: "{{count}} transferts attendent le Wi-Fi",
  continueOnCellular: "Continuer en données mobiles",
  removeConfirmTitle: "Retirer ce titre de l'appareil ?",
  removeConfirmMessage:
    "Le fichier sera retiré pour ce compte. Un autre compte de cet appareil qui l'a gardé le conserve.",
  bulkRemove: "Retirer ({{count}})",
  bulkRemoveConfirmTitle_one: "Retirer {{count}} titre de l'appareil ?",
  bulkRemoveConfirmTitle_other: "Retirer {{count}} titres de l'appareil ?",
  bulkRemoveConfirmMessage:
    "Les fichiers seront retirés de cet appareil. Les autres comptes qui les ont gardés les conservent.",
  removeAll: "Tout retirer de l'appareil",
  removeAllConfirmTitle: "Tout retirer ?",
  removeAllConfirmMessage: "Tous vos titres hors ligne seront retirés de cet appareil.",
  emptyTitle: "Rien sur cet appareil pour l'instant",
  emptyMessage:
    "Les films et épisodes gardés hors ligne depuis leur fiche apparaîtront ici, prêts à être regardés sans réseau.",

  // Le catalogue local
  libraryEmptyTitle: "Aucun titre hors ligne",
  libraryEmptyMessage:
    "Aucun titre lisible sur cet appareil pour ce compte. Le catalogue complet reviendra dès que le serveur répondra.",
  libraryEmptyOfflineTitle: "Hors ligne, et rien sur cet appareil",
  libraryEmptyOfflineHint: "Aucun titre n'est gardé hors ligne pour ce compte. Le catalogue complet reviendra avec la connexion.",
  searchPlaceholder: "Rechercher sur cet appareil",
  noResults: "Aucun titre ne correspond sur cet appareil.",
  episodesOnDeviceHint: "Sur l'appareil",
  seasonGone: "Cette saison n'est plus sur l'appareil.",
  seriesGone: "Cette série n'est plus sur l'appareil.",
  openCatalog: "Voir le catalogue hors ligne",
  openCatalogHint: "L'accueil hors ligne, tel qu'il s'affiche sans réseau.",
  minutesLeft_one: "{{count}} min restante",
  minutesLeft_other: "{{count}} min restantes",
  episodesShort: "{{count}} ép.",
  alsoOnDevice: "Aussi sur l'appareil",
  emptyGoHome: "Retour à l'accueil",
  a11yWatchedToggle: "{{title}}, marquer comme vu",

  // Les réglages
  settingsTitle: "Sur cet appareil",
  sectionSpace: "Espace",
  storageHint: "Les titres vivent dans l'espace de l'application. Aucun dossier à choisir.",
  sectionTransfers: "Transferts",
  wifiOnly: "Wi-Fi seulement",
  wifiOnlyDesc: "Les transferts attendent une connexion Wi-Fi.",
  backgroundTransfers: "Continuer en arrière-plan",
  backgroundTransfersDesc: "Les transferts se poursuivent application derrière ou écran éteint.",
  transferNotifChannel: "Transferts",
  transferNotifTitle: "Transferts en cours",
  transferNotifBody_one: "{{count}} titre en préparation",
  transferNotifBody_other: "{{count}} titres en préparation",
  transferNotifProgress: "{{percent}} %",
  notifyReady: "Me prévenir quand un titre est prêt",
  notifyReadyDesc: "Une notification quand la file est terminée.",
  notifyReadyDenied: "Notifications désactivées dans les réglages du téléphone.",
  sectionTitles: "Titres",
  manageTitles: "Gérer les titres",
  sectionOnDevice: "Sur cet appareil",
  profileRowSettings: "Réglages hors ligne",
  sectionConnection: "Connexion",
  goOfflineHint:
    "N'utiliser que ce qui est sur cet appareil. Vous repasserez en ligne depuis la pastille « Hors ligne ».",
  dataTitle: "Données",

  // La connectivité
  networkLabel: "Réseau du téléphone : {{type}}",
  networkWifi: "Wi-Fi",
  networkCellular: "Données mobiles",
  networkNone: "Aucun réseau",
  networkOther: "Autre",
  reasonTimeout: "Le serveur ne répond pas à temps : la connexion est insuffisante.",
  serverReachableTitle: "Le serveur répond",
  serverReachableHint: "Vous êtes hors ligne à la main : l'accueil en ligne est à un geste.",
  saverAutoReason: "Connexion lente détectée : l'application réduit ce qu'elle transfère.",
  sessionExpiredMessage:
    "La session hors ligne a expiré (plus de 30 jours sans contact avec le serveur). Reconnectez-vous en ligne pour vérifier le compte et retrouver vos titres. Les données locales sont conservées.",

  // Le profil
  clearCacheKeepsTitles: "Vos titres hors ligne seront conservés.",
  changeServerWithTitlesMessage:
    "Vous avez {{count}} titres hors ligne liés à ce serveur. Ils resteront invisibles tant que vous n'y reviendrez pas.",
  changeServerKeepTitles: "Changer et garder les titres",
  changeServerRemoveTitles: "Retirer les titres et changer",

  // Les notifications
  readyNotifTitle: "Prêt hors ligne",
  readyNotifBody_one: "« {{title}} » est sur votre appareil.",
  readyNotifBody_other: "{{count}} titres sont prêts sur votre appareil.",
  readyNotifBodySeries: "{{series}} : {{count}} épisodes sont prêts sur votre appareil.",
  diskFullNotifTitle: "Espace insuffisant",
  diskFullNotifBody: "Le transfert de « {{title}} » s'est arrêté.",

  // Le lecteur
  notOnDeviceTitle: "Ce titre n'est pas sur l'appareil",
  notOnDeviceHint: "Il se lira dès que le serveur répondra. Vous pourrez le garder hors ligne depuis sa fiche.",
  fileMissingTitle: "Fichier introuvable",
  fileMissingHint:
    "Ce titre n'est plus sur l'appareil. Réessayer relance la lecture — depuis le serveur s'il est joignable.",

  // Divers
  selectEpisodes: "Sélectionner des épisodes",
  unitGiB: "Gio",
  unitMiB: "Mio",
  unitKiB: "Kio",
  a11yPill: "Hors ligne, ouvrir les détails",
  a11yOnDeviceButton: "Sur cet appareil",
  a11yTransferActive: "transfert en cours",
  a11yKeepState: "{{title}}, {{state}}",
};
