import type { SetupDeployment, SetupPackaging } from "@tentacle-tv/shared";
import type { LocalJellyfinView } from "./localJellyfinModel";

/**
 * Ce que l'écran « Jellyfin » dit de son état — une règle pure, testée : la
 * phrase du pied (ce qui manque VRAIMENT pour continuer), ce qui se tait
 * pendant une installation guidée (« aucun trouvé », la saisie de l'adresse
 * dépliée) et l'exemple d'adresse propre à la plateforme du serveur.
 */
export type JellyfinStepStatus =
  | "pickFirst"
  | "waitInstall"
  | "waitStart"
  | "waitStack"
  | "searching"
  | "installOrAddress"
  | "startOrAddress"
  | "address";

export interface JellyfinStepInput {
  /** Un Jellyfin compatible est coché. */
  chosen: boolean;
  /** L'état du Jellyfin de CE PC (app Windows) ; `null` sans hôte qui le gère. */
  local: LocalJellyfinView | null;
  /** Jellyfin listés (trouvés, saisis, celui de la pile). */
  serverCount: number;
  /** Une recherche est en cours. */
  searching: boolean;
  /** Le Jellyfin de la pile démarre encore. */
  stackStarting: boolean;
  /** Le serveur sait guider l'installation (commande, documentation, pile complète). */
  installGuide: boolean;
}

/** Une installation guidée (ou le démarrage qu'elle demande) est en cours : l'écran attend, il ne propose rien d'autre. */
export function localInstallBusy(local: LocalJellyfinView | null): boolean {
  return local?.kind === "install" || local?.kind === "starting";
}

const STOPPED: ReadonlySet<LocalJellyfinView["kind"]> = new Set(["stoppedTray", "stoppedService", "stoppedUnknown"]);

/** La phrase du pied ; `null` quand un Jellyfin est choisi (le bouton dit la suite). */
export function jellyfinStepStatus(input: JellyfinStepInput): JellyfinStepStatus | null {
  if (input.chosen) return null;
  const { local } = input;
  if (local?.kind === "install") return local.progress.stage === "start" ? "waitStart" : "waitInstall";
  if (local?.kind === "starting") return "waitStart";
  if (input.serverCount > 0) return "pickFirst";
  if (input.stackStarting) return "waitStack";
  if (input.searching || local?.kind === "checking") return "searching";
  if (local && STOPPED.has(local.kind)) return "startOrAddress";
  if (local || input.installGuide) return "installOrAddress";
  return "address";
}

/** « Aucun Jellyfin trouvé » : jamais pendant une installation guidée, qui dit déjà ce qui se passe. */
export function showNoneFound(empty: boolean, local: LocalJellyfinView | null): boolean {
  return empty && !localInstallBusy(local);
}

/**
 * La saisie de l'adresse : dépliée d'office quand rien n'est trouvé — sauf
 * pendant une installation guidée, où elle reste repliée derrière un lien
 * discret (« J'ai déjà un Jellyfin ailleurs »).
 */
export function manualFormOpen(opened: boolean, empty: boolean, local: LocalJellyfinView | null): boolean {
  return opened || (empty && !localInstallBusy(local));
}

export interface UrlExample {
  hintKey: "jfUrlHint" | "jfUrlHintWindows" | "jfUrlHintNative";
  placeholder: string;
}

/**
 * L'exemple d'adresse sous la saisie, selon ce sur quoi tourne le serveur :
 * l'app Windows joint un Jellyfin du PC par `localhost`, un conteneur par
 * `host.docker.internal` (la clé historique, `jfUrlHint`), une installation
 * native par l'adresse IP. Rien de Docker hors de Docker.
 */
export function manualUrlExample(host: { deployment?: SetupDeployment; packaging?: SetupPackaging } | null): UrlExample {
  if (host?.packaging === "windows-app") return { hintKey: "jfUrlHintWindows", placeholder: "http://localhost:8096" };
  if (host?.deployment === "docker") return { hintKey: "jfUrlHint", placeholder: "http://192.168.1.20:8096" };
  return { hintKey: "jfUrlHintNative", placeholder: "http://192.168.1.20:8096" };
}
