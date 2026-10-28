/**
 * Octave mobile — la page d'une liste de titres (playlist, « Titres likés ») : la tête de page, la barre de
 * la liste (chercher, trier, filtrer), les titres qu'on glisse à leur place, et ses états (attente à la place
 * des rangées, vide, « aucun titre ne correspond »). La barre du haut garde le retour (verre) et, à droite,
 * les actions de la page. Les feuilles et avis des pages (m3) sont montés ici comme sur toute page d'Octave.
 */

import { type ReactElement, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSharedValue, type SharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { SearchX } from "lucide-react-native";
import type { useListOrder } from "@tentacle-tv/api-client";
import type { ListRow } from "@tentacle-tv/shared/octave";
import { typography, useTheme } from "@/theme";
import { OctavePagesHost } from "../../pages";
import { PageTopBar } from "../../pages/entity/PageTopBar";
import { EmptyState, PillButton, TrackRowsSkeleton } from "../../pages/ui/ViewStates";
import { usePageMetrics } from "../../pages/ui/pageStyle";
import { ListControls } from "../controls/ListControls";
import { ReorderableTrackList } from "../reorder/ReorderableTrackList";

type ListOrder = ReturnType<typeof useListOrder>;

interface Props {
  title: string;
  contextId: string;
  /** La tête de page, qui reçoit le défilement (image qui grandit, s'efface). */
  hero: (scrollY: SharedValue<number>) => ReactElement;
  natural: readonly ListRow[];
  order: ListOrder;
  loading: boolean;
  /** L'état vide (aucun titre du tout). */
  empty: ReactElement;
  /** Mode « Modifier » : le « – » de chaque rangée (playlist modifiable seulement). */
  onRemove?: (row: ListRow) => void;
  editHint?: string | null;
  /** À droite de la barre du haut. */
  actions?: ReactNode;
}

export function ListPage({ title, contextId, hero, natural, order, loading, empty, onRemove, editHint, actions }: Props) {
  const { t } = useTranslation("music");
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { gutter, bottomInset } = usePageMetrics();
  const scrollY = useSharedValue(0);
  const rows = order.rows;
  const block = order.reorder?.block ?? null;

  const header = (
    <View>
      {hero(scrollY)}
      {!loading && natural.length > 0 && order.capable ? (
        <ListControls
          gutter={gutter}
          query={order.query}
          onQuery={order.setQuery}
          filter={order.filter}
          filters={order.filters}
          onFilter={order.setFilter}
          prefs={order.prefs}
          sorts={order.sorts}
          onSort={order.onSort}
          shown={rows.length}
          total={natural.length}
          block={block}
        />
      ) : null}
      {editHint ? <Text style={[typography.small, styles.hint, { color: theme.colors.text.tertiary, paddingHorizontal: gutter }]}>{editHint}</Text> : null}
      {loading ? <TrackRowsSkeleton count={10} gutter={gutter} /> : null}
      {!loading && natural.length === 0 ? empty : null}
      {!loading && natural.length > 0 && rows.length === 0 ? (
        <EmptyState icon={SearchX} title={t("listOrder.noMatch")} hint={t("listOrder.noMatchHint")} action={<PillButton label={t("listOrder.reset")} onPress={order.reset} />} />
      ) : null}
    </View>
  );

  return (
    <View style={styles.page}>
      <ReorderableTrackList
        rows={loading ? [] : rows}
        contextId={contextId}
        gutter={gutter}
        scrollY={scrollY}
        header={header}
        bottomInset={bottomInset}
        reorder={order.reorder}
        onRemove={onRemove}
      />
      <PageTopBar title={title} scrollY={scrollY} threshold={320} />
      {actions ? <View style={[styles.actions, { top: insets.top + 4, right: gutter - 4 }]}>{actions}</View> : null}
      <OctavePagesHost />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  hint: { paddingBottom: 8 },
  actions: { position: "absolute", zIndex: 11, flexDirection: "row", alignItems: "center", gap: 8 },
});
