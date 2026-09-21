/**
 * Les pistes de sous-titres d'une lecture LOCALE par le lecteur avancé. Le
 * snapshot `item.json` fait autorité (index Jellyfin, noms comme en ligne) ;
 * un side-car EXTERNE s'ajoute au moteur par son fichier, dans son format
 * d'origine ; une piste INTÉGRÉE se lit dans le fichier lui-même — sauf quand
 * le fichier gardé est une variante recompressée (MP4 sans sous-titres), où
 * tous les side-cars sont des pistes à ajouter.
 */

import type { MediaStream as JfStream } from "@tentacle-tv/shared";
import { parseSideCarFileName, type ParsedSideCar } from "@tentacle-tv/offline-core";
import type { ExternalSubtitleSource } from "@/player/engine/types";

export interface LocalSideCar {
  uri: string;
  fileName: string;
  parsed: ParsedSideCar;
}

/** Les side-cars dont le nom se lit, quel que soit leur format. */
export function parseSideCars(files: ReadonlyArray<{ uri: string; fileName: string }>): LocalSideCar[] {
  return files.flatMap((file) => {
    const parsed = parseSideCarFileName(file.fileName);
    return parsed === null ? [] : [{ ...file, parsed }];
  });
}

function isEngineFormat(format: string): format is ExternalSubtitleSource["format"] {
  return format === "ass" || format === "srt" || format === "vtt";
}

/**
 * Ce que le lecteur avancé doit AJOUTER : les side-cars des pistes externes
 * (ou de toutes, quand le fichier gardé n'embarque aucune piste).
 */
export function mpvExternalSubtitles(
  streams: readonly JfStream[],
  sideCars: readonly LocalSideCar[],
  embeddedInFile: boolean,
): ExternalSubtitleSource[] {
  return sideCars.flatMap((file) => {
    if (!isEngineFormat(file.parsed.format)) return [];
    const stream = streams.find((s) => s.Type === "Subtitle" && s.Index === file.parsed.jfIndex);
    // Une piste intégrée que le fichier porte encore : mpv la lit lui-même, le side-car la doublerait.
    if (embeddedInFile && stream !== undefined && stream.IsExternal !== true) return [];
    return [{ jellyfinIndex: file.parsed.jfIndex, url: file.uri, format: file.parsed.format }];
  });
}

/** Les sous-titres que le lecteur avancé peut offrir : ceux du fichier, et ceux ajoutés. */
export function mpvSubtitleStreams(
  streams: readonly JfStream[],
  externals: readonly ExternalSubtitleSource[],
  embeddedInFile: boolean,
): JfStream[] {
  return streams.filter((s) => {
    if (s.Type !== "Subtitle" || typeof s.Index !== "number") return false;
    if (externals.some((e) => e.jellyfinIndex === s.Index)) return true;
    return embeddedInFile && s.IsExternal !== true;
  });
}
