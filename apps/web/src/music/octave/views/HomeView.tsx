/**
 * Octave — l'accueil : salutation, écoutés récemment (raccourcis), ajoutés
 * récemment (albums), vos titres les plus écoutés, vos playlists.
 *
 * Chaque étagère de cartes tient en UNE rangée pleine (`CardRow`) : jamais une
 * carte orpheline ; « Tout afficher » mène au reste. L'attente a la forme
 * exacte de la page (raccourcis, étagère), et un accueil vide dit quoi faire.
 */

import { useMemo } from "react";
import { Music2, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AlbumCard, PlaylistCard, Shelf } from "../components/Cards";
import { CardRow, CardRowSkeleton } from "../components/CardRow";
import { TrackList, rowsOf } from "../components/TrackList";
import { EMPTY_ACTION_CLASS, EmptyState, ErrorState } from "../components/ViewStates";
import { useMusicHome } from "@tentacle-tv/api-client";
import { octavePaths } from "../octavePaths";
import { QuickPicks, QuickPicksSkeleton } from "./QuickPicks";

function greetingKey(hour: number): "home.morning" | "home.afternoon" | "home.evening" {
  return hour < 12 ? "home.morning" : hour < 18 ? "home.afternoon" : "home.evening";
}

function SeeAll({ to }: { to: string }) {
  const { t } = useTranslation("music");
  return (
    <Link to={to} className="rounded-sm text-sm font-semibold text-content-tertiary hover:text-content-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus">
      {t("common.seeAll")}
    </Link>
  );
}

/** L'attente : la forme de la page, à ses places. */
function HomeSkeleton() {
  return (
    <>
      <QuickPicksSkeleton />
      <section aria-hidden className="flex flex-col gap-3">
        <div className="mx-2 h-7 w-48 rounded bg-fill-soft" />
        <CardRowSkeleton />
      </section>
    </>
  );
}

export function HomeView() {
  const { t } = useTranslation("music");
  const home = useMusicHome();
  const greeting = t(greetingKey(new Date().getHours()));
  const recent = home.data?.recentlyPlayed ?? [];
  const added = home.data?.recentlyAdded ?? [];
  const playlists = home.data?.playlists ?? [];
  const mostRows = useMemo(() => rowsOf((home.data?.mostPlayed ?? []).slice(0, 5)), [home.data]);

  if (home.isError) return <ErrorState onRetry={() => void home.refetch()} />;
  const empty = home.data && !recent.length && !added.length && !mostRows.length && !playlists.length;

  return (
    <div className="flex flex-col gap-10 px-2 pb-10 pt-6 md:px-6">
      <h1 className="px-2 oc-display text-3xl text-content-primary">{greeting}</h1>
      {home.isPending && <HomeSkeleton />}
      {empty && (
        <EmptyState
          icon={Music2}
          title={t("views.homeEmptyTitle")}
          action={
            <Link to={octavePaths.search} className={EMPTY_ACTION_CLASS}>
              <Search className="h-4 w-4" aria-hidden />
              {t("views.findMusic")}
            </Link>
          }
        >
          {t("views.homeEmptyHint")}
        </EmptyState>
      )}
      {recent.length > 0 && <QuickPicks tracks={recent} />}
      {added.length > 0 && (
        <Shelf title={t("home.recentlyAdded")} action={<SeeAll to={octavePaths.library} />}>
          <CardRow items={added} render={(album) => <AlbumCard key={album.key} album={album} />} />
        </Shelf>
      )}
      {mostRows.length > 0 && (
        <Shelf title={t("home.mostPlayed")}>
          <TrackList rows={mostRows} contextId="home:most" showArtwork showAlbum label={t("home.mostPlayed")} />
        </Shelf>
      )}
      {playlists.length > 0 && (
        <Shelf title={t("home.playlists")} action={<SeeAll to={octavePaths.playlists} />}>
          <CardRow items={playlists} render={(p) => <PlaylistCard key={p.jellyfinId} playlist={p} />} />
        </Shelf>
      )}
    </div>
  );
}
