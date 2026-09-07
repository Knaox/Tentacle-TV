/**
 * Le choix de pistes qu'exprime un changement EXPLICITE dans le lecteur —
 * des LANGUES, jamais des index (ils changent entre lecture directe et
 * transcodage, et les pistes externes sont décalées en lecture locale), et le
 * mode de sous-titres déduit de la piste retenue (forcés, « signs », complets).
 * La règle du web (`useRememberItemTracks`), partagée avec le mobile.
 */

import type { MediaStream } from "./types/media";

export type ItemTrackChoiceMode = "none" | "always" | "forced" | "signs";

export interface ItemTrackChoice {
  audioLang: string | null;
  subtitleLang: string | null;
  subtitleMode: ItemTrackChoiceMode;
}

const FORCED_RE = /\bforc(ed|é)e?s?\b/i;
const SIGNS_RE = /\b(signs?|songs?)\b/i;

export function itemTrackChoiceFromStreams(
  streams: readonly MediaStream[],
  audioIndex: number,
  subtitleIndex: number | null,
): ItemTrackChoice {
  const audioLang = streams.find((s) => s.Type === "Audio" && s.Index === audioIndex)?.Language ?? null;
  if (subtitleIndex === null || subtitleIndex < 0) return { audioLang, subtitleLang: null, subtitleMode: "none" };
  const sub = streams.find((s) => s.Type === "Subtitle" && s.Index === subtitleIndex);
  const title = [sub?.Title, sub?.DisplayTitle].filter(Boolean).join(" ");
  const forced = sub?.IsForced === true || FORCED_RE.test(title);
  const signs = SIGNS_RE.test(title);
  return {
    audioLang,
    subtitleLang: sub?.Language ?? null,
    subtitleMode: signs ? "signs" : forced ? "forced" : "always",
  };
}
