/**
 * Ce que les pistes en cours disent du choix de l'utilisateur : des LANGUES et
 * un mode de sous-titres, jamais des index (ils changent entre lecture directe,
 * transcodage et lecture locale).
 *
 * Une seule règle pour « Appliquer à cette série » et pour la mémoire propre à
 * chaque contenu. Deux pièges qu'elle tient :
 * - en lecture locale, un sous-titre EXTERNE (side-car) porte l'index Jellyfin
 *   décalé de `SIDECAR_INDEX_BASE` : absent des flux, sa langue était perdue,
 *   et la préférence enregistrée ne retrouvait plus aucun sous-titre ;
 * - le mode garde sa finesse (`forced`, `signs`) : réduit à « toujours », une
 *   piste forcée devenait des sous-titres complets à l'épisode suivant.
 */

import type { MediaStream as JfStream } from "@tentacle-tv/shared";
import { parseSideCarFileName } from "@tentacle-tv/offline-core";
import { SIDECAR_INDEX_BASE, isSideCarIndex } from "./localPlaybackTrackSources";

export type SubtitleMode = "none" | "always" | "forced" | "signs";

export interface TrackChoice {
  audioLang: string | null;
  subtitleLang: string | null;
  subtitleMode: SubtitleMode;
}

interface SubtitleFacts {
  lang: string | null;
  forced: boolean;
  title: string;
}

const FORCED_TITLE = /\bforc(ed|é)e?s?(?![a-z0-9_à-öø-ÿ])/i;
const SIGNS_TITLE = /\b(sign|songs)\b/i;

function factsOfStream(stream: JfStream): SubtitleFacts {
  return {
    lang: stream.Language ?? null,
    forced: !!stream.IsForced,
    title: [stream.Title, stream.DisplayTitle].filter(Boolean).join(" "),
  };
}

function subtitleFacts(
  streams: readonly JfStream[],
  subtitleIndex: number,
  sideCars: ReadonlyArray<{ fileName: string }>,
): SubtitleFacts | null {
  const direct = streams.find((s) => s.Type === "Subtitle" && s.Index === subtitleIndex);
  if (direct) return factsOfStream(direct);
  if (!isSideCarIndex(subtitleIndex)) return null;
  // Side-car : l'index Jellyfin d'origine, d'abord dans les flux (snapshot),
  // sinon dans le nom du fichier (`<index>-<langue>[.forced].<ext>`).
  const jfIndex = subtitleIndex - SIDECAR_INDEX_BASE;
  const origin = streams.find((s) => s.Type === "Subtitle" && s.Index === jfIndex);
  if (origin?.Language) return factsOfStream(origin);
  const title = origin ? factsOfStream(origin).title : "";
  for (const file of sideCars) {
    const parsed = parseSideCarFileName(file.fileName);
    if (parsed?.jfIndex !== jfIndex) continue;
    // « und » : le fichier ne dit pas sa langue.
    return { lang: parsed.lang === "und" ? null : parsed.lang, forced: parsed.forced, title };
  }
  return origin ? factsOfStream(origin) : null;
}

export function trackChoiceOf({
  streams,
  audioIndex,
  subtitleIndex,
  sideCars = [],
}: {
  streams: readonly JfStream[];
  audioIndex: number;
  subtitleIndex: number | null;
  /** Side-cars de la lecture locale (`LocalSource.subtitleFiles`). */
  sideCars?: ReadonlyArray<{ fileName: string }>;
}): TrackChoice {
  const audioLang = streams.find((s) => s.Type === "Audio" && s.Index === audioIndex)?.Language ?? null;
  if (subtitleIndex === null) return { audioLang, subtitleLang: null, subtitleMode: "none" };
  const facts = subtitleFacts(streams, subtitleIndex, sideCars);
  const forced = !!facts?.forced || FORCED_TITLE.test(facts?.title ?? "");
  const signs = SIGNS_TITLE.test(facts?.title ?? "");
  return {
    audioLang,
    subtitleLang: facts?.lang ?? null,
    subtitleMode: signs ? "signs" : forced ? "forced" : "always",
  };
}

export function sameTrackChoice(a: TrackChoice, b: TrackChoice): boolean {
  return a.audioLang === b.audioLang && a.subtitleLang === b.subtitleLang && a.subtitleMode === b.subtitleMode;
}
