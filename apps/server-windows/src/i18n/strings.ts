/**
 * Les textes de l'hôte, en français et en anglais. `Strings` tient les deux
 * tables au même jeu de clés : une clé oubliée ne compile pas.
 *
 * Les `{nom}` se remplacent par `format`. Aucun emoji (règle de l'UI).
 */
export type Language = "fr" | "en";

export interface Strings {
  appName: string;
  // Infobulle et première ligne du menu.
  stateStarting: string;
  stateRunning: string;
  stateStopped: string;
  statePortBusy: string;
  stateAlreadyRunning: string;
  stateDataUnwritable: string;
  stateCrashLoop: string;
  // Menu.
  openAdmin: string;
  startWithWindows: string;
  changePort: string;
  portItem: string;
  noFreePort: string;
  setupCode: string;
  openLog: string;
  restartServer: string;
  deleteData: string;
  quit: string;
  // Notifications.
  portBusyBody: string;
  alreadyRunningBody: string;
  dataUnwritableBody: string;
  crashLoopBody: string;
  publicNetworkTitle: string;
  publicNetworkBody: string;
  // Boîtes de dialogue.
  changePortConfirm: string;
  deleteDataConfirm: string;
  deleteDataFailed: string;
  otherAccount: string;
  dataFolderFailed: string;
  setupCodeBody: string;
  noSetupCode: string;
  startupDisabledByUser: string;
  startupDisabledByPolicy: string;
  startupUnavailable: string;
}

const fr: Strings = {
  appName: "Tentacle Server",
  stateStarting: "Démarrage…",
  stateRunning: "En marche, port {port}",
  stateStopped: "Arrêté",
  statePortBusy: "Port {port} déjà utilisé",
  stateAlreadyRunning: "Données tenues par un autre serveur",
  stateDataUnwritable: "Dossier de données inaccessible",
  stateCrashLoop: "Le serveur s'arrête sans cesse",
  openAdmin: "Ouvrir l'administration",
  startWithWindows: "Démarrer avec Windows",
  changePort: "Changer de port",
  portItem: "Port {port}",
  noFreePort: "Aucun port libre proposé",
  setupCode: "Code d'installation",
  openLog: "Ouvrir le journal",
  restartServer: "Redémarrer le serveur",
  deleteData: "Supprimer les données du serveur…",
  quit: "Quitter",
  portBusyBody:
    "Le port {port} est déjà utilisé par une autre application. Choisissez un autre port dans le menu de l'icône Tentacle.",
  alreadyRunningBody:
    "Un autre serveur Tentacle utilise déjà ces données. Fermez-le, puis choisissez « Redémarrer le serveur ».",
  dataUnwritableBody:
    "Tentacle Server ne peut pas écrire dans son dossier de données ({dir}). Ouvrez le journal pour le détail.",
  crashLoopBody:
    "Le serveur s'est arrêté plusieurs fois de suite. Ouvrez le journal depuis l'icône Tentacle, puis choisissez « Redémarrer le serveur ».",
  publicNetworkTitle: "Réseau en mode « Public »",
  publicNetworkBody:
    "Les téléphones et téléviseurs ne joindront pas Tentacle tant que ce réseau est « Public ». Passez-le en « Privé » dans les Paramètres réseau.",
  changePortConfirm:
    "Tentacle Server va redémarrer sur le port {port}.\n\nLes téléviseurs et applications déjà jumelés devront être jumelés à nouveau.\n\nContinuer ?",
  deleteDataConfirm:
    "Supprimer toutes les données du serveur ?\n\nComptes, réglages, extensions et base de Tentacle seront effacés de ce PC ({dir}). Jellyfin et vos films ne sont pas touchés.\n\nCette action est définitive. Tentacle Server se fermera ensuite.",
  deleteDataFailed: "Certaines données n'ont pas pu être supprimées ({dir}). Le détail est dans le journal.",
  otherAccount:
    "Tentacle Server est déjà installé par un autre compte Windows de ce PC.\n\nOuvrez une session sur ce compte pour le gérer.",
  dataFolderFailed: "Impossible de préparer le dossier de données ({dir}).\n\n{detail}",
  setupCodeBody:
    "Code d'installation : {code}\n\nIl n'est demandé que depuis un autre réseau que celui de ce PC. Ctrl+C copie ce message.",
  noSetupCode: "Aucun code d'installation : l'installation est terminée, ou le serveur n'a pas encore démarré.",
  startupDisabledByUser:
    "Le démarrage avec Windows a été coupé dans les Paramètres de Windows. Réactivez Tentacle Server dans Paramètres > Applications > Démarrage.",
  startupDisabledByPolicy: "Le démarrage avec Windows est bloqué par une stratégie de ce PC.",
  startupUnavailable: "Le démarrage avec Windows n'a pas pu être modifié. Le détail est dans le journal.",
};

