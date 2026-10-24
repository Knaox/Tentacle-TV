/**
 * Octave — la bibliothèque : albums (triables), artistes, playlists, par
 * onglets. Les listes se chargent page après page à l'approche du bas.
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AlbumCard, ArtistCard, CardGrid, PlaylistCard } from "../components/Cards";
import { CardsSkeleton, EmptyState, ErrorState } from "../components/ViewStates";
import { useMusicAlbums, useMusicArtists, useMusicPlaylists, type MusicAlbumSort } from "@tentacle-tv/api-client";
import { LoadMore, flattenPages } from "./LoadMore";

type Tab = "albums" | "artists" | "playlists";
/** Les tris demandés au serveur (`/api/music/albums?sort=`). */
const SORTS: readonly { value: MusicAlbumSort; key: string }[] = [
  { value: "recent", key: "library.sortAdded" },
  { value: "name", key: "library.sortName" },
  { value: "year", key: "library.sortYear" },
];

const SORT_KEY = "tentacle_octave_album_sort";

function readSort(): MusicAlbumSort {
  try {
    const v = localStorage.getItem(SORT_KEY);
    return SORTS.find((s) => s.value === v)?.value ?? "recent";
  } catch {
    return "recent";
  }
}

function Albums() {
  const { t } = useTranslation("music");
  const [sort, setSort] = useState(readSort);
  const albums = useMusicAlbums({ sort });
  const list = flattenPages(albums.data?.pages);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 px-2">
        <label htmlFor="octave-album-sort" className="text-sm text-content-tertiary">
          {t("library.sort")}
        </label>
        <select
          id="octave-album-sort"
          value={sort}
          onChange={(e) => {
            setSort(e.target.value as MusicAlbumSort);
            try {
              localStorage.setItem(SORT_KEY, e.target.value);
            } catch {
              /* stockage refusé */
            }
          }}
          className="h-9 cursor-pointer rounded-full border border-line-subtle bg-fill-subtle px-3 text-sm text-content-primary focus:border-line-focus focus:outline-none"
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {t(s.key)}
            </option>
          ))}
        </select>
      </div>
      {albums.isPending && <CardsSkeleton count={12} />}
      {albums.isError && <ErrorState onRetry={() => void albums.refetch()} />}
      {albums.isSuccess && list.length === 0 && <EmptyState>{t("library.empty")}</EmptyState>}
      <CardGrid>
        {list.map((album) => (
          <AlbumCard key={album.key} album={album} />
        ))}
      </CardGrid>
      <LoadMore query={albums} />
    </div>
  );
}

function Artists() {
  const { t } = useTranslation("music");
  const artists = useMusicArtists();
  const list = flattenPages(artists.data?.pages);
  return (
    <div className="flex flex-col gap-4">
      {artists.isPending && <CardsSkeleton count={12} />}
      {artists.isError && <ErrorState onRetry={() => void artists.refetch()} />}
      {artists.isSuccess && list.length === 0 && <EmptyState>{t("library.empty")}</EmptyState>}
      <CardGrid>
        {list.map((artist) => (
          <ArtistCard key={artist.key} artist={artist} />
        ))}
      </CardGrid>
      <LoadMore query={artists} />
    </div>
  );
}

function Playlists() {
  const { t } = useTranslation("music");
  const playlists = useMusicPlaylists();
  if (playlists.isPending) return <CardsSkeleton />;
  if (playlists.isError) return <ErrorState onRetry={() => void playlists.refetch()} />;
  if (!playlists.data.length) return <EmptyState>{t("library.empty")}</EmptyState>;
  return (
    <CardGrid>
      {playlists.data.map((p) => (
        <PlaylistCard key={p.jellyfinId} playlist={p} />
      ))}
    </CardGrid>
  );
}

export function LibraryView() {
  const { t } = useTranslation("music");
  const [tab, setTab] = useState<Tab>("albums");
  const tabs: Tab[] = ["albums", "artists", "playlists"];
  return (
    <div className="flex flex-col gap-6 px-2 pb-10 pt-6 md:px-6">
      <h1 className="px-2 text-3xl font-black tracking-tight text-content-primary">{t("library.title")}</h1>
      <div role="tablist" aria-label={t("library.title")} className="flex gap-2 px-2">
        {tabs.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`h-9 cursor-pointer rounded-full px-4 text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus ${
              tab === id ? "bg-cta-primary-bg text-cta-primary-fg" : "bg-fill-subtle text-content-secondary hover:text-content-primary"
            }`}
          >
            {t(`library.${id}`)}
          </button>
        ))}
      </div>
      <div role="tabpanel">{tab === "albums" ? <Albums /> : tab === "artists" ? <Artists /> : <Playlists />}</div>
    </div>
  );
}
