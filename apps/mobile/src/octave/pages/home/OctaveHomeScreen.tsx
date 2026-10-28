/**
 * Octave mobile — l'ACCUEIL, le même que le bureau : le mot d'accueil, écoutés
 * récemment, les ambiances, les mixes du jour et les albums du moment, les
 * nouveautés de la bibliothèque, « parce que vous avez écouté », les artistes
 * du moment, vos titres les plus écoutés, vos playlists. Une requête (l'accueil
 * du cœur, gardée en cache), tirer pour rafraîchir ; l'attente a la forme de la
 * page, un accueil vide dit quoi faire. Téléphone et tablette.
 */

import { useCallback, useState } from "react";
import { RefreshControl, View } from "react-native";
import Animated from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { Music2, Search } from "lucide-react-native";
import { useMusicHome } from "@tentacle-tv/api-client";
import { isHomeEmpty } from "@tentacle-tv/shared/octave";
import { useTheme } from "@/theme";
import { OctaveTopBar } from "../../layout/OctaveTopBar";
import { useOctavePageScroll } from "../../layout/useOctavePageScroll";
import { OctavePagesHost } from "../actions/OctavePagesHost";
import { useOctaveNav } from "../env/nav";
import { ShelfSkeleton } from "../ui/Shelf";
import { EmptyState, ErrorState, PillButton } from "../ui/ViewStates";
import { usePageMetrics, accentTextOf } from "../ui/pageStyle";
import { HomeGreeting } from "./HomeGreeting";
import { ForYouTop, HomeShelves } from "./HomeSections";
import { MoodsShelf } from "./MoodsShelf";
import { QuickPicks } from "./QuickPicks";

export function OctaveHomeScreen() {
  const { t } = useTranslation("music");
  const theme = useTheme();
  const { scrollY, scrollProps } = useOctavePageScroll();
  const nav = useOctaveNav();
  const home = useMusicHome();
  const { sectionGap } = usePageMetrics();
  const [refreshing, setRefreshing] = useState(false);
  const refresh = useCallback(async () => {
    setRefreshing(true);
    await home.refetch().catch(() => undefined);
    setRefreshing(false);
  }, [home]);

  const data = home.data;
  const empty = !!data && isHomeEmpty(data);

  return (
    <View style={{ flex: 1 }}>
      <Animated.ScrollView
        {...scrollProps}
        contentContainerStyle={[scrollProps.contentContainerStyle, { gap: sectionGap }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={accentTextOf(theme)} />}
        showsVerticalScrollIndicator={false}
      >
        <HomeGreeting />
        {home.isError && !data ? <ErrorState onRetry={() => void home.refetch()} /> : null}
        {home.isPending ? (
          <>
            <ShelfSkeleton />
            <ShelfSkeleton />
          </>
        ) : null}
        {empty ? (
          <EmptyState icon={Music2} title={t("views.homeEmptyTitle")} hint={t("views.homeEmptyHint")} action={<PillButton icon={Search} label={t("views.findMusic")} onPress={() => nav.search()} />} />
        ) : null}
        {data && data.recentlyPlayed.length > 0 ? <QuickPicks tracks={data.recentlyPlayed} /> : null}
        <MoodsShelf />
        {data ? <ForYouTop home={data} /> : null}
        {data ? <HomeShelves home={data} gap={sectionGap} /> : null}
      </Animated.ScrollView>
      <OctaveTopBar scrollY={scrollY} title={t("nav.home")} back={false} />
      <OctavePagesHost />
    </View>
  );
}
