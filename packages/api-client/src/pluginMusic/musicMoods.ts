/**
 * Les AMBIANCES de l'extension de musique (points `moods` et `mood` du contrat `music`, shared › musicMoods.ts) :
 * la liste, puis la playlist d'une ambiance. Sans les deux points : aucune requête, rien (`hasMoods`). Une réponse qui
 * n'a pas la forme vaut « rien » — jamais une erreur pour l'interface.
 */

import { hasMoods, readMusicMood, readMusicMoods, type ExternalMusicMood, type ExternalMusicMoodMix } from "@tentacle-tv/shared/music";
import { tentacleApiFetch } from "../hooks/usePreferences";
import { musicRouteUrl, type MusicProvider } from "./musicProvider";

/** La clé de cache des ambiances : par extension et par langue (les noms sont dans la langue du compte). */
export const musicMoodsKey = (pluginId: string, lang: string) => ["music", "moods", pluginId, lang] as const;
export const musicMoodKey = (pluginId: string, id: string, lang: string) => ["music", "mood", pluginId, id, lang] as const;

export async function fetchMusicMoods(provider: MusicProvider, signal?: AbortSignal): Promise<ExternalMusicMood[]> {
  if (!hasMoods(provider.music)) return [];
  return readMusicMoods(await tentacleApiFetch<unknown>(musicRouteUrl(provider, provider.music.moods), { signal }));
}

/** La playlist d'une ambiance ; `null` : l'extension n'en sert pas, ou la réponse n'a pas la forme. */
export async function fetchMusicMood(provider: MusicProvider, moodId: string, signal?: AbortSignal): Promise<ExternalMusicMoodMix | null> {
  if (!hasMoods(provider.music)) return null;
  const raw = await tentacleApiFetch<unknown>(`${musicRouteUrl(provider, provider.music.mood)}/${encodeURIComponent(moodId)}`, { signal });
  const mix = raw as Partial<ExternalMusicMoodMix> | null;
  const mood = readMusicMood(mix?.mood);
  if (!mix || !mood || !Array.isArray(mix.tracks) || typeof mix.key !== "string" || typeof mix.title !== "string") return null;
  return { ...(mix as ExternalMusicMoodMix), mood, playlists: Array.isArray(mix.playlists) ? mix.playlists : [] };
}
