import { useCallback, useMemo } from "react";
import { RefreshControl, View } from "react-native";
import Animated, { useComposedEventHandler } from "react-native-reanimated";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  useFeaturedItems, useResumeItems, useNextUp,
  useLibraries, useUserId,
  useWatchlist,
  useHomeWebSocket, usePreferencesLive, useRecoLive, useTentacleConfig,
} from "@tentacle-tv/api-client";
import { describeProblem, latestAdditionsDetailQuery, type MediaItem } from "@tentacle-tv/shared";
import { SkeletonHero, SkeletonRow, SubtleBackground } from "@/components/ui";
import { HeroBanner } from "@/components/HeroBanner";
import { useHeroMetrics } from "@/components/heroMetrics";
import { useHeroInView } from "@/components/hero/useHeroInView";
import { useHomeHero } from "@/components/home/useHomeHero";
import { useHeaderHeight } from "@/components/PersistentHeader";
import { MobileMediaCard } from "@/components/MobileMediaCard";
import { HomeRow } from "@/components/home/homeRowRegistry";
import type { HomeRowActions, HomeRowData } from "@/components/home/homeRowRegistry";
import { useHomeRows } from "@/components/home/useHomeRows";
import { CardDensityProvider } from "@/contexts/CardDensityContext";
import { useScrollChromeHandler } from "@/components/navigation/scrollChrome";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { useRecoNavigation } from "@/hooks/useRecoNavigation";
import { useRecoFilterChipRow } from "@/components/reco/useRecoFilterChipRow";
import { ProblemState } from "@/components/problems/ProblemState";
import { spacing, useTheme } from "@/theme";

/** Les caches que « tirer pour rafraîchir » renouvelle, au-delà des requêtes
 *  déjà tenues par l'écran : la mise en page et les rangées auto-alimentées. */
const REFRESH_KEYS: string[][] = [
  ["home-layout"], ["watched-items"], ["favorites"], ["latest-items"], ["watchlist"], ["reco-page"],
];

/**
 * Home — ambient orbe + HeroBanner cinematic + rangées cascade + skeleton
 * stylé. Les rangées viennent de la mise en page du COMPTE (celle que le web
 * édite) : ordre et activation identiques sur toutes les plateformes ; le
 * rendu de chaque clé vit dans `homeRowRegistry`.
 */
