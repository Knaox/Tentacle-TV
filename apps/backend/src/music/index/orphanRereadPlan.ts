/**
 * Octave — QUELS titres sans album faire relire par Jellyfin, et quand (pur).
 *
 * Un fichier lu par Jellyfin AVANT que Lidarr n'écrive ses tags reste rangé
 * sous son nom de fichier, sans album (« Shout », Songs From the Big Chair,
 * relevé du 27/10) ; un dossier dont Jellyfin n'a vu qu'une partie des
 * fichiers aussi. Le serveur le lui fait relire : peu à la fois, jamais deux
 * fois de suite le même titre (un fichier vraiment sans album n'est relu
 * qu'une fois par semaine), le plus récent d'abord.
 */

/** Le temps de laisser Lidarr finir (déplacement, tags) après une arrivée, avant de relire. */
export const ORPHAN_REREAD_DELAY_MS = 2 * 60_000;
/** Un titre relu sans résultat ne se relit qu'une semaine plus tard. */
export const ORPHAN_REREAD_RETRY_MS = 7 * 24 * 3_600_000;
/** Au plus par passage : Jellyfin met chaque relecture en file. */
export const ORPHAN_REREAD_PER_PASS = 25;
/** Mémoire des essais (`server_config`), bornée. */
export const ORPHAN_REREAD_REMEMBERED = 5_000;

/** `id → ms` du dernier essai. */
export type RereadAttempts = Record<string, number>;

export function parseAttempts(raw: string | undefined): RereadAttempts {
  if (!raw) return {};
  try {
    const value = JSON.parse(raw) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).filter((e): e is [string, number] => typeof e[1] === "number"));
  } catch {
    return {};
  }
}

/** Les titres à relire maintenant : `orphans` du plus récent au plus ancien, ceux qui n'ont pas été essayés depuis une semaine. */
export function pickOrphans(orphans: readonly string[], attempts: RereadAttempts, now: number, limit = ORPHAN_REREAD_PER_PASS): string[] {
  return orphans.filter((id) => now - (attempts[id] ?? -Infinity) >= ORPHAN_REREAD_RETRY_MS).slice(0, limit);
}

/** La mémoire après un passage : les essais de `picked` notés, les titres partis de la liste (relus avec succès) oubliés. */
export function nextAttempts(attempts: RereadAttempts, orphans: readonly string[], picked: readonly string[], now: number): RereadAttempts {
  const still = new Set(orphans);
  const kept = Object.entries(attempts).filter(([id]) => still.has(id));
  for (const id of picked) kept.push([id, now]);
  return Object.fromEntries(kept.sort((a, b) => a[1] - b[1]).slice(-ORPHAN_REREAD_REMEMBERED));
}

/** Le dossier d'un fichier (« / » ou « \\ » : Jellyfin sous Windows) ; `null` à la racine. */
export function folderOf(path: string): string | null {
  const cut = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return cut > 0 ? path.slice(0, cut) : null;
}
