/**
 * Octave mobile — « Vos playlists favorites » à l'accueil : une rangée COMPACTE juste sous la reprise, la
 * décision du bureau (fv1) — au plus huit, dans l'ordre personnel (`homeFavoritePlaylists`, partagé), de la
 * bibliothèque ou d'une extension. Aucune favorite : rien, l'accueil reste tel qu'il était. Hors ligne, la
 * liste gardée se montre (le cache gardé d'Octave l'ancre). « Réordonner » (deux favorites ou plus, en ligne) ouvre
 * la page Playlists sur le tri de ses favorites — l'ordre personnel du compte, gardé par le serveur (lot fl).
 */

import { memo, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { useMusicShelves } from "@tentacle-tv/api-client";
import { octavePaths } from "@tentacle-tv/shared/octave/mode";
import { shelfPlaylistKey, type MusicShelfPlaylist } from "@tentacle-tv/shared/music";
import { homeFavoritePlaylists } from "@tentacle-tv/shared/octave";
import { ExternalPlaylistCard, PlaylistCard } from "../ui/Cards";
import { Shelf } from "../ui/Shelf";
import { requestPlaylistsReorder } from "../../playlists/screens/reorderRequest";
import { useOfflineMode } from "@/offline/useOfflineMode";

/** Plus petites que les cartes d'étagère : la rangée appelle, elle ne s'impose pas. */
const COMPACT = 112;

export const FavoritePlaylistsShelf = memo(function FavoritePlaylistsShelf() {
  const { t } = useTranslation("musicFavorites");
  const { capable, shelves } = useMusicShelves();
  const offline = useOfflineMode();
  const router = useRouter();
  const items = useMemo(() => (capable ? homeFavoritePlaylists(shelves.playlists, shelfPlaylistKey, shelves.order.playlists) : []), [capable, shelves]);
  const reorder = useCallback(() => {
    requestPlaylistsReorder("favorites");
    router.push(octavePaths.playlists as never);
  }, [router]);
  if (items.length === 0) return null;
  return (
    <Shelf
      title={t("homeTitle")}
      items={items}
      keyOf={shelfPlaylistKey}
      width={COMPACT}
      onSeeAll={items.length > 1 && !offline ? reorder : undefined}
      actionLabel={t("actions.reorder")}
      render={(entry: MusicShelfPlaylist, w) => (entry.kind === "library" ? <PlaylistCard playlist={entry.playlist} width={w} /> : <ExternalPlaylistCard playlist={entry.playlist} width={w} />)}
    />
  );
});
