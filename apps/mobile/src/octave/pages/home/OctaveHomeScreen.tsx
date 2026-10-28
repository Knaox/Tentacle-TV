/**
 * Octave mobile — l'ACCUEIL, le même que le bureau : le mot d'accueil, écoutés
 * récemment, les ambiances, les mixes du jour et les albums du moment, les
 * nouveautés de la bibliothèque, « parce que vous avez écouté », les artistes
 * du moment, vos titres les plus écoutés, vos playlists. Une requête (l'accueil
 * du cœur, gardée en cache), tirer pour rafraîchir ; l'attente a la forme de la
 * page, un accueil vide dit quoi faire. Téléphone et tablette.
 */

import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { Music2, Search } from "lucide-react-native";
import { useMusicHome } from "@tentacle-tv/api-client";
import { isHomeEmpty } from "@tentacle-tv/shared/octave";
import { useTheme } from "@/theme";
import { OctavePagesHost } from "../actions/OctavePagesHost";
import { useOctaveNav } from "../env/nav";
import { ShelfSkeleton } from "../ui/Shelf";
import { EmptyState, ErrorState, PillButton } from "../ui/ViewStates";
import { usePageMetrics } from "../ui/pageStyle";
import { HomeGreeting } from "./HomeGreeting";
import { ForYouTop, HomeShelves } from "./HomeSections";
import { MoodsShelf } from "./MoodsShelf";
import { QuickPicks } from "./QuickPicks";

/** La place du mini-lecteur et des onglets sous la page (la coquille les pose par-dessus). */
export const PAGE_BOTTOM_ROOM = 160;

export function OctaveHomeScreen() {
  const { t } = useTranslation("music");
  const theme = useTheme();
  const insets = useSafeAreaInsets();
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
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + PAGE_BOTTOM_ROOM, gap: sectionGap }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.colors.brand.accentLight} />}
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
      </ScrollView>
      <OctavePagesHost />
    </View>
  );
}
