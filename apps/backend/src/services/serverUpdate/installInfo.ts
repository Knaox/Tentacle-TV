import { existsSync } from "fs";
import { SERVER_IMAGE_REPOSITORY, type ServerInstall } from "./serverUpdateContract";

/**
 * Comment le serveur tourne, tel qu'il le sait de lui-même — sans socket, sans
 * API du démon Docker, sans assistant (décision du 2026-10-03 : la carte donne
 * la commande à copier, rien ne s'exécute d'ici).
 *
 * - Le moteur : Docker pose `/.dockerenv` dans tout conteneur, Podman
 *   `/run/.containerenv`. `TENTACLE_INSTALL_RUNTIME` (docker, podman, none)
 *   force la réponse là où ces marques manquent (Kubernetes, LXC…).
 * - L'image : l'officielle, sauf déclaration `TENTACLE_IMAGE`. Son étiquette
 *   n'est connue QUE par cette déclaration — une même image porte `:latest`
 *   et `:vX.Y.Z`, rien en elle ne dit laquelle a été tirée.
 */

type Runtime = ServerInstall["runtime"];

export function detectRuntime(
  env: NodeJS.ProcessEnv = process.env,
  exists: (path: string) => boolean = existsSync,
): Runtime {
  const forced = env.TENTACLE_INSTALL_RUNTIME?.trim().toLowerCase();
  if (forced === "docker" || forced === "podman" || forced === "none") return forced;
  if (exists("/.dockerenv")) return "docker";
  if (exists("/run/.containerenv")) return "podman";
  return "none";
}

// La référence finit dans une commande que l'administrateur copie : seuls les
// caractères de la grammaire Docker passent, aucun qu'un shell interprète.
const REPOSITORY_RE = /^[a-z0-9][a-z0-9._-]*(?::\d{1,5})?(?:\/[a-z0-9][a-z0-9._-]*)+$|^[a-z0-9][a-z0-9._-]*$/;
const TAG_RE = /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$/;

/**
 * « ghcr.io/knaox/tentacle-tv:v1.22.3 » → dépôt et étiquette. Un condensé
 * (`@sha256:…`) ne dit pas d'étiquette ; une référence illisible ne dit rien.
 */
export function parseImageReference(raw: string | undefined): { repository: string; tag: string | null } | null {
  const value = raw?.trim();
  if (!value) return null;
  const digestAt = value.indexOf("@");
  const named = digestAt >= 0 ? value.slice(0, digestAt) : value;
  const colon = named.lastIndexOf(":");
  const hasTag = colon > named.lastIndexOf("/");
  const repository = (hasTag ? named.slice(0, colon) : named).toLowerCase();
  const tag = hasTag ? named.slice(colon + 1) : null;
  if (!REPOSITORY_RE.test(repository)) return null;
  if (tag !== null && !TAG_RE.test(tag)) return null;
  return { repository, tag: digestAt >= 0 ? null : tag };
}

export function readInstall(
  env: NodeJS.ProcessEnv = process.env,
  exists: (path: string) => boolean = existsSync,
): ServerInstall {
  const declared = parseImageReference(env.TENTACLE_IMAGE);
  return {
    runtime: detectRuntime(env, exists),
    repository: declared?.repository ?? SERVER_IMAGE_REPOSITORY,
    tag: declared?.tag ?? null,
  };
}
