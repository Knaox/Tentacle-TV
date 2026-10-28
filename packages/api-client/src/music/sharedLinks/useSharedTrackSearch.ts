/**
 * Octave — un lien SHAZAM posé dans la recherche (collé au bureau et sur le web, ou arrivé par la feuille de
 * partage du téléphone) devient la recherche de SON titre. Web, bureau et mobile lisent ce crochet, la même
 * règle partout : le serveur nomme le titre (capacité `music.sharedLinks`) ; sans lui, ou s'il échoue, ce
 * que le texte dit déjà (message de Shazam, sinon slug) ; un lien court sans serveur ne donne rien.
 */

import { useQuery } from "@tanstack/react-query";
import { findShazamLink, localSharedTrackQuery, MUSIC_SHARED_TRACK_ROUTE, type SharedTrackQuery } from "@tentacle-tv/shared/music";
import { tentacleApiFetch } from "../../hooks/usePreferences";
import { useServerCapability } from "../../hooks/useServerCapabilities";

export const sharedTrackKey = (url: string) => ["music", "shared-track", url] as const;

export const sharedTrackApi = {
  resolve: (url: string, signal?: AbortSignal) => tentacleApiFetch<SharedTrackQuery>(`${MUSIC_SHARED_TRACK_ROUTE}?url=${encodeURIComponent(url)}`, { signal }),
};

export interface SharedTrackSearch {
  /** La requête est-elle un lien de titre (la recherche ne doit pas chercher le lien lui-même) ? */
  isLink: boolean;
  /** La recherche à poser à la place du lien ; `null` tant qu'on ne sait pas, ou si rien n'est trouvé. */
  resolved: SharedTrackQuery | null;
  /** On attend le serveur. */
  pending: boolean;
  /** Lien reconnu, mais aucun titre à chercher (lien court sans serveur, catalogue muet sans repli). */
  failed: boolean;
}

/** La règle, PURE : ce qu'on cherche selon ce que disent le texte et le serveur. */
export function sharedTrackSearchState(input: {
  isLink: boolean;
  local: SharedTrackQuery | null;
  capable: boolean;
  server: { status: "pending" | "success" | "error"; data?: SharedTrackQuery };
}): SharedTrackSearch {
  if (!input.isLink) return { isLink: false, resolved: null, pending: false, failed: false };
  if (input.capable && input.server.status === "pending") return { isLink: true, resolved: null, pending: true, failed: false };
  const resolved = (input.capable && input.server.status === "success" ? input.server.data : null) ?? input.local;
  return { isLink: true, resolved: resolved ?? null, pending: false, failed: !resolved };
}

export function useSharedTrackSearch(text: string | null | undefined): SharedTrackSearch {
  const capable = useServerCapability("music.sharedLinks");
  const link = findShazamLink(text);
  const query = useQuery({
    queryKey: sharedTrackKey(link?.url ?? ""),
    queryFn: ({ signal }) => sharedTrackApi.resolve(link!.url, signal),
    enabled: capable && !!link,
    staleTime: Infinity,
    gcTime: 30 * 60_000,
    retry: false,
  });
  return sharedTrackSearchState({
    isLink: !!link,
    local: link && text ? localSharedTrackQuery(text, link) : null,
    capable,
    server: { status: query.status, data: query.data },
  });
}
