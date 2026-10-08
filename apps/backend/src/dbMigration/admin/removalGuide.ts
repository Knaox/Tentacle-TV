import type { SourceIdentity } from "../legacySource/sourceConfig";

/**
 * Comment RETIRER l'ancienne MariaDB, selon l'installation détectée — sans
 * jamais parler à Docker (ni socket, ni API), comme l'écran du code
 * d'installation (`setup/hostInfo.ts`) : l'environnement du serveur suffit.
 * Tentacle ne retire rien lui-même ; l'administration montre la marche à
 * suivre, l'onglet détecté en premier, les autres à côté (« dans le doute, les
 * onglets »).
 *
 * - `official-stack` : une pile officielle (`TENTACLE_STACK` full ou db) — sa
 *   nouvelle version n'a plus de service `db` ;
 * - `compose-service` : un service MariaDB de la même pile (hôte = un nom de
 *   service, dans un conteneur) — Compose, Portainer, Synology, Unraid, CasaOS ;
 * - `external` : une base sur une autre machine ou hors conteneur (adresse IP,
 *   nom de domaine, socket, installation native) — retirer les variables, puis
 *   supprimer la base Tentacle de ce serveur, quand on le souhaite ;
 * - `unknown` : tous les onglets, sans préférence.
 */
export type RemovalKind = "official-stack" | "compose-service" | "external" | "unknown";

export interface RemovalGuide {
  kind: RemovalKind;
  /** `full` / `db` d'une pile officielle. */
  stack: string | null;
  /** Le nom du service MariaDB dans la pile (`db`…), pour le retirer du compose. */
  dbService: string | null;
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
): RemovalGuide {
  const host = (env.DB_HOST || identity?.host || "").trim();
  const database = identity?.database || "tentacle";
  const stack = env.TENTACLE_STACK?.trim().toLowerCase() || null;
  if (stack === "full" || stack === "db") {
    return { kind: "official-stack", stack, dbService: looksLikeServiceName(host) ? host : "db", database, containerized };
  }
  if (!host) return { kind: "unknown", stack, dbService: null, database, containerized };
  if (containerized && looksLikeServiceName(host)) return { kind: "compose-service", stack, dbService: host, database, containerized };
  return { kind: "external", stack, dbService: null, database, containerized };
}

/** La commande à COPIER (jamais exécutée par Tentacle) pour supprimer la base Tentacle d'un serveur MariaDB externe. */
export function dropDatabaseCommand(database: string): string {
  return `DROP DATABASE \`${database.replace(/`/g, "``")}\`;`;
}
