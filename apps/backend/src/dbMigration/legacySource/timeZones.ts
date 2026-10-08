/**
 * Le FUSEAU des dates de la source (docs/sqlite/GENERIC-COPY.md, « Le fuseau des
 * dates »). Prisma écrit l'UTC ; le SQL brut d'une extension (`NOW()`, défauts de
 * colonne) écrit dans le fuseau de la session MariaDB. La copie lit en UTC et
 * convertit les colonnes « session » depuis le fuseau de la source.
 */
export type ZonePolicy = "utc" | "session";

/** Tables du cœur écrites par une extension avec `NOW()` : le cœur ne fait que les lire. */
const SESSION_IN_CORE: Record<string, string[]> = {
  content_claims: ["expiresAt"],
};

/** Colonnes d'extension écrites en UTC (une `Date` JS liée par Prisma). */
const UTC_IN_EXTENSIONS: Record<string, string[]> = {
  seer_user_settings: ["jellyseerr_last_sync"],
  seer_tmdb_cache: ["expires_at"],
};

export function zonePolicy(table: string, column: string, isCoreTable: boolean): ZonePolicy {
  if (isCoreTable) return SESSION_IN_CORE[table]?.includes(column) ? "session" : "utc";
  return UTC_IN_EXTENSIONS[table]?.includes(column) ? "utc" : "session";
}

const UTC_NAMES = new Set(["+00:00", "-00:00", "utc", "etc/utc", "gmt", "etc/gmt", "z", "universal", "zulu"]);

/**
 * Le fuseau de la source, tel que `CONVERT_TZ` l'accepte, ou `null` quand il vaut
 * UTC (aucune conversion). `SYSTEM` reste `SYSTEM` : MariaDB applique alors le
 * fuseau du système, heure d'été comprise (mesuré sur une source Europe/Paris).
 */
export function sourceZoneForConversion(sessionZone: string, systemZone: string): string | null {
  const session = sessionZone.trim();
  if (session.toUpperCase() === "SYSTEM") return UTC_NAMES.has(systemZone.trim().toLowerCase()) ? null : "SYSTEM";
  return UTC_NAMES.has(session.toLowerCase()) ? null : session;
}
