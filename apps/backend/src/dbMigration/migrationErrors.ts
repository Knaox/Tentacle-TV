/**
 * Pourquoi une migration n'a pas abouti. Le MOTIF est public (l'écran d'échec en
 * tire sa phrase, sans aucun détail) ; le DÉTAIL ne va qu'au journal
 * `[db-migration]` et au rapport — des noms de tables et des comptes, jamais une
 * valeur de ligne (audit S9).
 */
export const MIGRATION_FAILURE_REASONS = [
  "source_unreachable", // MariaDB injoignable ou identifiants refusés
  "source_config", // un paramètre de l'URL de la base que la copie ne sait pas honorer
  "source_too_old", // base d'avant la 1.4.0 : passer d'abord par la 1.24
  "source_missing", // l'installation avait une MariaDB, plus configurée (pile mise à jour trop tôt)
  "disk_space", // pas assez de place dans le dossier de données
  "unsafe_path", // un lien symbolique là où la base doit être un fichier
  "copy_failed", // une table n'a pas pu être copiée
  "verification_failed", // la base copiée ne concorde pas avec la source
  "unknown",
] as const;

/** Liste FERMÉE, la même que `DATABASE_MIGRATION_REASONS` des clients (test miroir). */
export type MigrationFailureReason = (typeof MIGRATION_FAILURE_REASONS)[number];

export class MigrationFailure extends Error {
  constructor(
    readonly reason: MigrationFailureReason,
    /** Pour le journal seulement. */
    readonly detail: string,
  ) {
    super(`${reason}: ${detail}`);
    this.name = "MigrationFailure";
  }
}

/**
 * Le message d'une erreur QUELCONQUE (pilote, SQLite, système), nettoyé pour le
 * journal : code d'erreur, et les littéraux entre apostrophes ou guillemets
 * remplacés — un message de pilote peut citer une valeur de clé.
 */
export function sanitizeError(err: unknown): string {
  const e = err as { code?: unknown; errno?: unknown; message?: unknown } | null;
  const code = e && typeof e.code === "string" ? e.code : e && typeof e.errno === "number" ? `errno ${e.errno}` : null;
  const message = String(e?.message ?? err ?? "")
    .replace(/'(?:[^'\\]|\\.)*'/g, "'…'")
    .replace(/"(?:[^"\\]|\\.)*"/g, '"…"')
    .replace(/\s+/g, " ")
    .slice(0, 300);
  return code ? `${code} — ${message}` : message;
}

export function failureOf(err: unknown, fallback: MigrationFailureReason = "unknown"): MigrationFailure {
  if (err instanceof MigrationFailure) return err;
  return new MigrationFailure(fallback, sanitizeError(err));
}