const en: Strings = {
  appName: "Tentacle Server",
  stateStarting: "Starting…",
  stateRunning: "Running, port {port}",
  stateStopped: "Stopped",
  statePortBusy: "Port {port} already in use",
  stateAlreadyRunning: "Data held by another server",
  stateDataUnwritable: "Data folder not writable",
  stateCrashLoop: "The server keeps stopping",
  openAdmin: "Open administration",
  startWithWindows: "Start with Windows",
  changePort: "Change port",
  portItem: "Port {port}",
  noFreePort: "No free port to offer",
  setupCode: "Setup code",
  openLog: "Open log",
  restartServer: "Restart server",
  deleteData: "Delete server data…",
  quit: "Quit",
  portBusyBody: "Port {port} is already used by another application. Pick another port from the Tentacle icon menu.",
  alreadyRunningBody: "Another Tentacle server is already using this data. Close it, then choose \"Restart server\".",
  dataUnwritableBody: "Tentacle Server cannot write to its data folder ({dir}). Open the log for details.",
  crashLoopBody:
    "The server stopped several times in a row. Open the log from the Tentacle icon, then choose \"Restart server\".",
  publicNetworkTitle: "Network set to \"Public\"",
  publicNetworkBody:
    "Phones and TVs cannot reach Tentacle while this network is \"Public\". Switch it to \"Private\" in the network settings.",
  changePortConfirm:
    "Tentacle Server will restart on port {port}.\n\nTVs and apps already paired will need to be paired again.\n\nContinue?",
  deleteDataConfirm:
    "Delete all server data?\n\nAccounts, settings, extensions and the Tentacle database will be erased from this PC ({dir}). Jellyfin and your movies are not touched.\n\nThis cannot be undone. Tentacle Server will then close.",
  deleteDataFailed: "Some data could not be deleted ({dir}). Details are in the log.",
  otherAccount:
    "Tentacle Server is already installed by another Windows account on this PC.\n\nSign in to that account to manage it.",
  dataFolderFailed: "Could not prepare the data folder ({dir}).\n\n{detail}",
  setupCodeBody:
    "Setup code: {code}\n\nIt is only asked for from a network other than this PC's. Ctrl+C copies this message.",
  noSetupCode: "No setup code: setup is finished, or the server has not started yet.",
  startupDisabledByUser:
    "Starting with Windows was turned off in Windows Settings. Turn Tentacle Server back on in Settings > Apps > Startup.",
  startupDisabledByPolicy: "Starting with Windows is blocked by a policy on this PC.",
  startupUnavailable: "Starting with Windows could not be changed. Details are in the log.",
};

export const STRINGS: Readonly<Record<Language, Strings>> = { fr, en };

/** `GetUserDefaultUILanguage` : langue primaire 0x0C = français, sinon anglais. */
export function languageFromLangId(langId: number): Language {
  return (langId & 0x3ff) === 0x0c ? "fr" : "en";
}

export function format(template: string, values: Readonly<Record<string, string | number>> = {}): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = values[key];
    return value === undefined ? match : String(value);
  });
}
