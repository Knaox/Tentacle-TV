import { useCallback, useMemo, useState } from "react";
import { RefreshControl, View, StyleSheet } from "react-native";
import Animated, { useComposedEventHandler } from "react-native-reanimated";
import { useRouter } from "expo-router";
import { activeFamilyCount, buildPlatformCatalog, useJellyfinClient, useWatchProviders } from "@tentacle-tv/api-client";
import { PLATFORM_FAMILIES } from "@tentacle-tv/shared";
import { KeyboardAvoidingArea, SkeletonHero, SkeletonRow, SubtleBackground } from "@/components/ui";
import { HeroBanner } from "@/components/HeroBanner";
import { useHeroMetrics } from "@/components/heroMetrics";
import { useHeroInView } from "@/components/hero/useHeroInView";
import { useHeaderHeight } from "@/components/PersistentHeader";
import { useGlassTabBarHeight } from "@/components/navigation/GlassTabBar";
import { useScrollChromeHandler } from "@/components/navigation/scrollChrome";
import { recoHeroSlides } from "@/components/reco/hero/recoHeroSlides";
import { RecoFilterSheet } from "@/components/reco/filters/RecoFilterSheet";
import { LikedActorsPanel } from "@/components/reco/people/LikedActorsPanel";
import { ColdStartScreen } from "@/components/reco/coldstart/ColdStartScreen";
import { RecoDisabledState, RecoErrorState, RecoTmdbOffState } from "@/components/reco/page/RecoErrorState";
import { RecoPageHeader } from "@/components/reco/page/RecoPageHeader";
import { RecoPageRows } from "@/components/reco/page/RecoPageRows";
import { RecoRefineTeaser } from "@/components/reco/section/RecoRefineTeaser";
import { RecoStatusBanner } from "@/components/reco/page/RecoStatusBanner";
import { useRecoPageModel } from "@/components/reco/page/useRecoPageModel";
import { useRecoNavigation } from "@/hooks/useRecoNavigation";
import { spacing, useTheme } from "@/theme";

interface Props {
  /** La place réservée sous l'en-tête à la barre « Pour vous · Affiner », fixée par-dessus. */
  topInset: number;
  /** L'entrée vers « Affiner » glissée entre les rangées. */
  onOpenRefine: () => void;
}

/**
 * La section « Pour vous » de l'onglet — la page de recommandations, rendue
 * d'un coup depuis la page servie (cache persisté, revalidée en silence) :
 * jamais vide, un bandeau dit ce qui se passe. Sans page : squelettes, ou
 * l'erreur avec « Réessayer » ; démarrage à froid : la grille ; vieux serveur
 * en mode désactivé : l'écran historique.
 */
export function RecoFeedView({ topInset, onOpenRefine }: Props) {
  const theme = useTheme();
  const router = useRouter();
  // Le contenu commence sous l'en-tête ET sous la barre des sections.
  const headerH = useHeaderHeight() + topInset;
  const tabBarH = useGlassTabBarHeight();
  const onScrollChrome = useScrollChromeHandler();
  // Le héros défilé hors de la vue suspend sa rotation (il passe sous la
  // barre des sections avant de passer sous l'en-tête).
  const { bannerH } = useHeroMetrics();
  const hero = useHeroInView(bannerH + topInset);
  const onScroll = useComposedEventHandler([onScrollChrome, hero.handler]);
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
          <View style={[styles.fill, { paddingTop: headerH }]}>
            <RecoErrorState onRetry={model.retry} />
          </View>
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

  if (page.tmdbConfigured === false && page.rows.length === 0) {
    return (
      <SubtleBackground ambient>
        <View style={[styles.fill, { paddingTop: headerH }]}>
          <RecoTmdbOffState />
        </View>
      </SubtleBackground>
    );
  }

  if (page.state === "disabled" && page.rows.length === 0) {
    return (
      <SubtleBackground ambient>
        <View style={[styles.fill, { paddingTop: headerH }]}>
          <RecoDisabledState onOpenSettings={openSettings} />
        </View>
      </SubtleBackground>
    );
  }

  if (model.phase === "hold") {
    return (
      <SubtleBackground ambient>
        <ColdStartScreen signalCount={page.signalCount} onDone={model.dismissColdStart} onLater={later} topInset={topInset} />
      </SubtleBackground>
    );
  }

  return (
    <SubtleBackground ambient>
      <KeyboardAvoidingArea ios={false}>
        <Animated.ScrollView
          style={styles.fill}
          contentContainerStyle={{ paddingTop: headerH, paddingBottom: tabBarH + spacing.xl }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onScroll={onScroll}
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
          {heroSlides.length > 0 && <HeroBanner slides={heroSlides} inView={hero.inView} />}
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
            teaser={page.personalized !== false ? <RecoRefineTeaser onPress={onOpenRefine} /> : undefined}
            canOpen={recoNav.canOpen}
            onItemPress={recoNav.open}
          />
          {/* Ajuster ses acteurs se fait ICI, au contact des rangées — masqué
              quand la personnalisation est indisponible (perso coupée, pas de
              clé TMDB : la recherche serait une impasse). */}
          {model.canPersonalize && <LikedActorsPanel />}
        </Animated.ScrollView>
      </KeyboardAvoidingArea>

      <RecoFilterSheet visible={filtersOpen} onClose={closeFilters} catalog={catalog} providerFilter={model.providerFilter} />
    </SubtleBackground>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  skeletonRow: { marginTop: spacing.xl },
});
