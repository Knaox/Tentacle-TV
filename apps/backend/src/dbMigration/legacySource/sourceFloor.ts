/**
 * La plus ANCIENNE base source que la 1.25 sait reprendre : celle d'un serveur
 * 1.4.0 ou plus récent (premier serveur publié, 2026-07-12). `core-init.sql`
 * existait déjà et avait créé `share_links` et `provisioning_codes` ; le setup,
 * `server_config`. Toute transformation d'après se rejoue pendant la copie.
 *
 * Plus ancienne : la 1.25 ne sait plus parler à MariaDB (un seul provider dans le
 * client) ; elle reste sur l'écran d'attente avec ce motif, MariaDB intacte, et
 * l'administrateur passe d'abord par la 1.24 (qui met la base à niveau), puis
 * revient à la 1.25.
 */
export const OLDEST_SOURCE_VERSION = "1.4.0";

const FLOOR_MARKERS = ["server_config", "share_links", "provisioning_codes"];

export type SourceVerdict =
  | { kind: "empty" } // aucune table du cœur : une installation jamais faite, rien à reprendre
  | { kind: "too_old"; missing: string[] }
  | { kind: "supported" };

export function judgeSource(tableNames: string[], coreNames: string[]): SourceVerdict {
  const present = new Set(tableNames);
  if (!coreNames.some((n) => present.has(n))) return { kind: "empty" };
  const missing = FLOOR_MARKERS.filter((t) => !present.has(t));
  return missing.length ? { kind: "too_old", missing } : { kind: "supported" };
}
