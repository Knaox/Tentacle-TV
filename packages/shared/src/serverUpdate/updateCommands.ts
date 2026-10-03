import { SERVER_IMAGE_REPOSITORY, type ServerInstall } from "./serverUpdateContract";

/**
 * La commande qui met le serveur à jour, à copier en un geste — la plus juste
 * possible avec ce que le serveur sait de lui-même SANS parler à Docker : le
 * moteur (docker, podman), l'image, et l'étiquette seulement si l'installation
 * la déclare (`TENTACLE_IMAGE`). Hors conteneur : aucune commande, l'info seule.
 *
 * Deux variantes, parce que le serveur ne peut pas savoir laquelle a servi :
 * - `docker compose`, à lancer dans le dossier du fichier compose — le mode
 *   d'installation du README ;
 * - `docker run` : l'image à tirer ; le conteneur se recrée ensuite avec ses
 *   options habituelles, que le serveur ne connaît pas (les recopier dans une
 *   commande y mettrait aussi ses secrets).
 */

export interface ServerUpdateCommands {
  /** À lancer dans le dossier du fichier compose. */
  compose: string;
  /** Tire l'image visée, avant de recréer le conteneur. */
  run: string;
  /** L'image visée : dépôt et étiquette. */
  image: string;
  /**
   * L'installation fige une version (`:v1.22.3`) : `compose pull` n'irait rien
   * chercher de neuf tant que le fichier n'est pas changé. `to` : l'étiquette
   * de la dernière publiée, `null` si elle n'est pas connue.
   */
  pinned: { from: string; to: string | null } | null;
  /** L'étiquette n'est pas déclarée : la commande suppose `:latest`, celle du fichier officiel. */
  assumedTag: boolean;
}

/** « v1.22.3 », « 1.22.3 », « v1.22.2-webos-1.0.1 » : une version figée. */
const VERSION_TAG_RE = /^v?\d+\.\d+\.\d+/;

/** La nouvelle étiquette, écrite comme l'ancienne (avec ou sans `v`). */
function versionTag(version: string, like: string): string {
  return like.startsWith("v") ? `v${version}` : version;
}

export function buildUpdateCommands(install: ServerInstall, latest: string | null): ServerUpdateCommands | null {
  if (install.runtime === "none") return null;
  const cli = install.runtime === "podman" ? "podman" : "docker";
  const repository = install.repository.trim() || SERVER_IMAGE_REPOSITORY;
  const declared = install.tag?.trim() || null;
  const pinnedFrom = declared !== null && VERSION_TAG_RE.test(declared) ? declared : null;
  const target = pinnedFrom !== null ? (latest ? versionTag(latest, pinnedFrom) : null) : (declared ?? "latest");
  const image = `${repository}:${target ?? pinnedFrom}`;
  return {
    compose: `${cli} compose pull && ${cli} compose up -d`,
    run: `${cli} pull ${image}`,
    image,
    pinned: pinnedFrom !== null ? { from: pinnedFrom, to: target } : null,
    assumedTag: declared === null,
  };
}
