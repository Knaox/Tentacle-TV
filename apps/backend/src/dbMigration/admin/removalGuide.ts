import type { SourceIdentity } from "../legacySource/sourceConfig";

/**
 * Comment RETIRER l'ancienne MariaDB, selon l'installation détectée — sans
 * jamais parler à Docker (ni socket, ni API), comme l'écran du code
 * d'installation (`setup/hostInfo.ts`) : l'environnement du serveur suffit.
 * Tentacle ne retire rien lui-même ; l'administration montre la marche à
 * suivre, l'onglet détecté en premier, les autres à côté (« dans le doute, les
 * onglets »). Rien de tout cela ne s'affiche sans une source RÉELLE : la règle
 * du tableau de bord (`removeMariadb`) exige une ancienne base configurée.
 *
 * - `official-stack` : une pile officielle d'AVANT 1.25 (`TENTACLE_STACK` full
 *   ou db) dont la base est SON service, désigné par `DB_HOST` — jamais d'après
 *   `TENTACLE_STACK` seul : la `tentacle-full` d'aujourd'hui dit aussi « full »,
 *   sans aucune base. Sa remplaçante : `newStack` ;
 * - `compose-service` : un service MariaDB de la même pile (hôte = un nom de
 *   service, dans un conteneur) — Compose, Portainer, Synology, Unraid, CasaOS ;
 * - `external` : une base sur une autre machine ou hors conteneur (adresse IP,
 *   nom de domaine, socket, installation native) — retirer ce qui la désigne,
 *   puis supprimer la base Tentacle de ce serveur, quand on le souhaite ;
 * - `unknown` : tous les onglets, sans préférence.
 */
export type RemovalKind = "official-stack" | "compose-service" | "external" | "unknown";

/** Où la source est désignée : l'environnement de la pile, ou le fichier de l'ancien assistant. */
export type SourceOrigin = "env" | "file";

/** Les deux piles d'aujourd'hui (`stacks/`). */
export type CurrentStack = "tentacle-full" | "tentacle-only";

export interface RemovalGuide {
  kind: RemovalKind;
  /** `TENTACLE_STACK`, tel quel. */
  stack: string | null;
  /** La pile d'aujourd'hui qui remplace la pile officielle d'avant : full → tentacle-full, db → tentacle-only. */
  newStack: CurrentStack | null;
  /** Le nom du service MariaDB dans la pile (`db`…), pour le retirer du compose. */
  dbService: string | null;
  origin: SourceOrigin | null;
  /** Le nom de la base Tentacle sur le serveur MariaDB, pour la commande à copier. */
  database: string;
  containerized: boolean;
}

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

function looksLikeServiceName(host: string): boolean {
  return /^[a-z0-9][a-z0-9_-]*$/i.test(host) && !IPV4.test(host) && host !== "localhost";
}

export function removalGuide(
  env: { TENTACLE_STACK?: string; DB_HOST?: string },
  identity: SourceIdentity | null,
  containerized: boolean,
  origin: SourceOrigin | null = null,
): RemovalGuide {
  const dbHost = env.DB_HOST?.trim() || "";
  const host = (origin === "env" && dbHost ? dbHost : identity?.host || "").trim();
  const stack = env.TENTACLE_STACK?.trim().toLowerCase() || null;
  const base = { stack, origin, database: identity?.database || "tentacle", containerized };
  if (origin === "env" && dbHost && (stack === "full" || stack === "db") && looksLikeServiceName(dbHost)) {
    return { ...base, kind: "official-stack", newStack: stack === "full" ? "tentacle-full" : "tentacle-only", dbService: dbHost };
  }
  if (!host) return { ...base, kind: "unknown", newStack: null, dbService: null };
  if (containerized && looksLikeServiceName(host)) return { ...base, kind: "compose-service", newStack: null, dbService: host };
  return { ...base, kind: "external", newStack: null, dbService: null };
}

/** La commande à COPIER (jamais exécutée par Tentacle) pour supprimer la base Tentacle d'un serveur MariaDB externe. */
export function dropDatabaseCommand(database: string): string {
  return `DROP DATABASE \`${database.replace(/`/g, "``")}\`;`;
}

/** La commande à COPIER pour supprimer le fichier de l'ancien assistant (son chemin, cité pour un shell POSIX). */
export function forgetSourceCommand(file: string): string {
  return /^[\w@%+=:,./-]+$/.test(file) ? `rm ${file}` : `rm '${file.replace(/'/g, `'\\''`)}'`;
}
