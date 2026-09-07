import { useCallback, useMemo, useState } from "react";
import { RefreshControl, View, Text, StyleSheet } from "react-native";
import Animated from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  useFeaturedItems, useResumeItems, useNextUp,
  useLibraries, useUserId,
  useWatchlist,
  useHomeWebSocket, usePreferencesLive, useRecoLive, useTentacleConfig,
} from "@tentacle-tv/api-client";
import type { RecoReason, RecoRowItem } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { useTranslation } from "react-i18next";
import { SkeletonHero, SkeletonRow, SubtleBackground } from "@/components/ui";
import { HeroBanner } from "@/components/HeroBanner";
import { useHomeHero } from "@/components/home/useHomeHero";
import { useHeaderHeight } from "@/components/PersistentHeader";
import { MobileMediaCard } from "@/components/MobileMediaCard";
import { HomeRow } from "@/components/home/homeRowRegistry";
import type { HomeRowActions, HomeRowData } from "@/components/home/homeRowRegistry";
import { useHomeRows } from "@/components/home/useHomeRows";
import { CardDensityProvider } from "@/contexts/CardDensityContext";
import { useScrollChromeHandler } from "@/components/navigation/scrollChrome";
import { useRecoNavigation } from "@/hooks/useRecoNavigation";
import { useRecoFilterChipRow } from "@/components/reco/useRecoFilterChipRow";
import { MediaActionSheet } from "@/components/MediaActionSheet";
import { RecoActionSheet } from "@/components/reco/RecoActionSheet";
import { spacing, typography, FONT_FAMILY, useTheme, useThemedStyles, type AppTheme } from "@/theme";

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
  const { t: te } = useTranslation("errors");
  const theme = useTheme();
  const st = useThemedStyles(makeErrStyles);
  const router = useRouter();
  const queryClient = useQueryClient();
  const headerH = useHeaderHeight();
  // La nav se replie au défilement — le signal part d'ici (fil UI seul).
  const onScrollChrome = useScrollChromeHandler();
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

  const [longPressItemId, setLongPressItemId] = useState<string | null>(null);
  // Les raisons d'une recommandation en bibliothèque, pour « Pourquoi ce titre ».
  const [longPressReasons, setLongPressReasons] = useState<RecoReason[] | undefined>(undefined);
  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  // Appui long sur une recommandation hors bibliothèque : sa propre feuille.
  const [recoTarget, setRecoTarget] = useState<RecoRowItem | null>(null);

  const isLoading = featured.isLoading || resume.isLoading;


  const handleRefresh = useCallback(() => {
    featured.refetch();
    resume.refetch();
    nextUp.refetch();
    libraries.refetch();
    for (const queryKey of REFRESH_KEYS) void queryClient.invalidateQueries({ queryKey });
  }, [featured, resume, nextUp, libraries, queryClient]);

  const handlePress = useCallback((item: MediaItem) => { router.push(`/media/${item.Id}`); }, [router]);
  const handlePlay = useCallback((item: MediaItem) => { router.push(`/watch/${item.Id}`); }, [router]);
  const openActions = useCallback((jellyfinId: string, reasons?: RecoReason[]) => {
    setLongPressItemId(jellyfinId);
    setLongPressReasons(reasons);
    setActionSheetVisible(true);
  }, []);
  const handleLongPress = useCallback((item: MediaItem) => openActions(item.Id), [openActions]);
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

  const renderCard = useCallback((item: MediaItem) => (
    <MobileMediaCard item={item} onPress={() => handlePress(item)} onLongPress={() => handleLongPress(item)} />
  ), [handlePress, handleLongPress]);

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
    onItemPress: (jellyfinId) => router.push(`/media/${jellyfinId}`),
    onItemLongPress: openActions,
    // Un onglet se rejoint (Pour vous) ; une liste s'empile (Ma liste, favoris).
    onSeeAll: (route) => (route === "/for-you" ? router.navigate(route) : router.push(route)),
    canOpenReco: recoNav.canOpen,
    onRecoPress: recoNav.open,
    // En bibliothèque : la feuille habituelle (favoris, Ma liste, vu) ;
    // sinon celle des recommandations (« Ne plus me proposer »).
    onRecoLongPress: (item) => (item.jellyfinItemId ? openActions(item.jellyfinItemId, item.reasons) : setRecoTarget(item)),
  }), [renderCard, router, openActions, recoNav]);

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

  if (!userId) {
    return (
      <SubtleBackground ambient style={{ justifyContent: "center", alignItems: "center", padding: 32 }}>
        <Feather name="alert-circle" size={36} color={theme.colors.brand.light} style={{ marginBottom: spacing.md }} />
        <Text style={st.errTitle}>{te("sessionNotInitialized")}</Text>
        <Text style={st.errMsg}>{te("sessionNotInitializedMessage")}</Text>
      </SubtleBackground>
    );
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
        onScroll={onScrollChrome}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={featured.isFetching && !featured.isLoading}
            onRefresh={handleRefresh}
            tintColor={theme.colors.brand.violet}
            progressBackgroundColor={theme.colors.surface.s1}
          />
        }
      >
        {/* Le bandeau : le mode du compte, la reprise en repli — jamais vide. */}
        {heroLoading ? <SkeletonHero /> : heroSlides.length > 0 && <HeroBanner slides={heroSlides} />}

        {/* Les rangées, dans l'ordre du compte (mise en page partagée avec le
            web et la TV) ; chaque clé se rend depuis le registre. */}
        {rows.map((row, index) => (
          <HomeRow key={row.key} rowKey={row.key} index={index} data={rowData} actions={rowActions} />
        ))}
      </Animated.ScrollView>
      </CardDensityProvider>

      {longPressItemId && (
        <MediaActionSheet
          visible={actionSheetVisible}
          itemId={longPressItemId}
          reasons={longPressReasons}
          onClose={() => { setActionSheetVisible(false); setLongPressItemId(null); }}
        />
      )}
      <RecoActionSheet item={recoTarget} onClose={() => setRecoTarget(null)} />
    </SubtleBackground>
  );
}

const makeErrStyles = (t: AppTheme) => StyleSheet.create({
  errTitle: { ...typography.subtitle, fontFamily: FONT_FAMILY.bold, color: t.colors.text.primary, marginBottom: 8, textAlign: "center" as const },
  errMsg: { ...typography.caption, fontFamily: FONT_FAMILY.regular, color: t.colors.text.tertiary, textAlign: "center" as const, maxWidth: 320 },
});
