/**
 * Octave — ce que les lecteurs de sources partagent : nettoyer un champ,
 * borner une liste, refuser en mots fermés. Un lecteur rend une
 * `ImportedPlaylist` ou lève `ImportReadFailure`.
 */

import { MUSIC_IMPORT_LIMITS, type ImportedTrack, type MusicImportFailure } from "../../contract/musicImport";

export class ImportReadFailure extends Error {
  constructor(readonly failure: MusicImportFailure) {
    super(`import read failed: ${failure}`);
  }
}

/** Un texte de la source, sans espaces de bord ni caractères de contrôle, borné ; `null` s'il est vide. */
export function field(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const visible = Array.from(value, (c) => (c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127 ? " " : c)).join("");
  // NFC : Deezer rend des accents DÉCOMPOSÉS (« à » en deux points de code, relevé du 26/10).
  const text = visible.normalize("NFC").replace(/\s+/g, " ").trim();
  return text.length > 0 ? text.slice(0, MUSIC_IMPORT_LIMITS.field) : null;
}

export function artistList(names: readonly unknown[]): string[] {
  const out: string[] = [];
  for (const raw of names) {
    const name = field(raw);
    if (name && !out.includes(name)) out.push(name);
    if (out.length >= MUSIC_IMPORT_LIMITS.artists) break;
  }
  return out;
}

export function durationOf(ms: unknown): number | null {
  return typeof ms === "number" && Number.isFinite(ms) && ms > 0 && ms < 24 * 3_600_000 ? Math.round(ms) : null;
}

const ISRC = /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/;

export function isrcOf(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const code = value.replace(/-/g, "").trim().toUpperCase();
  return ISRC.test(code) ? code : null;
}

/** Une liste de titres numérotée dans l'ordre, sans titre vide, bornée au plafond. */
export function numbered(tracks: readonly Omit<ImportedTrack, "index">[]): { tracks: ImportedTrack[]; truncated: boolean } {
  const kept = tracks.filter((t) => t.title.length > 0);
  const capped = kept.slice(0, MUSIC_IMPORT_LIMITS.tracks);
  return { tracks: capped.map((t, index) => ({ ...t, index })), truncated: kept.length > capped.length };
}

/** Le JSON d'un `<script id="…" type="application/json">` d'une page (Spotify, Apple). */
export function scriptJson(html: string, id: string): unknown {
  const at = html.indexOf(`id="${id}"`);
  if (at < 0) return null;
  const open = html.indexOf(">", at);
  const close = html.indexOf("</script>", open);
  if (open < 0 || close < 0) return null;
  try {
    return JSON.parse(html.slice(open + 1, close));
  } catch {
    return null;
  }
}

export function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

export function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}
