/**
 * Contrat entre l'interface et la couche native, quel que soit le shell.
 *
 * `apps/web` est servi par DEUX applications de bureau pendant la migration :
 * l'app Tauri (macOS, Linux) et l'app Electron (Windows). Ce fichier définit
 * la seule forme qu'elles doivent présenter, pour que le reste du code ignore
 * laquelle est en face.
 */

/** Shell de bureau détecté, ou `null` sur le web. */
export type DesktopKind = "tauri" | "electron";

/** Désabonnement d'un évènement. Même forme que `UnlistenFn` de Tauri. */
export type Unlisten = () => void;

/** Charge utile d'un évènement natif, dans l'enveloppe attendue par le code. */
export interface DesktopEvent<T> {
  payload: T;
}

/** Rappel d'évènement. */
export type DesktopEventHandler<T> = (event: DesktopEvent<T>) => void;

/**
 * Pont exposé par le preload d'Electron via `contextBridge`.
 *
 * Volontairement minimal : chaque méthode est une porte étroite, et la liste
 * des canaux autorisés est FERMÉE côté preload. On n'expose jamais
 * `ipcRenderer` tel quel — ce serait donner au contenu de la page le droit
 * d'appeler n'importe quel canal du processus principal.
 */
export interface ElectronBridge {
  /** Appelle une commande du processus principal. Rejette si le canal n'est pas autorisé. */
  invoke(command: string, args?: Record<string, unknown>): Promise<unknown>;
  /** S'abonne à un évènement du processus principal. Renvoie le désabonnement. */
  on(event: string, handler: (payload: unknown) => void): Unlisten;
  /** Version du bundle, injectée à la fabrication. */
  readonly version: string;
  /** Plateforme réelle, sans passer par l'analyse du user agent. */
  readonly platform: "win32" | "darwin" | "linux";
  /**
   * Commandes que ce shell sait réellement exécuter.
   *
   * Pendant la migration, la coquille Electron n'implémente qu'une partie de
   * l'inventaire. L'interface interroge cette liste pour masquer proprement ce
   * qui manque, plutôt que d'offrir un bouton dont l'appel sera rejeté. Passer
   * par `desktop/capabilities.ts` plutôt que de la lire directement.
   */
  readonly capabilities: readonly string[];
  /**
   * Hauteur, en points, du bandeau que la page doit dessiner elle-même.
   *
   * Zéro partout où la fenêtre garde son vrai cadre — Windows, et le web. Sur
   * macOS la barre de titre est retirée à la fabrication : les feux de
   * circulation se poseraient sur le contenu, et rien ne permettrait de
   * déplacer la fenêtre. Voir `hostChrome.ts`.
   */
  readonly titleBarHeight?: number;
  /** Ouvre une URL dans le navigateur du système. */
  openExternal(url: string): Promise<void>;
  /** Sélecteur de dossier natif. `null` si l'utilisateur annule. */
  pickFolder(): Promise<string | null>;
  /** Redémarre l'application. */
  relaunch(): Promise<void>;
}

declare global {
  interface Window {
    /** Présent uniquement dans l'app Electron. */
    tentacle?: ElectronBridge;
  }
}
