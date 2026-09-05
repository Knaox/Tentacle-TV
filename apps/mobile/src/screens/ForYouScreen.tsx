import { useCallback, useState } from "react";
import { RefreshControl, View, StyleSheet } from "react-native";
import Animated from "react-native-reanimated";
import { useRouter } from "expo-router";
import type { RecoReason, RecoRowItem } from "@tentacle-tv/api-client";
import { SkeletonHero, SkeletonRow, SubtleBackground } from "@/components/ui";
import { useHeaderHeight } from "@/components/PersistentHeader";
import { useGlassTabBarHeight } from "@/components/navigation/GlassTabBar";
import { useScrollChromeHandler } from "@/components/navigation/scrollChrome";
import { MediaActionSheet } from "@/components/MediaActionSheet";
import { RecoActionSheet } from "@/components/reco/RecoActionSheet";
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

  // Jusqu'à l'écran Personnalisation : le profil.
  const openSettings = useCallback(() => router.navigate("/profile"), [router]);
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
        <RecoPageHeader showTitle />
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
    </SubtleBackground>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  skeletonRow: { marginTop: spacing.xl },
});
