/**
 * Octave — les clés stables d'un titre (contrat, docs/octave/CONTRATS.md).
 *
 * `jf:<itemId>` pour la bibliothèque, `ext:<pluginId>:<externalId>` hors
 * bibliothèque. L'identifiant externe est OPAQUE : le cœur ne l'analyse jamais,
 * il le rend tel quel à l'extension qui l'a donné.
 */

import type { ExternalRef } from "./musicTypes";

const PLUGIN_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
/** Un identifiant externe : imprimable, sans espace, borné (il voyage dans des URL). */
const EXTERNAL_ID = /^[A-Za-z0-9._~:@-]{1,200}$/;

export function libraryTrackKey(jellyfinId: string): string {
  return `jf:${jellyfinId}`;
}

export function externalTrackKey(ref: ExternalRef): string {
  return `ext:${ref.pluginId}:${ref.id}`;
}

export type ParsedTrackKey =
  | { kind: "library"; jellyfinId: string }
  | { kind: "external"; ref: ExternalRef };

/** `null` pour une clé mal formée — jamais une exception. */
export function parseTrackKey(key: string): ParsedTrackKey | null {
  if (key.startsWith("jf:")) {
    const id = key.slice(3);
    return /^[A-Za-z0-9-]{1,64}$/.test(id) ? { kind: "library", jellyfinId: id } : null;
  }
  if (!key.startsWith("ext:")) return null;
  const rest = key.slice(4);
  const sep = rest.indexOf(":");
  if (sep <= 0) return null;
  const pluginId = rest.slice(0, sep);
  const id = rest.slice(sep + 1);
  return isValidExternalRef({ pluginId, id }) ? { kind: "external", ref: { pluginId, id } } : null;
}

export function isValidExternalRef(ref: ExternalRef): boolean {
  return PLUGIN_ID.test(ref.pluginId) && EXTERNAL_ID.test(ref.id);
}

/** Un MBID bien formé (UUID), normalisé en minuscules ; `null` sinon. */
export function normalizeMbid(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v) ? v : null;
}
