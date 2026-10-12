import type { SetupJellyfinInstall, SetupJellyfinInstallFailure, SetupLocalJellyfin } from "@tentacle-tv/shared";

/**
 * Ce que l'écran « Jellyfin » de l'app Windows dit du Jellyfin de CE PC — une
 * règle pure, testée : l'installation guidée tant qu'elle tourne, puis l'état
 * détecté par l'hôte. Une installation FINIE ne masque jamais un Jellyfin
 * arrêté : son installateur ne le lance pas (l'hôte le démarre, et sinon
 * « Démarrer Jellyfin » reste à l'écran).
 *
 * L'installation guidée se dit en TROIS étapes, toujours les mêmes
 * (`InstallStage`) : le téléchargement de l'installateur officiel,
 * l'installateur ouvert à l'écran (c'est l'administrateur qui le suit), puis le
 * démarrage de Jellyfin par Tentacle. Elle finit sur « prêt », ou sur ce qu'il
 * reste à faire (installateur fermé, Jellyfin muet, introuvable).
 */
export type InstallStage = "download" | "installer" | "start";

export const INSTALL_STAGES: readonly InstallStage[] = ["download", "installer", "start"];

export interface InstallProgress {
  stage: InstallStage;
  message: InstallMessage;
  /** Le téléchargement, quand sa taille est connue ; `null` ailleurs. */
  percent: number | null;
}

export type LocalJellyfinView =
  | { kind: "checking" }
  | { kind: "running"; url: string }
  /** Installé et démarré PENDANT cet écran : on le dit, puis il rejoint la liste. */
  | { kind: "ready"; url: string }
  /** Un démarrage demandé par le bouton : on attend qu'il réponde. */
  | { kind: "starting" }
  /** Installation simple arrêtée : « Démarrer Jellyfin ». `afterInstall` : il vient d'être installé et ne répond pas encore. */
  | { kind: "stoppedTray"; afterInstall: boolean }
  /** Un service arrêté : à démarrer dans Services, jamais par nous. */
  | { kind: "stoppedService" }
  | { kind: "stoppedUnknown" }
  /** Rien d'installé : l'installation guidée est proposée. */
  | { kind: "installOffer" }
  | { kind: "install"; progress: InstallProgress }
  | { kind: "installFailed"; failure: SetupJellyfinInstallFailure }
  /** L'installateur a fini, mais la détection ne trouve toujours rien. */
  | { kind: "installedNotFound" }
  /** Rien d'installé, et pas d'installation guidée (ARM64, coupée) : la page officielle. */
  | { kind: "manual"; reason: "unsupported_arch" | "disabled" };

export interface InstallMessage {
  key: string;
  values?: Record<string, string | number>;
}

export interface LocalJellyfinFlags {
  /** Un démarrage a été demandé (par l'hôte après l'installation, ou par le bouton) et son délai court encore. */
  starting?: boolean;
}

const IN_PROGRESS: ReadonlySet<SetupJellyfinInstall["phase"]> = new Set(["resolving", "downloading", "verifying", "installing"]);

export function installRunning(install: SetupJellyfinInstall | null): boolean {
  return install !== null && IN_PROGRESS.has(install.phase);
}

export function installMessage(install: SetupJellyfinInstall): InstallMessage {
  const version = install.version ?? "";
  if (install.phase === "downloading") {
    if (!install.totalBytes) return { key: "install_downloadingUnknown", values: { version } };
    return { key: "install_downloading", values: { version, percent: downloadPercent(install) ?? 0 } };
  }
  if (install.phase === "done") return { key: "install_done" };
  return { key: `install_${install.phase === "idle" ? "resolving" : install.phase}` };
}

function downloadPercent(install: SetupJellyfinInstall): number | null {
  if (install.phase !== "downloading" || !install.totalBytes) return null;
  return Math.min(100, Math.floor((install.receivedBytes / install.totalBytes) * 100));
}

/** L'étape de l'installation guidée où l'on en est. */
export function installProgress(install: SetupJellyfinInstall): InstallProgress {
  const stage: InstallStage = install.phase === "installing" ? "installer" : install.phase === "done" ? "start" : "download";
  return { stage, message: installMessage(install), percent: downloadPercent(install) };
}

/** Une étape est faite, en cours, ou à venir — pour la liste des étapes. */
export function stageStatus(current: InstallStage, stage: InstallStage): "done" | "active" | "pending" {
  const delta = INSTALL_STAGES.indexOf(stage) - INSTALL_STAGES.indexOf(current);
  return delta < 0 ? "done" : delta === 0 ? "active" : "pending";
}

const STARTING_AFTER_INSTALL: InstallProgress = { stage: "start", message: { key: "install_done" }, percent: null };

export function localJellyfinView(local: SetupLocalJellyfin | null, install: SetupJellyfinInstall | null, flags: LocalJellyfinFlags = {}): LocalJellyfinView {
  const installedHere = install?.phase === "done";
  const starting = flags.starting === true;
  if (local?.state === "running") return installedHere ? { kind: "ready", url: local.url } : { kind: "running", url: local.url };
  if (install && installRunning(install)) return { kind: "install", progress: installProgress(install) };
  if (install?.phase === "failed" && install.failure) return { kind: "installFailed", failure: install.failure };
  if (local === null) return { kind: "checking" };
  // L'installation tourne déjà (page rechargée) : on la suit dès que son état arrive.
  if (local.installing) return { kind: "install", progress: { stage: "download", message: { key: "install_resolving" }, percent: null } };
  if (local.state === "stopped") {
    if (local.mode === "service") return { kind: "stoppedService" };
    if (starting) return installedHere ? { kind: "install", progress: STARTING_AFTER_INSTALL } : { kind: "starting" };
    return local.canStart ? { kind: "stoppedTray", afterInstall: installedHere } : { kind: "stoppedUnknown" };
  }
  // Installé à l'instant, pas encore vu par la détection : on attend, puis on dit quoi faire.
  if (installedHere) return starting ? { kind: "install", progress: STARTING_AFTER_INSTALL } : { kind: "installedNotFound" };
  return local.installer === "available" ? { kind: "installOffer" } : { kind: "manual", reason: local.installer };
}
