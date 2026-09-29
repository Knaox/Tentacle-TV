/**
 * Les pistes préférées, comme les lecteurs les résolvent : le corps que le web
 * envoie à `/api/preferences/resolve` (`useServerTrackPrefs`), une préférence
 * de bibliothèque posée le temps de la résolution, puis retirée.
 */

import type { MediaItem, MediaStream } from "../../../../../packages/shared/src/types/media";
import type { SubtitleMode } from "../../../../../packages/shared/src/preferences";
import { backendApi, ctx, okJson, tentacleClient, type ItemsPage } from "./support";

export interface PrefInput {
  audioLang?: string | null;
  subtitleLang?: string | null;
  subtitleMode?: SubtitleMode;
}

export interface Resolution {
  audioIndex: number | null;
  subtitleIndex: number | null;
}

export const streamsOf = (item: MediaItem, type: "Audio" | "Subtitle"): MediaStream[] =>
  (item.MediaSources?.[0]?.MediaStreams ?? []).filter((s) => s.Type === type);

const title = (s: MediaStream): string => [s.Title, s.DisplayTitle].filter(Boolean).join(" ");

export function resolveBody(libraryId: string, item: MediaItem) {
  return {
    libraryId,
    audioTracks: streamsOf(item, "Audio").map((s) => ({ index: s.Index, language: s.Language, isDefault: s.IsDefault, isOriginal: s.IsOriginal, title: title(s) })),
    subtitleTracks: streamsOf(item, "Subtitle").map((s) => ({ index: s.Index, language: s.Language, isForced: s.IsForced, title: title(s) })),
    originalLanguage: item.OriginalLanguage ?? null,
  };
}

export async function resolveWithPref(libraryId: string, item: MediaItem, pref: PrefInput): Promise<Resolution> {
  const token = ctx().user.token;
  await okJson(backendApi("/api/preferences", token, { method: "PUT", body: JSON.stringify({ libraryId, subtitleMode: "none", ...pref }) }), "PUT /api/preferences");
  try {
    return await okJson<Resolution>(backendApi("/api/preferences/resolve", token, { method: "POST", body: JSON.stringify(resolveBody(libraryId, item)) }), "POST /api/preferences/resolve");
  } finally {
    await backendApi(`/api/preferences/${libraryId}`, token, { method: "DELETE" });
  }
}

/** Un épisode de Cowboy Bebop, pistes comprises : S01E01 est [JA, FR], S01E02 [FR, JA]. */
export async function bebopEpisode(index: 1 | 2): Promise<MediaItem> {
  const { bebop } = ctx().fixtures.series;
  const episodes = await tentacleClient(ctx().user.token).fetch<ItemsPage<MediaItem>>(
    `/Shows/${bebop}/Episodes?userId=${ctx().user.id}&Fields=MediaSources,MediaStreams`,
  );
  const hit = episodes.Items.find((e) => e.IndexNumber === index);
  if (!hit) throw new Error(`Cowboy Bebop S01E0${index} introuvable`);
  return hit;
}

export const showsLibrary = (): string => {
  const hit = ctx().libraries.find((l) => l.name === "Séries");
  if (!hit) throw new Error("bibliothèque Séries absente");
  return hit.id;
};

export const isJapanese = (s: MediaStream): boolean => /^(jpn|ja)$/.test(s.Language ?? "");
export const isFrench = (s: MediaStream): boolean => /^fr(e|a)?$/.test(s.Language ?? "");
export const isEnglish = (s: MediaStream): boolean => /^(eng|en)$/.test(s.Language ?? "");
