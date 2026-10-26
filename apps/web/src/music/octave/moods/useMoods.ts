/**
 * Octave — les ambiances de l'extension de musique, et la playlist d'une ambiance (contrat `music` → `moods`,
 * `mood`). Sans extension qui déclare les deux points : aucune requête, rien (`enabled` faux, liste vide). La liste
 * se garde 30 minutes (l'extension la sert sans rien demander à personne) ; une ambiance ouverte se rouvre aussitôt
 * (10 minutes ici, 12 h chez l'extension).
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { fetchMusicMood, fetchMusicMoods, musicMoodKey, musicMoodsKey } from "@tentacle-tv/api-client";
import { hasMoods, type ExternalMusicMood, type ExternalMusicMoodMix } from "@tentacle-tv/shared/music";
import { useOctaveProvider } from "../mode/useOctaveProvider";

const LIST_STALE_MS = 30 * 60_000;
const MIX_STALE_MS = 10 * 60_000;

const langOf = (language: string | undefined) => (language ?? "en").slice(0, 2);

/** Les ambiances ; `[]` sans extension qui les sert (ni requête ni attente). */
export function useMoods(): { moods: ExternalMusicMood[]; pending: boolean } {
  const provider = useOctaveProvider();
  const { i18n } = useTranslation();
  const usable = hasMoods(provider?.music);
  const lang = langOf(i18n.language);
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
export function useMoodMix(moodId: string) {
  const provider = useOctaveProvider();
  const { i18n } = useTranslation();
  const usable = hasMoods(provider?.music);
  const lang = langOf(i18n.language);
  return useQuery<ExternalMusicMoodMix | null>({
    queryKey: musicMoodKey(provider?.pluginId ?? "-", moodId, lang),
    queryFn: ({ signal }) => (provider ? fetchMusicMood(provider, moodId, lang, signal) : Promise.resolve(null)),
    enabled: usable && moodId.length > 0,
    staleTime: MIX_STALE_MS,
    retry: false,
  });
}

/** Les titres d'une ambiance À LA DEMANDE (bouton Lecture d'une carte), sous la MÊME clé que sa vue. */
export function useMoodTracks() {
  const provider = useOctaveProvider();
  const queryClient = useQueryClient();
  const { i18n } = useTranslation();
  return useCallback(
    async (moodId: string): Promise<ExternalMusicMoodMix | null> => {
      if (!provider || !hasMoods(provider.music)) return null;
      const lang = langOf(i18n.language);
      return queryClient.fetchQuery({
        queryKey: musicMoodKey(provider.pluginId, moodId, lang),
        queryFn: ({ signal }) => fetchMusicMood(provider, moodId, lang, signal),
        staleTime: MIX_STALE_MS,
      });
    },
    [provider, queryClient, i18n.language],
  );
}
