/**
 * Octave — l'accueil : le mot d'accueil (`home/greeting.ts`), la reprise du
 * titre gardé, l'accès rapide aux playlists favorites (`home/FavoritePlaylists`), écoutés récemment (raccourcis), les ambiances (emplacement),
 * les mixes du jour et les albums du moment, les nouveautés de la
 * bibliothèque, « parce que vous avez écouté », les artistes du moment, vos
 * titres les plus écoutés, vos playlists. Tout vient de l'accueil du cœur
 * (une requête, gardée en cache) et de l'état du lecteur.
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
import { HomeMoodsSlot } from "../home/ambianceSlots";
import { HomeGreeting } from "../home/HomeGreeting";
import { ResumeCard } from "../home/ResumeCard";
import { FavoritePlaylists } from "../home/FavoritePlaylists";
import { ForYouMore, ForYouTop, hasForYou } from "../home/ForYouShelves";

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
  const recent = home.data?.recentlyPlayed ?? [];
  const added = home.data?.recentlyAdded ?? [];
  const playlists = home.data?.playlists ?? [];
  const mostRows = useMemo(() => rowsOf((home.data?.mostPlayed ?? []).slice(0, 5)), [home.data]);

  if (home.isError) return <ErrorState onRetry={() => void home.refetch()} />;
  const forYou = home.data?.forYou;
  const empty = home.data && !recent.length && !added.length && !mostRows.length && !playlists.length && !hasForYou(forYou);

  return (
    <div className="flex flex-col gap-10 px-2 pb-10 pt-6 md:px-6">
      <HomeGreeting />
      <ResumeCard />
      <FavoritePlaylists />
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
      <HomeMoodsSlot />
      {forYou && <ForYouTop forYou={forYou} />}
      {added.length > 0 && (
        <Shelf title={t("octaveHome.newInLibrary")} action={<SeeAll to={octavePaths.library} />}>
          <CardRow items={added} render={(album) => <AlbumCard key={album.key} album={album} />} />
        </Shelf>
      )}
      {forYou && <ForYouMore forYou={forYou} />}
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
