import { existsSync, readFileSync } from "fs";
import { readDeployment, type DeploymentEnv } from "./deployment";
import type { SetupHostInfo } from "./setupWizardContract";

/**
 * Ce que le serveur sait de lui-même pour l'écran du code : où il tourne, et
 * l'identifiant de son conteneur. Il ne parle JAMAIS à Docker (ni socket, ni
 * API du démon) : tout se lit dans son propre environnement et ses propres
 * fichiers.
 *
 *  - Docker et Podman posent `HOSTNAME` = l'identifiant court du conteneur
 *    (12 caractères hexadécimaux), sauf si le compose fixe un `hostname:` ;
 *  - dans ce cas, le chemin de `/etc/hostname` monté par le moteur porte
 *    l'identifiant long (`/var/lib/docker/containers/<64 hex>/hostname`,
 *    `…/overlay-containers/<64 hex>/userdata/hostname` sous Podman), lu dans
 *    `/proc/self/mountinfo`.
 */
export interface HostProbe {
  env: DeploymentEnv & { HOSTNAME?: string };
  exists: (path: string) => boolean;
  read: (path: string) => string | null;
}

const SHORT_ID = /^[0-9a-f]{12}$/;
const LONG_ID_IN_MOUNT = /\/(?:containers|overlay-containers)\/([0-9a-f]{64})\//;

function readText(path: string): string | null {
  try {
    return readFileSync(path, "utf-8");
  } catch {
    return null;
  }
}

const systemProbe = (): HostProbe => ({ env: process.env, exists: existsSync, read: readText });

export function containerIdFrom(probe: HostProbe): string | null {
  const hostname = probe.env.HOSTNAME?.trim().toLowerCase() ?? "";
  if (SHORT_ID.test(hostname)) return hostname;
  const mounts = probe.read("/proc/self/mountinfo") ?? "";
  for (const line of mounts.split("\n")) {
    if (!/\s\/etc\/hostname\s/.test(line)) continue;
    const match = LONG_ID_IN_MOUNT.exec(line);
    if (match) return match[1].slice(0, 12);
  }
  return null;
}

export function readHostInfo(probe: HostProbe = systemProbe()): SetupHostInfo {
  const deployment = readDeployment(probe.env);
  const containerized =
    deployment.deployment === "docker" || probe.exists("/.dockerenv") || probe.exists("/run/.containerenv");
  return {
    deployment: deployment.deployment,
    stack: deployment.stack,
    containerized,
    containerId: containerized ? containerIdFrom(probe) : null,
  };
}

let cached: SetupHostInfo | null = null;

/** Lu une fois par processus : rien de tout cela ne change sans redémarrage. */
export function hostInfo(): SetupHostInfo {
  cached ??= readHostInfo();
  return cached;
}