export function HomeScreen() {
  // La session perdue (plus de compte lu) : le message du modèle commun.
  const sessionLost = useMemo(() => describeProblem({ cause: "sessionExpired", context: "page", availability: { canGoBack: false } }), []);
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const headerH = useHeaderHeight();
  // La nav se replie au défilement — le signal part d'ici (fil UI seul).
  const onScrollChrome = useScrollChromeHandler();
  // Le héros défilé hors de la vue suspend sa rotation (fondus, halo).
  const { bannerH } = useHeroMetrics();
  const hero = useHeroInView(bannerH);
  const onScroll = useComposedEventHandler([onScrollChrome, hero.handler]);
  const userId = useUserId();
  const { storage } = useTentacleConfig();
  const token = storage.getItem("tentacle_token");
  useHomeWebSocket({ token });
  // Les recommandations reconstruites en fond arrivent en silence (reco:update).
  useRecoLive({ token });
  // Un réglage enregistré sur un autre appareil aussi (preferences:update) :
  // l'onglet Accueil est la route initiale et reste monté, un montage suffit.
  usePreferencesLive({ token });

  const featured = useFeaturedItems();
  const resume = useResumeItems();
  const nextUp = useNextUp();
  const libraries = useLibraries();
  const watchlist = useWatchlist();
  const { rows, layout } = useHomeRows();
  const recoNav = useRecoNavigation();
  const filterChipRowKey = useRecoFilterChipRow(rows);

  const isLoading = featured.isLoading || resume.isLoading;

  const handleRefresh = useCallback(() => Promise.all([
    featured.refetch(),
    resume.refetch(),
    nextUp.refetch(),
    libraries.refetch(),
    ...REFRESH_KEYS.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
  ]), [featured, resume, nextUp, libraries, queryClient]);
  // L'anneau suit le GESTE seul : une relève poussée par le serveur (« featured »
  // à chaque ajout, repli toutes les minutes) poussait la page — et le héros
  // restait plus bas si elle finissait pendant qu'on était sur un autre onglet.
  const pull = usePullToRefresh(handleRefresh);

  // Une carte regroupée des « Derniers ajouts » ouvre la série sur la saison de son dernier ajout.
  const handlePress = useCallback((item: MediaItem) => { router.push(`/media/${item.Id}${latestAdditionsDetailQuery(item)}`); }, [router]);
  const handlePlay = useCallback((item: MediaItem) => { router.push(`/watch/${item.Id}`); }, [router]);
  // Le bandeau suit le mode du compte (reprise, aléatoire, titre fixe, reco).
  const { slides: heroSlides, loading: heroLoading } = useHomeHero({
    layout,
    resume: resume.data,
    featured: featured.data,
    onPlay: handlePlay,
    onInfo: handlePress,
    onRecoOpen: recoNav.open,
    canOpenReco: recoNav.canOpen,
  });

  // L'appui long des cartes (affiches, recommandations) ouvre la feuille des
  // cartes de l'app (`CardSheetScope`) : rien à brancher ici.
  const renderCard = useCallback((item: MediaItem) => (
    <MobileMediaCard item={item} onPress={handlePress} />
  ), [handlePress]);

  const librariesById = useMemo(() => {
    const map: HomeRowData["librariesById"] = new Map();
    (libraries.data ?? []).forEach((lib, index) =>
      map.set(lib.Id, { id: lib.Id, name: lib.Name, collectionType: lib.CollectionType, index }));
    return map;
  }, [libraries.data]);
  const rowData = useMemo<HomeRowData>(() => ({
    resume: resume.data ?? [],
    nextUp: nextUp.data ?? [],
    watchlist: watchlist.data ?? [],
    librariesById,
    filterChipRowKey,
  }), [resume.data, nextUp.data, watchlist.data, librariesById, filterChipRowKey]);
  const rowActions = useMemo<HomeRowActions>(() => ({
    renderCard,
    // Un onglet se rejoint (Pour vous) ; une liste s'empile (Ma liste, favoris).
    onSeeAll: (route) => (route === "/for-you" ? router.navigate(route) : router.push(route)),
    canOpenReco: recoNav.canOpen,
    onRecoPress: recoNav.open,
  }), [renderCard, router, recoNav]);

  const anyFetching = featured.isFetching || resume.isFetching;
  if (isLoading || (!userId && anyFetching)) {
    return (
      <SubtleBackground ambient>
        <SkeletonHero />
        <View style={{ marginTop: spacing.xl }}><SkeletonRow /></View>
        <View style={{ marginTop: spacing.xl }}><SkeletonRow /></View>
        <View style={{ marginTop: spacing.xl }}><SkeletonRow /></View>
      </SubtleBackground>
    );
  }

  // Plus de compte lu : la session est perdue — le dire, et proposer de se
  // reconnecter (jamais un message de développeur).
  if (!userId) {
    return <ProblemState model={sessionLost} onAction={() => router.replace("/(auth)/login")} />;
  }

  return (
    <SubtleBackground ambient>
      {/* La densité des cartes du compte (compacte, normale, large) — la même
          mise en page que le web. */}
      <CardDensityProvider value={layout?.cardDensity ?? "normal"}>
      <Animated.ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: headerH, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={pull.refreshing}
            onRefresh={pull.onRefresh}
            tintColor={theme.colors.brand.violet}
            progressBackgroundColor={theme.colors.surface.s1}
          />
        }
      >
        {/* Le bandeau : le mode du compte, la reprise en repli — jamais vide. */}
        {heroLoading ? <SkeletonHero /> : heroSlides.length > 0 && <HeroBanner slides={heroSlides} inView={hero.inView} />}

        {/* Les rangées, dans l'ordre du compte (mise en page partagée avec le
            web et la TV) ; chaque clé se rend depuis le registre. */}
        {rows.map((row, index) => (
          <HomeRow key={row.key} rowKey={row.key} index={index} data={rowData} actions={rowActions} />
        ))}
      </Animated.ScrollView>
      </CardDensityProvider>
    </SubtleBackground>
  );
}
