/**
 * Ce que devient chaque table de la source.
 *
 * - CŒUR : un modèle de `schema.prisma` (nom exact) — copié vers la table que les
 *   migrations du socle ont créée.
 * - ANCIEN CŒUR : une table que le cœur a créée puis abandonnée — non reprise
 *   (elle reste dans MariaDB, intacte), dite au rapport.
 * - EXTENSION : tout le reste — recopiée entière (docs/sqlite/GENERIC-COPY.md).
 * - REFUSÉE : une table qui se ferait passer pour une table de la cible (nom égal
 *   en minuscules, SQLite ignore la casse des noms) ou deux tables de la source qui
 *   ne diffèrent que par la casse. Sinon une source pourrait faire croire des
 *   migrations déjà faites.
 */
export const RETIRED_CORE_TABLES = new Set([
  "anime_id_map", // 1.17 : AniList retiré
  "media_audio_fingerprint", // 2026-09 : empreintes gardées en mémoire
  "media_requests", // avant Vigie
  "shared_watchlists", // avant les liens de partage
  "shared_watchlist_items",
  "shared_watchlist_members",
  "_prisma_migrations", // une base de développement passée par `prisma migrate dev`
]);

/** Tables que l'HÔTE tient lui-même : elles naissent vides, jamais recopiées d'une source. */
export const HOST_BOOKKEEPING_TABLES = new Set(["core_migrations", "plugin_migrations"]);

export type TableFate =
  | { name: string; fate: "core" }
  | { name: string; fate: "extension" }
  | { name: string; fate: "retired" }
  | { name: string; fate: "refused"; reason: "host_table" | "name_collision" | "case_duplicate" };

export function classifyTables(sourceNames: string[], coreNames: string[], targetNames: string[]): TableFate[] {
  const core = new Set(coreNames);
  const reserved = new Set([...coreNames, ...targetNames, ...HOST_BOOKKEEPING_TABLES].map((n) => n.toLowerCase()));
  const byLower = new Map<string, string[]>();
  for (const name of sourceNames) {
    const list = byLower.get(name.toLowerCase()) ?? [];
    list.push(name);
    byLower.set(name.toLowerCase(), list);
  }
  return sourceNames.map((name): TableFate => {
    const lower = name.toLowerCase();
    if (HOST_BOOKKEEPING_TABLES.has(lower)) return { name, fate: "refused", reason: "host_table" };
    if (core.has(name)) return { name, fate: "core" };
    if (RETIRED_CORE_TABLES.has(name)) return { name, fate: "retired" };
    if (reserved.has(lower) || lower.startsWith("sqlite_")) return { name, fate: "refused", reason: "name_collision" };
    if ((byLower.get(lower) ?? []).length > 1) return { name, fate: "refused", reason: "case_duplicate" };
    return { name, fate: "extension" };
  });
}
