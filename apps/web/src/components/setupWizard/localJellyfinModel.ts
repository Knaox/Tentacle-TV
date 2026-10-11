import type { SetupJellyfinInstall, SetupJellyfinInstallFailure, SetupLocalJellyfin } from "@tentacle-tv/shared";

/**
 * Ce que l'écran « Jellyfin » de l'app Windows dit du Jellyfin de CE PC — une
 * règle pure, testée : l'installation guidée tant qu'elle tourne, puis l'état
 * détecté par l'hôte. Une installation FINIE ne masque jamais un Jellyfin
 * arrêté : son installateur ne le lance pas (l'hôte le démarre, et sinon
 * « Démarrer Jellyfin » reste à l'écran).
 */
export type LocalJellyfinView =
  | { kind: "checking" }
  | { kind: "running"; url: string }
  /** Un démarrage vient d'être demandé (après l'installation, ou par le bouton) : on attend qu'il réponde. */
  | { kind: "starting" }
  /** Installation simple arrêtée : « Démarrer Jellyfin ». */
  | { kind: "stoppedTray" }
  /** Un service arrêté : à démarrer dans Services, jamais par nous. */
  | { kind: "stoppedService" }
  | { kind: "stoppedUnknown" }
  /** Rien d'installé : l'installation guidée est proposée. */
  | { kind: "installOffer" }
  | { kind: "installing"; message: InstallMessage }
  | { kind: "installFailed"; failure: SetupJellyfinInstallFailure }
  /** Rien d'installé, et pas d'installation guidée (ARM64, coupée) : la page officielle. */
  | { kind: "manual"; reason: "unsupported_arch" | "disabled" };

export interface InstallMessage {
  key: string;
  values?: Record<string, string | number>;
}

const IN_PROGRESS: ReadonlySet<SetupJellyfinInstall["phase"]> = new Set(["resolving", "downloading", "verifying", "installing"]);

export function installRunning(install: SetupJellyfinInstall | null): boolean {
  return install !== null && IN_PROGRESS.has(install.phase);
}

export function installMessage(install: SetupJellyfinInstall): InstallMessage {
  const version = install.version ?? "";
  if (install.phase === "downloading") {
    if (!install.totalBytes) return { key: "install_downloadingUnknown", values: { version } };
    const percent = Math.min(100, Math.floor((install.receivedBytes / install.totalBytes) * 100));
    return { key: "install_downloading", values: { version, percent } };
  }
  if (install.phase === "done") return { key: "install_done" };
  return { key: `install_${install.phase === "idle" ? "resolving" : install.phase}` };
}

export function localJellyfinView(local: SetupLocalJellyfin | null, install: SetupJellyfinInstall | null, starting = false): LocalJellyfinView {
  if (local?.state === "running") return { kind: "running", url: local.url };
  if (install && installRunning(install)) return { kind: "installing", message: installMessage(install) };
  if (install?.phase === "failed" && install.failure) return { kind: "installFailed", failure: install.failure };
  if (local === null) return { kind: "checking" };
  if (local.installing) return { kind: "installing", message: { key: "install_resolving" } };
  if (local.state === "stopped") {
    if (local.mode === "service") return { kind: "stoppedService" };
    if (starting) return { kind: "starting" };
    return local.canStart ? { kind: "stoppedTray" } : { kind: "stoppedUnknown" };
  }
  // Installé à l'instant, pas encore vu par la détection.
  if (install?.phase === "done") return { kind: "installing", message: installMessage(install) };
  return local.installer === "available" ? { kind: "installOffer" } : { kind: "manual", reason: local.installer };
}
