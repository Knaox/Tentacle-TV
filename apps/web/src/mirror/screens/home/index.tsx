import { useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle } from "lucide-react";
import {
  notifyUserChange,
  useFeaturedItems,
  useHomeWebSocket,
  useJellyfinClient,
  useLibraries,
  useNextUp,
  useResumeItems,
  useUserId,
  useWatchlist,
} from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { ContentErrorState } from "../../../components/ContentErrorState";
import { useRecoNavigation } from "../../../lib/recoNavigation";
import { MediaCard } from "../../cards/MediaCard";
import { HeroBanner } from "../../hero/HeroBanner";
import { SkeletonHero, SkeletonHeroScreen } from "../../hero/Skeletons";
import { SubtleBackground } from "../../hero/SubtleBackground";
import { CardDensityContext } from "../../useMirrorLayout";
import { useItemSheets } from "../forYou/useItemSheets";
import { HomeRow, type HomeRowActions, type HomeRowData } from "./homeRowRegistry";
import { useHomeHero } from "./useHomeHero";
import { useHomeRows } from "./useHomeRows";
import "../../mirror.css";

/**
 * L'onglet Accueil de l'app (`HomeScreen`) : l'orbe ambiant, la bannière
 * (mode du compte, la reprise en repli), puis les rangées dans l'ordre de la
 * mise en page du COMPTE, à la densité de cartes du compte. Appui long : la
 * feuille du titre (ou celle d'une recommandation hors bibliothèque).
 * Hors ligne, le routeur sert `OfflineCatalog` à la place de cet écran.
 */
export function MirrorHome() {
  const { t: te } = useTranslation("errors");
  const navigate = useNavigate();
  const client = useJellyfinClient();
  const queryClient = useQueryClient();
  const userId = useUserId();

  // Fil temps réel de l'accueil, et révocation de l'appareil poussée par le
  // serveur — la même liaison que l'accueil du bureau.
  const wsToken = client.getAccessToken() || localStorage.getItem("tentacle_token");
  const onSessionRevoked = useCallback(() => {
    client.setAccessToken(null);
    localStorage.removeItem("tentacle_token");
    localStorage.removeItem("tentacle_user");
    queryClient.clear();
    notifyUserChange();
  }, [client, queryClient]);
  useHomeWebSocket({ token: wsToken, onSessionRevoked });

  const featured = useFeaturedItems();
  const resume = useResumeItems();
  const nextUp = useNextUp();
  const libraries = useLibraries();
  const watchlist = useWatchlist();
  const { rows, layout, filterChipRowKey } = useHomeRows();
  const recoNav = useRecoNavigation();
  const { openMedia, openReco, sheets } = useItemSheets();

  const handlePress = useCallback((item: MediaItem) => navigate(`/media/${item.Id}`), [navigate]);
  const handlePlay = useCallback((item: MediaItem) => navigate(`/watch/${item.Id}`), [navigate]);
  const { slides, loading: heroLoading } = useHomeHero({
    layout,
    resume: resume.data,
    featured: featured.data,
    onPlay: handlePlay,
    onInfo: handlePress,
    onRecoOpen: recoNav.open,
    canOpenReco: recoNav.canOpen,
  });

  const renderCard = useCallback(
    (item: MediaItem) => <MediaCard item={item} onLongPress={() => openMedia(item)} />,
    [openMedia],
  );
  const librariesById = useMemo(() => {
    const map: HomeRowData["librariesById"] = new Map();
    (libraries.data ?? []).forEach((lib, index) =>
      map.set(lib.Id, { id: lib.Id, name: lib.Name, collectionType: lib.CollectionType, index }),
    );
    return map;
  }, [libraries.data]);
  const rowData = useMemo<HomeRowData>(
    () => ({
      resume: resume.data ?? [],
      nextUp: nextUp.data ?? [],
      watchlist: watchlist.data ?? [],
      librariesById,
      filterChipRowKey,
    }),
    [resume.data, nextUp.data, watchlist.data, librariesById, filterChipRowKey],
  );
  const rowActions = useMemo<HomeRowActions>(
    () => ({
      renderCard,
      onSeeAll: (route) => navigate(route),
      canOpenReco: recoNav.canOpen,
      onRecoPress: recoNav.open,
      onRecoLongPress: openReco,
    }),
    [renderCard, navigate, openReco, recoNav.canOpen, recoNav.open],
  );

  // Sans bibliothèques NI mise en avant, rien à montrer : on le DIT.
  if (libraries.isError && featured.isError && !resume.data?.length) return <ContentErrorState />;

  const anyFetching = featured.isFetching || resume.isFetching;
  if (featured.isLoading || resume.isLoading || (!userId && anyFetching)) {
    return (
      <SubtleBackground>
        <SkeletonHeroScreen />
      </SubtleBackground>
    );
  }

  if (!userId) {
    return (
      <SubtleBackground>
        <div className="flex min-h-[60vh] flex-col items-center justify-center p-8 text-center">
          <AlertCircle size={36} className="mb-3 text-brand-light" aria-hidden />
          <p className="mb-2 text-lg font-bold text-content-primary">{te("sessionNotInitialized")}</p>
          <p className="max-w-[320px] text-[13px] text-content-tertiary">{te("sessionNotInitializedMessage")}</p>
        </div>
      </SubtleBackground>
    );
  }

  return (
    <SubtleBackground>
      <CardDensityContext.Provider value={layout?.cardDensity ?? "normal"}>
        {heroLoading ? <SkeletonHero /> : slides.length > 0 && <HeroBanner slides={slides} />}
        {rows.map((row, index) => (
          <HomeRow key={row.key} rowKey={row.key} index={index} data={rowData} actions={rowActions} />
        ))}
      </CardDensityContext.Provider>
      {sheets}
    </SubtleBackground>
  );
}
