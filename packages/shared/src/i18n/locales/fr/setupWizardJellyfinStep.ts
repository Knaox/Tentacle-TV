/**
 * L'écran « Jellyfin » de l'assistant : ce que dit le pied selon l'état réel
 * (`jellyfinStepModel.ts`), la colonne de gauche (les deux sortes de Jellyfin,
 * l'installation guidée en trois étapes) et l'exemple d'adresse propre à la
 * plateforme du serveur. Fondu dans `setupWizard`.
 */
export default {
  jfStatus_waitInstall: "Attendez la fin de l'installation de Jellyfin.",
  jfStatus_waitStart: "Jellyfin démarre : il apparaîtra dans la liste dans quelques secondes.",
  jfStatus_waitStack: "Le Jellyfin de cette pile démarre : attendez qu'il réponde.",
  jfStatus_searching: "Recherche de Jellyfin en cours…",
  jfStatus_installOrAddress: "Installez Jellyfin, ou donnez son adresse, pour continuer.",
  jfStatus_startOrAddress: "Démarrez Jellyfin, ou donnez son adresse, pour continuer.",
  jfStatus_address: "Donnez l'adresse de Jellyfin pour continuer.",

  jfKindsTitle: "Neuf ou déjà configuré ?",
  jfInstallStepsTitle: "L'installation, en trois étapes",
  jfInstallStepsLead: "Tentacle prépare l'installateur officiel, vous le suivez à l'écran, puis Tentacle démarre Jellyfin.",
  jfManualElsewhere: "J'ai déjà un Jellyfin ailleurs",

  jfUrlHintWindows: "Par exemple http://localhost:8096 pour un Jellyfin de ce PC, ou http://192.168.1.20:8096 (l'adresse IP d'un autre PC).",
  jfUrlHintNative: "Par exemple http://192.168.1.20:8096 (l'adresse IP de la machine de Jellyfin), ou http://localhost:8096 s'il tourne sur cette machine.",
};
