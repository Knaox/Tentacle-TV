/**
 * Les textes de l'écran de démarrage (`splash/`), en français et en anglais —
 * à part de `strings.ts` pour que chaque table reste lisible. Même règle :
 * les deux langues au même jeu de clés, aucun emoji, `{nom}` par `format`.
 *
 * Les lignes sont COURTES : l'écran les pose dans des cadres de hauteur fixe
 * (`splash/splashLayout.ts`), une ou deux lignes au plus, trois pour le conseil
 * sous la question.
 */
import type { Language } from "./strings";

export interface SplashStrings {
  stepLaunch: string;
  stepServer: string;
  stepDatabase: string;
  stepExtensions: string;
  stepWizard: string;
  stepReady: string;
  firstRunHint: string;
  wizardHint: string;
  trayHint: string;
  failedTitle: string;
  stoppedBody: string;
  startupQuestion: string;
  startupHint: string;
  startupYes: string;
  startupNo: string;
  startupSaving: string;
  startupOnDone: string;
  startupOffDone: string;
  openLog: string;
  retry: string;
  close: string;
}

const fr: SplashStrings = {
  stepLaunch: "Préparation de Tentacle Server…",
  stepServer: "Démarrage du serveur…",
  stepDatabase: "Préparation de la base de données…",
  stepExtensions: "Chargement des extensions…",
  stepWizard: "Ouverture de l'assistant d'installation…",
  stepReady: "Tentacle Server est prêt.",
  firstRunHint: "Le premier démarrage peut prendre une minute.",
  wizardHint: "L'assistant s'ouvre dans votre navigateur.",
  trayHint: "Tentacle Server continue dans la zone de notification, près de l'horloge.",
  failedTitle: "Tentacle Server n'a pas pu démarrer.",
  stoppedBody: "Le serveur s'est arrêté. Ouvrez le journal pour le détail, puis réessayez.",
  startupQuestion: "Lancer Tentacle Server au démarrage de Windows ?",
  startupHint:
    "Vos appareils trouveront le serveur dès l'ouverture de votre session. Modifiable à tout moment depuis l'icône Tentacle, près de l'horloge.",
  startupYes: "Oui",
  startupNo: "Non",
  startupSaving: "Enregistrement de votre choix…",
  startupOnDone: "Tentacle Server se lancera avec Windows.",
  startupOffDone: "Tentacle Server ne se lancera pas avec Windows.",
  openLog: "Ouvrir le journal",
  retry: "Réessayer",
  close: "Fermer",
};

const en: SplashStrings = {
  stepLaunch: "Preparing Tentacle Server…",
  stepServer: "Starting the server…",
  stepDatabase: "Preparing the database…",
  stepExtensions: "Loading extensions…",
  stepWizard: "Opening the setup wizard…",
  stepReady: "Tentacle Server is ready.",
  firstRunHint: "The first start can take a minute.",
  wizardHint: "The wizard opens in your browser.",
  trayHint: "Tentacle Server keeps running in the notification area, next to the clock.",
  failedTitle: "Tentacle Server could not start.",
  stoppedBody: "The server stopped. Open the log for details, then try again.",
  startupQuestion: "Start Tentacle Server when Windows starts?",
  startupHint:
    "Your devices will find the server as soon as you sign in. You can change this at any time from the Tentacle icon, next to the clock.",
  startupYes: "Yes",
  startupNo: "No",
  startupSaving: "Saving your choice…",
  startupOnDone: "Tentacle Server will start with Windows.",
  startupOffDone: "Tentacle Server will not start with Windows.",
  openLog: "Open log",
  retry: "Try again",
  close: "Close",
};

export const SPLASH_STRINGS: Readonly<Record<Language, SplashStrings>> = { fr, en };
