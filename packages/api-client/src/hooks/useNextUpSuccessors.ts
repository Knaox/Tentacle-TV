/**
 * Le VRAI successeur d'une dernière lecture, quand `/Shows/NextUp` se trompe.
 *
 * Jellyfin repropose parfois un épisode situé DERRIÈRE la dernière lecture —
 * mesuré sur une série de 1 434 épisodes dont dix, épars, étaient marqués vus
 * en saison 2 : il rendait S01E01. La règle du produit dit le successeur de ce
 * qu'on vient de regarder ; il faut donc aller le chercher.
 *
 * `startItemId` fait exactement cela, en UNE requête par série fautive
 * (mesuré : 102 ms). Et il n'y en a aucune quand le serveur est déjà d'accord,
 * ce qui est le cas courant — la dépense n'existe que là où il y a un défaut à
 * réparer. Le vivier « épisodes non vus » de l'accueil, lui, ne peut pas
 * répondre : trié globalement par saison puis numéro, il ne contient jamais un
 * successeur au-delà de la saison 1.
 *
 * On demande quatre épisodes et non deux : le premier est l'ancre elle-même, et
 * le suivant peut avoir été vu (on ne regarde pas toujours dans l'ordre).
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { MediaItem } from "@tentacle-tv/shared";
import { useJellyfinClient } from "./useJellyfinClient";
import { useUserId } from "./useUserId";
import type { StaleSuggestion } from "../utils/mediaFilters";

/** Assez pour dépasser l'ancre et un ou deux épisodes déjà vus derrière elle. */
const WINDOW = 4;

/**
 * @returns `SeriesId → successeur`, ou `null` quand il n'y a rien après.
 *          Une série absente de la table n'est pas encore résolue.
 */
export function useNextUpSuccessors(stale: StaleSuggestion[]): Map<string, MediaItem | null> {
  const client = useJellyfinClient();
  const userId = useUserId();

  // La clé porte le COUPLE série+ancre : marquer un épisode de plus déplace
  // l'ancre, et la réponse d'avant ne vaut plus.
  const signature = stale.map((s) => `${s.seriesId}:${s.anchor.Id}`).join(",");

  const { data } = useQuery({
    queryKey: ["next-up", "successors", signature],
    enabled: !!userId && stale.length > 0,
    staleTime: 60_000,
    // Une seule tentative : le carrousel se passe très bien de la série
    // fautive, il ne doit pas s'acharner pour elle.
    retry: 1,
    queryFn: async () => {
      const pairs = await Promise.all(
        stale.map(async ({ seriesId, anchor }): Promise<[string, MediaItem | null]> => {
          try {
            const res = await client.fetch<{ Items: MediaItem[] }>(
              `/Shows/${seriesId}/Episodes?userId=${userId}&startItemId=${anchor.Id}` +
                `&limit=${WINDOW}&Fields=PrimaryImageAspectRatio,MediaSources` +
                `&EnableImageTypes=Primary,Backdrop,Thumb&ImageTypeLimit=1&EnableUserData=true`,
            );
            const next = (res.Items ?? []).find(
              (ep) => ep.Id !== anchor.Id && ep.UserData?.Played !== true,
            );
            return [seriesId, next ?? null];
          } catch {
            // Série injoignable : elle reste non résolue, donc retirée.
            return [seriesId, null];
          }
        }),
      );
      return pairs;
    },
  });

  // Identité STABLE : la table part en dépendance d'un `useMemo` chez
  // l'appelant, et une Map neuve à chaque rendu y ferait tout recalculer.
  return useMemo(() => new Map(data ?? []), [data]);
}
