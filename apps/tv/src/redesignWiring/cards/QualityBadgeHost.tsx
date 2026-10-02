import { useMemo, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useJellyfinClient, useUserId } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { createQualityBadgeStore } from "@tentacle-tv/tv-core";
import { QualityBadgeProvider } from "../../redesign/cards/qualityBadgeSource";

/**
 * La source de la qualité des titres pour toutes les cartes de la refonte —
 * UNE pour l'app, montée sous le client et le cache de requêtes : ce qu'un
 * écran a lu sert aux autres (une grille, puis l'accueil). Neuve à chaque
 * compte : rien ne passe d'une session à l'autre.
 *
 * Une lecture = un titre, ses flux seuls (`Fields=MediaStreams`), sans images
 * ni état de lecture : quelques kilo-octets, quand le focus d'une carte a
 * tenu (`CardQualityBadges`). La fiche déjà en cache (`["item", id]`) répond
 * sans requête.
 */
export function QualityBadgeHost({ children }: { children: ReactNode }) {
  const client = useJellyfinClient();
  const userId = useUserId();
  const queryClient = useQueryClient();
  const source = useMemo(
    () =>
      createQualityBadgeStore({
        load: (id) =>
          userId
            ? client
                .fetch<{ Items?: MediaItem[] }>(`/Users/${userId}/Items?Ids=${id}&Fields=MediaStreams&EnableImages=false&EnableUserData=false`)
                .then((response) => response.Items?.[0])
            : Promise.reject(new Error("no session")),
        peekItem: (id) => queryClient.getQueryData<MediaItem>(["item", id]),
      }),
    [client, userId, queryClient],
  );
  return <QualityBadgeProvider source={source}>{children}</QualityBadgeProvider>;
}
