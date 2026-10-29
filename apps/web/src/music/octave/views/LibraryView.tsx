/**
 * Octave — la bibliothèque : albums (triables), artistes, playlists, par
 * onglets. Les listes se chargent page après page à l'approche du bas.
 *
 * L'onglet vit dans l'adresse (`?tab=`, remplacé : pas d'entrée d'historique
 * par clic) — le retour depuis un album ramène sur « Artistes » si on y était,
 * et un lien profond ouvre le bon onglet. Onglets au clavier : flèches,
 * Début, Fin (motif ARIA « tabs »).
 */

import { useRef, useState, type KeyboardEvent } from "react";
import { Library } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AlbumCard, ArtistCard, CardGrid, PlaylistCard } from "../components/Cards";
import { CardsSkeleton, EmptyState, ErrorState } from "../components/ViewStates";
import { useMusicAlbums, useMusicArtists, useMusicPlaylists, type MusicAlbumSort } from "@tentacle-tv/api-client";
import { LoadMore, flattenPages } from "./LoadMore";
import { useOctaveGlassStage } from "../glass/glassStage";
import { ImportedShelf } from "../releases/ImportedShelf";
import { ReleaseEntryButton } from "../releases/ReleaseEntryButton";
import { LIBRARY_ALBUM_SORT_KEY, LIBRARY_ALBUM_SORTS, LIBRARY_TABS, parseAlbumSort, parseLibraryTab, type LibraryTab } from "@tentacle-tv/shared/octave";

// Onglets, tris et clé du tri retenu : partagés avec le mobile (`@tentacle-tv/shared/octave` › libraryModel).
const TABS = LIBRARY_TABS;
type Tab = LibraryTab;
export { parseLibraryTab };
const SORTS = LIBRARY_ALBUM_SORTS;
const SORT_KEY = LIBRARY_ALBUM_SORT_KEY;

function readSort(): MusicAlbumSort {
  try {
    return parseAlbumSort(localStorage.getItem(SORT_KEY));
  } catch {
    return "recent";
  }
}

function LibraryEmpty() {
  const { t } = useTranslation("music");
  return (
    <EmptyState icon={Library} title={t("views.libraryEmptyTitle")}>
      {t("views.libraryEmptyHint")}
    </EmptyState>
  );
}

function Albums() {
  const { t } = useTranslation("music");
  const [sort, setSort] = useState(readSort);
  const bead = useOctaveGlassStage() ? "lg-bead " : "";
  const albums = useMusicAlbums({ sort });
  const list = flattenPages(albums.data?.pages);
  return (
    <div className="flex flex-col gap-4">
      <ImportedShelf />
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
          className={`octave-pill ${bead}h-9 cursor-pointer rounded-full border border-octave-line bg-octave-hover px-3 text-sm text-content-primary focus:border-line-focus focus:outline-none`}
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
      {albums.isSuccess && list.length === 0 && <LibraryEmpty />}
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
  const artists = useMusicArtists();
  const list = flattenPages(artists.data?.pages);
  return (
    <div className="flex flex-col gap-4">
      {artists.isPending && <CardsSkeleton count={12} round />}
      {artists.isError && <ErrorState onRetry={() => void artists.refetch()} />}
      {artists.isSuccess && list.length === 0 && <LibraryEmpty />}
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
  const playlists = useMusicPlaylists();
  if (playlists.isPending) return <CardsSkeleton />;
  if (playlists.isError) return <ErrorState onRetry={() => void playlists.refetch()} />;
  if (!playlists.data.length) return <LibraryEmpty />;
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
  const [params, setParams] = useSearchParams();
  const tab = parseLibraryTab(params.get("tab"));
  const chipClass = useOctaveGlassStage() ? "octave-chip lg-bead" : "octave-chip";
  const tabRefs = useRef<Record<Tab, HTMLButtonElement | null>>({ albums: null, artists: null, playlists: null });
  const select = (next: Tab, focus = false) => {
    setParams(next === "albums" ? {} : { tab: next }, { replace: true });
    if (focus) tabRefs.current[next]?.focus();
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = TABS.indexOf(tab);
    const next = e.key === "ArrowRight" ? TABS[(i + 1) % TABS.length] : e.key === "ArrowLeft" ? TABS[(i + TABS.length - 1) % TABS.length] : e.key === "Home" ? TABS[0] : e.key === "End" ? TABS[TABS.length - 1] : null;
    if (!next) return;
    e.preventDefault();
    select(next, true);
  };
  return (
    <div className="flex flex-col gap-6 px-2 pb-10 pt-6 md:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3 px-2">
        <h1 className="oc-display text-3xl text-content-primary">{t("library.title")}</h1>
        <ReleaseEntryButton />
      </div>
      <div role="tablist" aria-label={t("library.title")} className="flex gap-2 px-2" onKeyDown={onKeyDown}>
        {TABS.map((id) => (
          <button
            key={id}
            ref={(el) => {
              tabRefs.current[id] = el;
            }}
            id={`octave-library-tab-${id}`}
            type="button"
            role="tab"
            aria-selected={tab === id}
            aria-controls="octave-library-panel"
            tabIndex={tab === id ? 0 : -1}
            onClick={() => select(id)}
            className={chipClass}
          >
            {t(`library.${id}`)}
          </button>
        ))}
      </div>
      <div id="octave-library-panel" role="tabpanel" aria-labelledby={`octave-library-tab-${tab}`}>
        {tab === "albums" ? <Albums /> : tab === "artists" ? <Artists /> : <Playlists />}
      </div>
    </div>
  );
}
