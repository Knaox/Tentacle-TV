/**
 * Octave — les ambiances de l'extension de musique, et la playlist d'une ambiance (contrat `music` → `moods`,
 * `mood`). Sans extension qui déclare les deux points : aucune requête, rien (`enabled` faux, liste vide). La liste
 * se garde 30 minutes (l'extension la sert sans rien demander à personne) ; une ambiance ouverte se rouvre aussitôt
 * (10 minutes ici, 12 h chez l'extension). Web, bureau et mobile : l'extension et la langue passées par l'application.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { hasMoods, type ExternalMusicMood, type ExternalMusicMoodMix } from "@tentacle-tv/shared/music";
import type { MusicProvider } from "../../pluginMusic/musicProvider";
import { fetchMusicMood, fetchMusicMoods, musicMoodKey, musicMoodsKey } from "../../pluginMusic/musicMoods";

const LIST_STALE_MS = 30 * 60_000;
const MIX_STALE_MS = 10 * 60_000;

/** La langue demandée à l'extension : les deux premières lettres de celle de l'interface. */
export const moodLanguage = (language: string | undefined) => (language ?? "en").slice(0, 2);

/** Le contexte de lecture d'une ambiance (la houle de sa carte, sa vue). */
export const moodContextId = (moodId: string) => `mood:${moodId}`;

/** Les ambiances ; `[]` sans extension qui les sert (ni requête ni attente). */
export function useMusicMoods(provider: MusicProvider | null, language: string | undefined): { moods: ExternalMusicMood[]; pending: boolean } {
  const usable = hasMoods(provider?.music);
  const lang = moodLanguage(language);
  const query = useQuery<ExternalMusicMood[]>({
    queryKey: musicMoodsKey(provider?.pluginId ?? "-", lang),
    queryFn: ({ signal }) => (provider ? fetchMusicMoods(provider, lang, signal) : Promise.resolve([])),
    enabled: usable,
    staleTime: LIST_STALE_MS,
    retry: 1,
  });
  return { moods: usable ? (query.data ?? []) : [], pending: usable && query.isPending };
}

/** La playlist d'une ambiance (vue). */
export function useMusicMoodMix(provider: MusicProvider | null, moodId: string, language: string | undefined) {
  const usable = hasMoods(provider?.music);
  const lang = moodLanguage(language);
  return useQuery<ExternalMusicMoodMix | null>({
    queryKey: musicMoodKey(provider?.pluginId ?? "-", moodId, lang),
    queryFn: ({ signal }) => (provider ? fetchMusicMood(provider, moodId, lang, signal) : Promise.resolve(null)),
    enabled: usable && moodId.length > 0,
    staleTime: MIX_STALE_MS,
    retry: false,
  });
}

/** Les titres d'une ambiance À LA DEMANDE (bouton Lecture d'une carte), sous la MÊME clé que sa vue. */
export function useMusicMoodTracks(provider: MusicProvider | null, language: string | undefined) {
  const queryClient = useQueryClient();
  return useCallback(
    async (moodId: string): Promise<ExternalMusicMoodMix | null> => {
      if (!provider || !hasMoods(provider.music)) return null;
      const lang = moodLanguage(language);
      return queryClient.fetchQuery({
        queryKey: musicMoodKey(provider.pluginId, moodId, lang),
        queryFn: ({ signal }) => fetchMusicMood(provider, moodId, lang, signal),
        staleTime: MIX_STALE_MS,
      });
    },
    [provider, queryClient, language],
  );
}
