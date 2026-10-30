/**
 * Octave — les playlists FAVORITES à l'accueil : un accès rapide, sobre, juste sous le mot d'accueil — des
 * pastilles (vignette et nom, huit au plus, dans l'ordre personnel de la bibliothèque : `homeFavoritePlaylists`),
 * jamais une étagère de plus. Rien sans favori, ni face à un serveur qui ne les garde pas. « Réordonner » (deux
 * favorites ou plus) ouvre la fenêtre de tri des favorites — l'ordre personnel du compte (lot fl).
 */

import { memo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMusicPlaylists, useMusicShelves, usePlaylistShelf } from "@tentacle-tv/api-client";
import { shelfPlaylistKey, type MusicShelfPlaylist } from "@tentacle-tv/shared/music";
import { homeFavoritePlaylists } from "@tentacle-tv/shared/octave";
import { Artwork } from "../components/Artwork";
import { PlaylistArtwork, playlistCoverUrls } from "../components/PlaylistArtwork";
import { entityTarget, octavePaths } from "../octavePaths";
import { ReorderButton } from "../collections/ShelfSections";
import { ShelfReorderDialog } from "../collections/ShelfReorderDialog";
import { playlistRow } from "../views/libraryShelfRows";

const pillClass =
  "flex h-12 min-w-0 max-w-[16rem] items-center gap-2.5 rounded-[var(--oc-radius-art)] bg-octave-hover py-1 pl-1 pr-3 text-sm font-semibold text-content-primary transition-colors duration-150 hover:bg-fill-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus";

const Pill = memo(function Pill({ entry }: { entry: MusicShelfPlaylist }) {
  if (entry.kind === "library") {
    const p = entry.playlist;
    return (
      <Link to={octavePaths.playlist(p.jellyfinId)} className={pillClass} title={p.name}>
        <PlaylistArtwork urls={playlistCoverUrls(p)} label={p.name} radius="xs" thumb className="h-10 w-10 shrink-0" />
        <span className="truncate">{p.name}</span>
      </Link>
    );
  }
  const target = entityTarget({ jellyfinId: null, external: entry.playlist.external });
  if (!target) return null;
  return (
    <Link to={octavePaths.externalPlaylist(target)} className={pillClass} title={entry.playlist.title}>
      <Artwork url={entry.playlist.artworkUrl} label={entry.playlist.title} radius="xs" thumb className="h-10 w-10 shrink-0" />
      <span className="truncate">{entry.playlist.title}</span>
    </Link>
  );
});

export function FavoritePlaylists() {
  const { t } = useTranslation("musicFavorites");
  const { shelves } = useMusicShelves();
  // Un favori retiré à l'instant (drapeau patché) n'est plus montré.
  const favorites = shelves.playlists.filter((p) => p.kind !== "library" || p.playlist.favorite !== false);
  const shown = homeFavoritePlaylists(favorites, shelfPlaylistKey, shelves.order.playlists);
  const [reordering, setReordering] = useState(false);
  if (shown.length === 0) return null;
  return (
    <section aria-labelledby="octave-home-favorites" className="flex flex-col gap-2 px-2">
      <div className="flex items-center justify-between gap-2">
        <h2 id="octave-home-favorites" className="text-sm font-semibold text-content-tertiary">
          {t("homeTitle")}
        </h2>
        {shown.length > 1 && <ReorderButton label={t("actions.reorder")} onClick={() => setReordering(true)} />}
      </div>
      <ul className="flex flex-wrap gap-2">
        {shown.map((entry) => (
          <li key={shelfPlaylistKey(entry)} className="min-w-0">
            <Pill entry={entry} />
          </li>
        ))}
      </ul>
      {reordering && <FavoritesReorder onClose={() => setReordering(false)} />}
    </section>
  );
}

/** Monté seulement ouvert : la fenêtre de tri des playlists favorites (`usePlaylistShelf`, la règle de la bibliothèque). */
function FavoritesReorder({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation("music");
  const shelf = usePlaylistShelf(useMusicPlaylists().data);
  const rows = shelf.favorites.map((entry) => ({ key: shelf.keyOf(entry), ...playlistRow(entry, t) }));
  return rows.length > 0 ? <ShelfReorderDialog rows={rows} onMove={shelf.move} onClose={onClose} /> : null;
}
