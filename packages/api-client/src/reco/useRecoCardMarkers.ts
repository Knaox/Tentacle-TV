import { useMemo } from "react";
import type { CardMarkers, MediaItem } from "@tentacle-tv/shared";
import type { RecoRowItem } from "../hooks/recoTypes";
import { useCardMarkers } from "../hooks/useCardMarkers";
import { useMediaItem } from "../hooks/useLibrary";

type RecoMarkerSource = Pick<RecoRowItem, "key" | "mediaType" | "tmdbId" | "title" | "jellyfinItemId">;

/**
 * Le visage `MediaItem` d'une recommandation, pour le modèle UNIQUE des
 * marqueurs de carte (`resolveCardMarkers`) : un titre recommandé n'est pas un
 * item Jellyfin, mais il en a ce qu'il faut pour se retrouver dans les caches.
 *
 *   • `Id` = l'item Jellyfin quand le titre est en bibliothèque : la série se
 *     retrouve dans les Sets « Ma liste » / favoris, la note par son item ;
 *   • `ProviderIds.Tmdb` : la note posée depuis la carte (clé tmdb) se
 *     retrouve même hors bibliothèque ;
 *   • hors bibliothèque, un `Id` qui ne peut désigner aucun item (`reco:…`).
 *
 * Aucun `UserData` inventé : un film ne dit « dans Ma liste » que si sa fiche
 * est en cache (cf. `useRecoCardMarkers`).
 */
export function recoMarkerItem(item: RecoMarkerSource): MediaItem {
  return {
    Id: item.jellyfinItemId ?? `reco:${item.key}`,
    Name: item.title,
    Type: item.mediaType === "tv" ? "Series" : "Movie",
    ProviderIds: { Tmdb: String(item.tmdbId) },
  } as MediaItem;
}

/**
 * Les marqueurs d'une carte de recommandation — le même fond que toutes les
 * cartes (note globale + la vôtre, Ma liste, favori, vu), pour le même rendu.
 *
 * Une recommandation arrive sans état : le moteur écarte ce qu'on a vu, noté,
 * aimé ou mis de côté. Les marqueurs disent donc surtout ce qu'on fait PENDANT
 * la visite — noter depuis le survol, ajouter à Ma liste depuis le plateau —
 * sans attendre la prochaine génération de la page.
 *
 * Un film porte ses états dans son `UserData` : on lit la fiche SI elle est en
 * cache (le survol la charge pour le bouton Lecture, et les mutations la
 * patchent), sans jamais la demander — quatre-vingts affiches au repos ne
 * déclenchent aucune requête. La série, elle, répond par les Sets partagés.
 */
export function useRecoCardMarkers(item: RecoRowItem): CardMarkers {
  const { data: cached } = useMediaItem(item.jellyfinItemId ?? undefined, { enabled: false });
  const { key, mediaType, tmdbId, title, jellyfinItemId } = item;
  const face = useMemo(
    () => cached ?? recoMarkerItem({ key, mediaType, tmdbId, title, jellyfinItemId }),
    [cached, key, mediaType, tmdbId, title, jellyfinItemId],
  );
  return useCardMarkers(face, { communityRating: item.voteAverage, scope: "series" });
}
