import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import type { OfflineSeriesGroup } from "@tentacle-tv/offline-core";
import type { OfflineEntry } from "@/offline/engineApi";
import { FadeIn, IconButton, SubtleBackground } from "@/components/ui";
import { homeRowFadeDelay } from "@/components/home/homeRowFade";
import { useScrollChromeHandler } from "@/components/navigation/scrollChrome";
import { useHeaderHeight } from "@/components/PersistentHeader";
import { ConnectivityPill } from "@/offline/ConnectivityPill";
import { OfflineRowActionsSheet } from "@/offline/manage/OfflineRowActionsSheet";
import { backOrHome, goHome } from "@/utils/backOrHome";
import { spacing, typography, FONT_FAMILY, useGrid, useThemedStyles, type AppTheme } from "@/theme";
import { OfflineBackOnlineCard } from "./OfflineBackOnlineCard";
import { OfflineCatalogSections } from "./OfflineCatalogSections";
import { OfflineCatalogToolbar } from "./OfflineCatalogToolbar";
import { OfflineEmptyState } from "./OfflineEmptyState";
import { OfflineHomeHero } from "./OfflineHomeHero";
import { OfflineLibrarySkeleton } from "./OfflineLibrarySkeleton";
import { OfflineMediaRow } from "./OfflineMediaRow";
import { OfflineStateStrip } from "./OfflineStateStrip";
import { ALL_LIBRARIES, useOfflineCatalog, type OfflineCatalogFilter } from "./useOfflineCatalog";

interface Props {
  /**
   * Ouvert comme une page (depuis « Sur cet appareil », en ligne) : son propre
   * en-tête ; sinon c'est l'onglet Accueil hors ligne, sous l'en-tête flottant.
   */
  standalone?: boolean;
}

/**
 * L'accueil du mode hors ligne, dans la grammaire de l'accueil en ligne : le
 * bandeau cinématique des titres de l'appareil, la carte « Sur cet appareil »
 * (titres, place et sa jauge, transferts), les rangées « Reprendre la
 * lecture » et « À suivre » tirées de la progression locale, puis la
 * recherche, le filtre et les grilles Films et Séries. Une recherche active ne
 * garde que les grilles. Tout vient de la base et des snapshots locaux — cet
 * écran ne touche jamais le réseau.
 */
export function OfflineLibraryScreen({ standalone = false }: Props) {
  const { t } = useTranslation(["offline", "common"]);
  const st = useThemedStyles(makeStyles);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const headerH = useHeaderHeight();
  const onScrollChrome = useScrollChromeHandler();
  const layout = useGrid({ phoneColumns: 3 });
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<OfflineCatalogFilter>(ALL_LIBRARIES);
  const [more, setMore] = useState<OfflineEntry | null>(null);
  const { movies, series, hero, resume, nextUp, libraries, hasContent, ready } = useOfflineCatalog(search, filter);
  // Une bibliothèque filtrée dont le dernier titre vient d'être retiré : retour à « Tout ».
  useEffect(() => {
    if (filter !== ALL_LIBRARIES && !libraries.some((library) => library.id === filter)) setFilter(ALL_LIBRARIES);
  }, [filter, libraries]);

  const play = useCallback((entry: OfflineEntry) => router.push(`/watch/${entry.itemId}` as never), [router]);
  const info = useCallback((entry: OfflineEntry) => router.push(`/on-device/item/${entry.itemId}` as never), [router]);
  const openSeries = useCallback(
    (group: OfflineSeriesGroup) => router.push(`/on-device/series/${encodeURIComponent(group.key)}` as never),
    [router],
  );

  const searching = search.trim().length > 0;
  const noResult = ready && hasContent && movies.length === 0 && series.length === 0;

  return (
    <SubtleBackground ambient>
      {standalone && (
        <View style={[st.header, { paddingTop: Math.max(insets.top, 24) + 8 }]}>
          <IconButton icon="←" onPress={() => backOrHome(router)} accessibilityLabel={t("common:back")} />
          <Text style={st.headerTitle} accessibilityRole="header" numberOfLines={1}>{t("offline:tabOnDevice")}</Text>
          <ConnectivityPill variant="inline" />
          <IconButton icon="home" onPress={() => goHome(router)} accessibilityLabel={t("offline:emptyGoHome")} />
        </View>
      )}

      {!ready ? (
        <View style={{ paddingTop: standalone ? spacing.md : headerH }}>
          <OfflineLibrarySkeleton layout={layout} />
        </View>
      ) : !hasContent ? (
        <OfflineEmptyState standalone={standalone} />
      ) : (
        <Animated.ScrollView
          style={st.wrap}
          contentContainerStyle={{ paddingTop: standalone ? spacing.md : headerH, paddingBottom: 120 }}
          onScroll={onScrollChrome}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          {!searching && <OfflineHomeHero entries={hero} onPlay={play} onInfo={info} />}
          {!searching && (
            <FadeIn delay={homeRowFadeDelay(0)}>
              <OfflineStateStrip showManage={!standalone} />
              <OfflineBackOnlineCard />
            </FadeIn>
          )}
          {!searching && resume.length > 0 && (
            <FadeIn delay={homeRowFadeDelay(1)}>
              <OfflineMediaRow title={t("common:resumeWatching")} entries={resume} onOpen={info} onLongPress={setMore} />
            </FadeIn>
          )}
          {!searching && nextUp.length > 0 && (
            <FadeIn delay={homeRowFadeDelay(2)}>
              <OfflineMediaRow title={t("common:nextEpisode")} entries={nextUp} onOpen={info} onLongPress={setMore} />
            </FadeIn>
          )}
          <FadeIn delay={homeRowFadeDelay(3)}>
            <OfflineCatalogToolbar search={search} onSearch={setSearch} filter={filter} onFilter={setFilter} libraries={libraries} />
          </FadeIn>
          {noResult && <Text style={st.noResult}>{t("offline:noResults")}</Text>}
          <OfflineCatalogSections
            movies={movies}
            series={series}
            layout={layout}
            fadeIndex={4}
            onMovie={info}
            onMovieLongPress={setMore}
            onSeries={openSeries}
          />
        </Animated.ScrollView>
      )}

      <OfflineRowActionsSheet entry={more} onClose={() => setMore(null)} onPlay={play} onInfo={info} />
    </SubtleBackground>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    wrap: { flex: 1 },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingHorizontal: spacing.screenPadding,
      paddingBottom: spacing.sm,
    },
    headerTitle: { ...typography.title, fontFamily: FONT_FAMILY.extrabold, color: t.colors.text.primary, flex: 1, letterSpacing: -0.4 },
    noResult: { ...typography.body, color: t.colors.text.tertiary, textAlign: "center", marginTop: spacing.xl },
  });
