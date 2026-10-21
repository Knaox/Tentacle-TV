/**
 * Contrat entre l'interface et la couche native, quel que soit le shell.
 *
 * `apps/web` est servi par une application de bureau — Electron, sur les trois
 * systèmes — et par le navigateur. Ce fichier définit la seule forme que la
 * coquille doit présenter, pour que le reste du code n'ait rien à savoir d'elle.
 */

/** Coquille de bureau détectée, ou `null` sur le web. */
export type DesktopKind = "electron";

/** Désabonnement d'un évènement. */
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
   * Linux seulement : sur quel serveur d'affichage la vidéo est montée.
   *
   * `wayland` — HDR possible ; la lecture est fenêtrée si le compositeur porte
   * la colle KWin (voir `fenetrage`), plein écran forcé sinon (le protocole
   * n'autorise pas un client à placer ses fenêtres).
   * `x11` — lecture fenêtrée comme sur Windows, mais aucun HDR : X.Org n'a pas
   * de gestion de couleur et n'en aura pas.
   */
  readonly montage?: "wayland" | "x11";
  /**
   * Wayland seulement : `libre` quand la colle KWin cale la vidéo sous la
   * fenêtre (lecture fenêtrée ou plein écran, au choix de l'utilisateur),
   * `plein-ecran` quand le compositeur n'offre pas de placement — la lecture
   * native y force le plein écran, et c'est là que l'avis pédagogique a lieu
   * d'exister.
   */
  readonly fenetrage?: "libre" | "plein-ecran";
  /**
   * Hauteur, en points, du bandeau que la page doit dessiner elle-même.
   *
   * Zéro partout où la fenêtre garde son vrai cadre — Windows, et le web. Sur
   * macOS la barre de titre est retirée à la fabrication : les feux de
   * circulation se poseraient sur le contenu, et rien ne permettrait de
   * déplacer la fenêtre. Voir `hostChrome.ts`.
   */
  readonly titleBarHeight?: number;
  /**
   * macOS seulement : le verre NATIF (NSGlassEffectView, macOS 26). Absent
   * ailleurs, et absent si le module natif n'a pas pu se charger. Ne pas le
   * lire directement : passer par `theme/liquidGlassMode.ts`.
   */
  readonly liquidGlass?: LiquidGlassBridge;
  /** Ouvre une URL dans le navigateur du système. */
  openExternal(url: string): Promise<void>;
  /** Sélecteur de dossier natif. `null` si l'utilisateur annule. */
  pickFolder(): Promise<string | null>;
  /** Redémarre l'application. */
  relaunch(): Promise<void>;
}

/** Variante du matériau natif — les quatre niveaux des jetons `--lg-*`. */
export type NativeGlassLevel = "regular" | "clear" | "tinted" | "prominent";

/**
 * Une région de verre natif, décrite par la page.
 *
 * Coordonnées en px CSS, relatives au VIEWPORT de la page
 * (`getBoundingClientRect`) : la coquille y ajoute l'origine de la vue web et
 * le facteur de zoom. La page n'envoie que des régions VISIBLES ; une région
 * cachée, sortie de l'écran ou démontée est retirée par `remove`.
 */
export interface NativeGlassRegion {
  /** Identifiant stable choisi par la page, unique dans la fenêtre. */
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  /** Rayon des coins, en px CSS (capsule : la moitié de la hauteur). */
  readonly radius: number;
  readonly level: NativeGlassLevel;
  /** Teinte `#RRGGBBAA`, ou `null` : le matériau du système, sans teinte. */
  readonly tint: string | null;
  /** Réagit au pointeur (survol, appui). */
  readonly interactive: boolean;
  /** Ordre d'empilement entre régions : la plus grande valeur au-dessus. */
  readonly z: number;
  /**
   * Groupe de fusion : les régions d'un même groupe partagent un
   * NSGlassEffectContainerView — voisines, elles fusionnent et se métamorphosent.
   * Absent : la région est seule.
   */
  readonly group?: string;
  /** Distance de fusion du groupe, en pt. Absent : celle d'AppKit. */
  readonly spacing?: number;
  /** Apparition, déplacement et disparition animés CÔTÉ NATIF, en ms. Absent : aucun. */
  readonly transition?: number;
}

/**
 * Pont du verre natif (`window.tentacle.liquidGlass`), fourni par la coquille.
 *
 * La page regroupe ses changements par image : au plus un `upsert` et un
 * `remove` par image, jamais un appel par élément ni par évènement.
 */
export interface LiquidGlassBridge {
  /** macOS 26 ou plus ET module natif chargé. Figé au démarrage. */
  readonly supported: boolean;
  /**
   * Le verre voit-il la vidéo ? Vrai au montage `fenetre` (Apple Silicon : mpv
   * dans sa fenêtre Metal, SOUS la nôtre). Absent ou faux : le lecteur garde
   * son rendu d'avant sur la vidéo.
   */
  readonly refractsVideo?: boolean;
  /** Le réglage de l'utilisateur. `false` retire TOUT verre natif. */
  setEnabled(enabled: boolean): void;
  /** Crée ou met à jour des régions. */
  upsert(regions: readonly NativeGlassRegion[]): void;
  /** Retire des régions par identifiant. */
  remove(ids: readonly string[]): void;
}

declare global {
  interface Window {
    /** Présent uniquement dans l'app Electron. */
    tentacle?: ElectronBridge;
  }
}
