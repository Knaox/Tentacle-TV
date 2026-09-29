/**
 * Le pilotage de Docker pour la suite de compatibilité : un Jellyfin OFFICIEL
 * (`jellyfin/jellyfin:<version>`) et une MariaDB 11 jetables, des volumes
 * nommés, rien d'autre.
 *
 * Volumes nommés plutôt que dossiers montés : sous colima, seul le dossier
 * personnel est partagé avec la VM — un dossier temporaire du Mac n'y existe
 * pas, et Docker en créerait un vide DANS la VM sans rien dire.
 */

import { spawnSync } from "node:child_process";

export interface DockerResult {
  code: number;
  stdout: string;
  stderr: string;
}

/** Une commande docker, synchrone ; lève si elle échoue (sauf `allowFail`). */
export function docker(args: string[], opts: { allowFail?: boolean; timeoutMs?: number } = {}): DockerResult {
  const res = spawnSync("docker", args, {
    encoding: "utf8",
    timeout: opts.timeoutMs ?? 15 * 60_000,
    maxBuffer: 64 * 1024 * 1024,
  });
  const out: DockerResult = { code: res.status ?? -1, stdout: res.stdout ?? "", stderr: res.stderr ?? "" };
  if (res.error) out.stderr += String(res.error);
  if (out.code !== 0 && !opts.allowFail) {
    throw new Error(`docker ${args.slice(0, 3).join(" ")}… a échoué (${out.code}) : ${out.stderr.trim() || out.stdout.trim()}`);
  }
  return out;
}

/** Le démon répond-il ? (colima arrêté → message clair plutôt qu'une pile.) */
export function assertDockerReady(): void {
  const res = docker(["info", "--format", "{{.ServerVersion}}"], { allowFail: true, timeoutMs: 20_000 });
  if (res.code !== 0) {
    throw new Error("Docker ne répond pas. Démarrer le démon (sous macOS : `colima start`) puis relancer.");
  }
}

export type ContainerState = "running" | "stopped" | "missing";

export function containerState(name: string): ContainerState {
  const res = docker(["inspect", "-f", "{{.State.Running}}", name], { allowFail: true });
  if (res.code !== 0) return "missing";
  return res.stdout.trim() === "true" ? "running" : "stopped";
}

export function removeContainer(name: string): void {
  if (containerState(name) !== "missing") docker(["rm", "-f", "-v", name]);
}

export function removeVolume(name: string): void {
  docker(["volume", "rm", "-f", name], { allowFail: true });
}

/** L'image est-elle là ? Sinon on la tire (plusieurs centaines de Mo). */
export function ensureImage(image: string, log: (line: string) => void): void {
  if (docker(["image", "inspect", image], { allowFail: true }).code === 0) return;
  log(`Téléchargement de ${image}…`);
  docker(["pull", image]);
}

export interface JellyfinSpec {
  name: string;
  image: string;
  port: number;
  configVolume: string;
  cacheVolume: string;
  mediaVolume: string;
}

/** Lance le Jellyfin officiel ; les médias sont montés en lecture seule. */
export function startJellyfin(spec: JellyfinSpec): void {
  docker([
    "run", "-d",
    "--name", spec.name,
    "--label", "tentacle.jellyfin-compat=1",
    "-p", `127.0.0.1:${spec.port}:8096`,
    "-e", "TZ=Europe/Paris",
    "-v", `${spec.configVolume}:/config`,
    "-v", `${spec.cacheVolume}:/cache`,
    "-v", `${spec.mediaVolume}:/media:ro`,
    spec.image,
  ]);
}

export interface MariaDbSpec {
  name: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

/** La base du backend : une MariaDB 11 à part, comme la production. */
export function startMariaDb(spec: MariaDbSpec): void {
  docker([
    "run", "-d",
    "--name", spec.name,
    "--label", "tentacle.jellyfin-compat=1",
    "-p", `127.0.0.1:${spec.port}:3306`,
    "-e", `MARIADB_ROOT_PASSWORD=${spec.password}`,
    "-e", `MARIADB_DATABASE=${spec.database}`,
    "-e", `MARIADB_USER=${spec.user}`,
    "-e", `MARIADB_PASSWORD=${spec.password}`,
    "mariadb:11",
  ]);
}

/** La base accepte-t-elle des requêtes ? (script fourni par l'image officielle.) */
export function mariaDbReady(name: string): boolean {
  return docker(["exec", name, "healthcheck.sh", "--connect", "--innodb_initialized"], { allowFail: true }).code === 0;
}

/**
 * Exécute un script bash dans un conteneur éphémère de l'image Jellyfin, le
 * volume des médias monté en écriture : c'est le ffmpeg de Jellyfin qui
 * fabrique les médias, aucune dépendance côté hôte.
 */
export function runInJellyfinImage(image: string, mediaVolume: string, script: string): DockerResult {
  return docker([
    "run", "--rm",
    "--label", "tentacle.jellyfin-compat=1",
    "-v", `${mediaVolume}:/media`,
    "--entrypoint", "/bin/bash",
    image, "-c", script,
  ]);
}

/** Lit un fichier du conteneur (ex. system.xml) ; null s'il n'existe pas. */
export function readContainerFile(name: string, path: string): string | null {
  const res = docker(["exec", name, "cat", path], { allowFail: true });
  return res.code === 0 ? res.stdout : null;
}
