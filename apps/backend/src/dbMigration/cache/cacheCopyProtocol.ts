/**
 * Ce que se disent le serveur et l'enfant de la copie de fond du cache, et les
 * deux clés de `server_config` qu'elle tient : le curseur de reprise et le
 * marqueur de fin (sa date). Ni l'un ni l'autre ne porte une valeur de ligne au
 * sens d'une donnée de compte : une clé de cache (type, identifiant TMDB).
 */
export const CACHE_CURSOR_KEY = "sqlite_migration_cache_cursor";
export const CACHE_DONE_KEY = "sqlite_migration_cache_done";

export interface CacheChildConfig {
  path: string;
  url: string;
  tables: string[];
  /** Lignes par transaction : ~50 lignes du cache TMDB ≈ 2 Mo. */
  batchRows: number;
  /** Pause entre deux lots : le serveur vivant écrit entre-temps. */
  pauseMs: number;
}

export type CacheChildMessage =
  | { kind: "progress"; table: string; done: number; total: number }
  | { kind: "done" }
  | { kind: "stopped"; reason: string };
