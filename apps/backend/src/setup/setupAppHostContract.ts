/**
 * Le contrat de l'assistant pour l'app Windows « Tentacle Server »
 * (`packaging: "windows-app"`) : ce que son HÔTE fait sur la machine, relayé
 * par le serveur (`/api/setup/jellyfin/local`, `/install`, `/start`,
 * `/pick-folder`). Hors de l'app, rien de tout cela n'existe : `appHost`
 * est absent du contexte, et chaque route répond `host_unavailable`.
 *
 * Tentacle ne redistribue aucun binaire de Jellyfin : l'installation guidée
 * télécharge l'installateur officiel sur `repo.jellyfin.org`, en vérifie
 * l'empreinte, puis le lance en interactif — l'administrateur choisit
 * « installation simple ». Tentacle ne met jamais Jellyfin à jour, et
 * « Quitter » ne l'arrête jamais.
 *
 * MIROIR : recopié avec les autres `setup*Contract.ts` dans
 * `apps/backend/src/setup/` (`setupWizardMirror.test.ts`). Aucun import.
 */

/**
 * `MissingJellyfinGuide`, app Windows seulement : l'installation GUIDÉE (l'hôte
 * télécharge l'installateur officiel, vérifié, et le lance en interactif).
 * `docsUrl` : la page officielle, le repli.
 */
export interface SetupInstallGuide {
  kind: "install";
  docsUrl: string;
}

/**
 * `SetupContext.appHost` : l'app Windows seulement. Absent : ni l'app, ni un
 * serveur qui la connaît. Un geste qui l'exige, ailleurs : `host_unavailable`.
 */
export interface SetupContextAppHost {
  appHost?: SetupAppHost;
}

/** Ce que l'app sait faire POUR CE NAVIGATEUR. */
export interface SetupAppHost {
  /** Détecter, installer et démarrer le Jellyfin de la machine. */
  jellyfin: boolean;
  /**
   * La boîte « Choisir un dossier » de l'Explorateur : seulement si ce
   * navigateur est sur la machine du serveur (elle s'ouvre sur SON écran).
   */
  pickFolder: boolean;
}

/** `GET /api/setup/jellyfin/local` — le Jellyfin de la machine. */
export interface SetupLocalJellyfin {
  /** `absent` : rien d'installé ; `stopped` : installé, ne répond pas ; `running` : il répond. */
  state: "absent" | "stopped" | "running";
  /** Installation simple (`tray`) ou service ; `null` : inconnu. */
  mode: "tray" | "service" | null;
  version: string | null;
  /** L'adresse par laquelle le serveur le joint (`http://127.0.0.1:<port>`, le port lu dans sa configuration). */
  url: string;
  /** « Démarrer Jellyfin » est possible (installation simple, arrêtée). */
  canStart: boolean;
  /** L'installation guidée : possible, impossible sur ARM64, ou coupée par l'app. */
  installer: "available" | "unsupported_arch" | "disabled";
  /** Une installation guidée est en cours. */
  installing: boolean;
  /** La page officielle de téléchargement, le repli de tout cas sans installation guidée. */
  docsUrl: string;
}

/** Où en est l'installation guidée. */
export type SetupJellyfinInstallPhase = "idle" | "resolving" | "downloading" | "verifying" | "installing" | "done" | "failed";

/**
 * Pourquoi elle n'a pas abouti : `blocked` (Windows a refusé de lancer
 * l'installateur : Smart App Control, stratégie), `cancelled` (élévation
 * refusée, installateur fermé), `checksum` (empreinte ou taille fausse : le
 * fichier est effacé)…
 */
export type SetupJellyfinInstallFailure =
  | "unsupported_arch"
  | "disabled"
  | "no_version"
  | "network"
  | "checksum"
  | "cancelled"
  | "blocked"
  | "installer_failed";

/** `POST` et `GET /api/setup/jellyfin/install`. */
export interface SetupJellyfinInstall {
  phase: SetupJellyfinInstallPhase;
  version: string | null;
  receivedBytes: number;
  totalBytes: number | null;
  failure: SetupJellyfinInstallFailure | null;
  docsUrl: string;
}

/** `POST /api/setup/jellyfin/start` — `service` : à démarrer dans Services, jamais par nous. */
export type SetupJellyfinStart =
  | { started: true }
  | { started: false; reason: "service" | "not_installed" | "launcher_missing" | "failed" };

/** `POST /api/setup/jellyfin/pick-folder` */
export interface SetupPickFolderRequest {
  /** Le dossier où la boîte s'ouvre. */
  initial?: string;
  /** Le titre de la boîte, dans la langue de l'assistant. */
  title?: string;
}

/**
 * Le dossier choisi, REVÉRIFIÉ par Jellyfin (`ValidatePath`, avec son compte
 * à lui) : `picked` (il le voit), `mapped_drive` (un lecteur mappé qu'il ne
 * voit pas : `unc`, son chemin réseau, est à proposer), `not_found` (il ne le
 * voit pas), `cancelled` (boîte fermée sans choix).
 */
export type SetupPickFolderResponse =
  | { status: "picked"; path: string }
  | { status: "mapped_drive"; path: string; unc: string }
  | { status: "not_found"; path: string }
  | { status: "cancelled" };
