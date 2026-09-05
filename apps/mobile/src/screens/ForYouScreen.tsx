import { useCallback, useMemo, useState } from "react";
import { RefreshControl, View, StyleSheet } from "react-native";
import Animated from "react-native-reanimated";
import { useRouter } from "expo-router";
import { activeFamilyCount, buildPlatformCatalog, useJellyfinClient, useWatchProviders } from "@tentacle-tv/api-client";
import { PLATFORM_FAMILIES } from "@tentacle-tv/shared";
import type { RecoReason, RecoRowItem } from "@tentacle-tv/api-client";
import { SkeletonHero, SkeletonRow, SubtleBackground } from "@/components/ui";
import { HeroBanner } from "@/components/HeroBanner";
import { useHeaderHeight } from "@/components/PersistentHeader";
import { useGlassTabBarHeight } from "@/components/navigation/GlassTabBar";
import { useScrollChromeHandler } from "@/components/navigation/scrollChrome";
import { MediaActionSheet } from "@/components/MediaActionSheet";
import { RecoActionSheet } from "@/components/reco/RecoActionSheet";
import { recoHeroSlides } from "@/components/reco/hero/recoHeroSlides";
import { RecoFilterSheet } from "@/components/reco/filters/RecoFilterSheet";
import { LikedActorsPanel } from "@/components/reco/people/LikedActorsPanel";
import { ColdStartScreen } from "@/components/reco/coldstart/ColdStartScreen";
import { RecoDisabledState, RecoErrorState } from "@/components/reco/page/RecoErrorState";
import { RecoPageHeader } from "@/components/reco/page/RecoPageHeader";
import { RecoPageRows } from "@/components/reco/page/RecoPageRows";
import { RecoStatusBanner } from "@/components/reco/page/RecoStatusBanner";
import { useRecoPageModel } from "@/components/reco/page/useRecoPageModel";
import { useRecoNavigation } from "@/hooks/useRecoNavigation";
import { spacing, useTheme } from "@/theme";

/**
 * L'onglet Pour vous — la page de recommandations, rendue d'un coup depuis
 * la page servie (cache persisté, revalidée en silence) : jamais vide, un
 * bandeau dit ce qui se passe. Sans page : squelettes, ou l'erreur avec
 * « Réessayer » ; démarrage à froid : la grille ; vieux serveur en mode
 * désactivé : l'écran historique.
 */
export function ForYouScreen() {
  const theme = useTheme();
  const router = useRouter();
  const headerH = useHeaderHeight();
  const tabBarH = useGlassTabBarHeight();
  const onScrollChrome = useScrollChromeHandler();
  const model = useRecoPageModel();
  const recoNav = useRecoNavigation();
  const client = useJellyfinClient();
  // Le carrousel : les diapositives tirées de « Pour vous » (graine par
  // montage) — sinon le titre compact tient sa place.
  const heroSlides = useMemo(
    () => recoHeroSlides(model.hero.slides, client, { canOpen: recoNav.canOpen, onOpen: recoNav.open }),
    [model.hero.slides, client, recoNav.canOpen, recoNav.open],
  );

  // Le filtre de plateformes : le catalogue des familles présentes dans la
  // région (toutes sans annuaire), le compteur du bouton, la feuille.
  const providers = useWatchProviders();
  const catalog = useMemo(() => buildPlatformCatalog(PLATFORM_FAMILIES, providers.data), [providers.data]);
  const activeCount = activeFamilyCount(catalog, model.providerFilter);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const openFilters = useCallback(() => setFiltersOpen(true), []);
  const closeFilters = useCallback(() => setFiltersOpen(false), []);

  // Appui long : la feuille habituelle en bibliothèque (favoris, Ma liste,
  // vu — avec les raisons), celle des recommandations sinon.
  const [sheet, setSheet] = useState<{ itemId: string; reasons: RecoReason[] } | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [recoTarget, setRecoTarget] = useState<RecoRowItem | null>(null);
  const onItemLongPress = useCallback((item: RecoRowItem) => {
    if (item.jellyfinItemId) {
      setSheet({ itemId: item.jellyfinItemId, reasons: item.reasons });
      setSheetVisible(true);
    } else {
      setRecoTarget(item);
    }
  }, []);

  const openSettings = useCallback(() => router.push("/settings/personalization"), [router]);
  const later = useCallback(() => {
    // L'onglet reste monté : sans « dismissed », la grille reviendrait au retour.
    model.dismissColdStart();
    router.navigate("/");
  }, [model, router]);

  const { page } = model;

  if (!page) {
    return (
      <SubtleBackground ambient>
        {model.isError ? (
          <View style={[styles.fill, { paddingTop: headerH }]}><RecoErrorState onRetry={model.retry} /></View>
        ) : (
          <View style={{ paddingTop: headerH }}>
            <SkeletonHero />
            <View style={styles.skeletonRow}><SkeletonRow /></View>
            <View style={styles.skeletonRow}><SkeletonRow /></View>
          </View>
        )}
      </SubtleBackground>
    );
  }

  if (page.state === "disabled" && page.rows.length === 0) {
    return (
      <SubtleBackground ambient>
        <View style={[styles.fill, { paddingTop: headerH }]}><RecoDisabledState onOpenSettings={openSettings} /></View>
      </SubtleBackground>
    );
  }

  if (model.phase === "hold") {
    return (
      <SubtleBackground ambient>
        <ColdStartScreen signalCount={page.signalCount} onDone={model.dismissColdStart} onLater={later} />
      </SubtleBackground>
    );
  }

  return (
    <SubtleBackground ambient>
      <Animated.ScrollView
        style={styles.fill}
        contentContainerStyle={{ paddingTop: headerH, paddingBottom: tabBarH + spacing.xl }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onScroll={onScrollChrome}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={model.refreshing}
            onRefresh={model.refresh}
            tintColor={theme.colors.brand.violet}
            progressBackgroundColor={theme.colors.surface.s1}
          />
        }
      >
        {heroSlides.length > 0 && <HeroBanner slides={heroSlides} />}
        <RecoPageHeader showTitle={heroSlides.length === 0} filterCount={activeCount} onOpenFilters={openFilters} />
        <RecoStatusBanner
          page={page}
          hasPersonalizedRows={model.hasPersonalizedRows}
          onOpenColdStart={model.openColdStart}
          onOpenSettings={openSettings}
        />
        <RecoPageRows
          page={page}
          filtered={model.filtered}
          stale={model.stale}
          canOpen={recoNav.canOpen}
          onItemPress={recoNav.open}
          onItemLongPress={onItemLongPress}
        />
        {/* Ajuster ses acteurs se fait ICI, au contact des rangées — masqué
            quand la personnalisation est indisponible (perso coupée, pas de
            clé TMDB : la recherche serait une impasse). */}
        {model.canPersonalize && <LikedActorsPanel />}
      </Animated.ScrollView>

      {sheet && (
        <MediaActionSheet
          visible={sheetVisible}
          itemId={sheet.itemId}
          reasons={sheet.reasons}
          onClose={() => setSheetVisible(false)}
        />
      )}
      <RecoActionSheet item={recoTarget} onClose={() => setRecoTarget(null)} />
      <RecoFilterSheet visible={filtersOpen} onClose={closeFilters} catalog={catalog} providerFilter={model.providerFilter} />
    </SubtleBackground>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  skeletonRow: { marginTop: spacing.xl },
});
