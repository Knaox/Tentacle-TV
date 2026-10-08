/**
 * Les PURGES de `core-init.sql`, rejouées ligne à ligne pendant la copie (MariaDB
 * n'est jamais modifiée) : une source qui n'est pas passée par la 1.17 garde ces
 * lignes, la base SQLite ne les reçoit pas. Une base déjà purgée n'en a aucune.
 */
import { MIGRATION_REPORT_KEY } from "../../services/database/legacySource";

type Row = Record<string, unknown>;

/**
 * La clé du rapport de migration (socle) : sa présence PROUVE qu'une base est
 * née d'une migration. Une source qui la porterait ne la fait jamais passer — la
 * migration pose la sienne après la copie.
 */
export { MIGRATION_REPORT_KEY };

/** `server_config` : clés abandonnées (1.17 : auto-play serveur, AniList, page Thème). */
export const RETIRED_CONFIG_KEYS = new Set([
  "autoplay_next_enabled",
  "anilist_client_id",
  "anilist_client_secret",
  "theme_active_name",
  "theme_active_tokens_override",
  "theme_active_css_source",
  "theme_active_css_content",
  "theme_active_css_url",
  "theme_active_css_hash",
]);

/** Le filtre d'une table, ou `undefined` : `false` écarte la ligne. */
export function legacyRowFilter(table: string): ((row: Row) => boolean) | undefined {
  switch (table) {
    case "server_config":
      return (row) => !RETIRED_CONFIG_KEYS.has(String(row.key)) && row.key !== MIGRATION_REPORT_KEY;
    case "external_accounts":
      // 1.17 : les comptes liés AniList partent (leurs jetons chiffrés avec eux).
      return (row) => row.provider !== "anilist";
    default:
      return undefined;
  }
}
