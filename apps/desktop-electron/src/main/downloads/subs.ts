/**
 * Sous-titres texte en side-cars.
 *
 * Téléchargés par le proxy — c'est Jellyfin qui convertit le format — et
 * enregistrés sous `media/<itemId>/subs/`. Les sous-titres IMAGE (PGS, VobSub)
 * ne sont pas convertibles en texte : hors ligne, ils n'existent qu'incrustés
 * dans une variante Allégée.
 *
 * Best-effort de bout en bout : un sous-titre manquant ne bloque jamais le
 * média.
 *
 * Portage de `apps/desktop/src-tauri/src/downloads/subs.rs`.
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { MAX_SUBTITLE_BYTES, type FetchBytes } from "./fetcher";
import { asInteger, asString, field, parseJson } from "./json";
import { safeJoin } from "./paths";

export interface SubtitleSpec {
  /** Index du `MediaStream` côté Jellyfin. */
  index: number;
  /** Format cible : `srt`, `ass` ou `vtt`. */
  format: string;
  /** Étiquette de fichier construite côté client (« fre-forced »). */
  langTag: string;
}

const FORMATS = new Set(["srt", "ass", "vtt"]);

/**
 * L'étiquette entre dans un NOM DE FICHIER : elle est re-nettoyée ici même si
 * le client l'a déjà fait. Un identifiant qui ne laisse rien devient `und`
 * plutôt qu'une chaîne vide, qui collisionnerait entre pistes.
 */
export function sanitizeTag(tag: string): string {
  const clean = [...tag]
    .filter((c) => /[A-Za-z0-9-]/.test(c))
    .slice(0, 40)
    .join("");
  return clean === "" ? "und" : clean.toLowerCase();
}

/** Analyse la liste stockée en base. Tolère un JSON abîmé. */
export function parseSpecs(json: string): SubtitleSpec[] {
  const raw = parseJson(Buffer.from(json, "utf8"));
  if (!Array.isArray(raw)) return [];
  const specs: SubtitleSpec[] = [];
  for (const entry of raw) {
    const index = asInteger(field(entry, "index"));
    const format = asString(field(entry, "format"));
    const langTag = asString(field(entry, "langTag"));
    if (index === null || format === null) continue;
    specs.push({ index, format, langTag: langTag ?? "und" });
  }
  return specs;
}

/** Chemin relatif d'un side-car. */
export function subtitleRelPath(itemId: string, spec: SubtitleSpec): string {
  return `media/${itemId}/subs/${spec.index}-${sanitizeTag(spec.langTag)}.${spec.format}`;
}

/**
 * Télécharge chaque sous-titre texte manquant. Retourne le nombre disponible
 * en fin d'opération — un fichier déjà là compte, la fonction est idempotente
 * et c'est ce qui permet à la réparation de la rappeler sans coût.
 */
export async function fetchAll(
  fetchBytes: FetchBytes,
  serverUrl: string,
  root: string,
  itemId: string,
  mediaSourceId: string,
  specs: readonly SubtitleSpec[],
): Promise<number> {
  let fetched = 0;
  for (const spec of specs) {
    if (!FORMATS.has(spec.format) || spec.index < 0) continue;

    let target: string;
    try {
      target = safeJoin(root, subtitleRelPath(itemId, spec));
    } catch {
      continue;
    }
    if (existsSync(target)) {
      fetched += 1;
      continue;
    }

    const url =
      `${serverUrl}/api/jellyfin/Videos/${itemId}/${mediaSourceId}` +
      `/Subtitles/${spec.index}/Stream.${spec.format}`;
    const bytes = await fetchBytes(url, MAX_SUBTITLE_BYTES);
    if (bytes === null || bytes.byteLength === 0) continue;

    try {
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, bytes);
      fetched += 1;
    } catch {
      // Disque plein ou droits : le média reste lisible sans ses sous-titres.
    }
  }
  return fetched;
}
