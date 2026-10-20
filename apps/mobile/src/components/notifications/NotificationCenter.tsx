import { useCallback, useState, type ReactNode } from "react";
import { ActivityIndicator, RefreshControl, SectionList, Text, type SectionListProps } from "react-native";
import { useTranslation } from "react-i18next";
import {
  formatNotifTitle,
  notificationAgo,
  notifBodyText,
  type AppNotification,
  type NotificationPeriod,
} from "@tentacle-tv/api-client";
import { ProblemState } from "@/components/problems/ProblemState";
import { usePageProblem } from "@/components/problems/usePageProblem";
import { useBottomSheetScroll } from "@/components/ui/sheet/sheetScroll";
import { spacing, useTheme } from "@/theme";
import { NotifCenterHeader } from "./NotifCenterHeader";
import { NotifEmptyState } from "./NotifEmptyState";
import { SwipeableNotifRow } from "./SwipeableNotifRow";
import { useNotificationCenter } from "./useNotificationCenter";

type Translate = (key: string, options?: Record<string, unknown>) => string;

const PERIOD_KEY: Record<NotificationPeriod, string> = {
  today: "groupToday",
  yesterday: "groupYesterday",
  week: "groupThisWeek",
  earlier: "groupEarlier",
};

/** « il y a … » des clés du mobile, la date au-delà d'une semaine (règle partagée). */
function formatAgo(createdAt: string, t: Translate, locale: string): string {
  const ago = notificationAgo(createdAt);
  switch (ago.unit) {
    case "now": return t("justNow");
    case "minutes": return t("minutesAgo", { count: ago.count });
    case "hours": return t("hoursAgo", { count: ago.count });
    case "days": return t("daysAgo", { count: ago.count });
    default: return ago.date.toLocaleDateString(locale);
  }
}

interface Props {
  open: boolean;
  /** Retirer le centre (avant une navigation, ou par la croix). */
  onClose: () => void;
  /** Le cadre qui le présente : feuille du téléphone, panneau de la tablette. L'en-tête est à part (il prend le glissement de la feuille). */
  frame: (header: ReactNode, body: ReactNode) => ReactNode;
}

/**
 * Le centre des notifications, le même dans la feuille et dans le panneau :
 * en-tête fixe (filtres, tout marquer comme lu, menu), puis les
 * notifications par période. Toucher ouvre SA destination ; glisser marque
 * lue ou supprime ; l'appui long sélectionne.
 */
export function NotificationCenter({ open, onClose, frame }: Props) {
  const { t, i18n } = useTranslation("notifications");
  const { colors } = useTheme();
  const c = useNotificationCenter({ open, onLeave: onClose });
  // Une liste qui n'a pas pu se lire n'est pas « aucune notification ».
  const failure = usePageProblem(c.query.data ? null : c.query.error, {
    target: "tentacle", availability: { canGoBack: false }, onRetry: () => void c.query.refetch(),
  });

  const { hasRoute, openOne, markRead, remove, selectionMode, selected, toggle, startSelection } = c;
  const renderItem = useCallback(({ item: n }: { item: AppNotification }) => (
    <SwipeableNotifRow
      notif={n}
      title={formatNotifTitle(n, t)}
      body={notifBodyText(n)}
      ago={formatAgo(n.createdAt, t, i18n.language)}
      hasRoute={hasRoute(n)}
      onOpen={openOne}
      onMarkRead={markRead}
      onDelete={remove}
      selectionMode={selectionMode}
      isSelected={selected.has(n.id)}
      onToggleSelect={toggle}
      onLongPress={startSelection}
    />
  ), [t, i18n.language, hasRoute, openOne, markRead, remove, selectionMode, selected, toggle, startSelection]);

  const header = (
    <NotifCenterHeader
      filter={c.filter}
      onFilter={c.setFilter}
      unread={c.unread}
      total={c.visible.length}
      selectionMode={c.selectionMode}
      selectedCount={c.selected.size}
      onMarkAll={c.markAll}
      onMore={c.openMenu}
      onSelectAll={c.selectAll}
      onDeleteSelected={c.deleteSelected}
      onCancelSelection={c.exitSelection}
      onClose={onClose}
    />
  );

  const body = (
    <SheetSectionList
      sections={c.sections}
      keyExtractor={(n) => n.id}
      renderItem={renderItem}
      stickySectionHeadersEnabled={false}
      renderSectionHeader={({ section }) => (
        <Text
          accessibilityRole="header"
          style={{ fontSize: 12, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase", color: colors.text.quaternary, marginBottom: 8, marginTop: 14 }}
        >
          {t(PERIOD_KEY[section.key as NotificationPeriod])}
        </Text>
      )}
      ListHeaderComponent={c.visible.length > 0 && !c.selectionMode ? (
        <Text style={{ fontSize: 11.5, color: colors.text.quaternary, marginTop: 10 }}>{t("swipeHintBoth")}</Text>
      ) : null}
      contentContainerStyle={{ paddingHorizontal: spacing.screenPadding, paddingBottom: 32 }}
      onEndReached={c.loadMore}
      onEndReachedThreshold={0.5}
      refresh={c.refresh}
      ListFooterComponent={c.query.isFetchingNextPage || (c.visible.length === 0 && !c.showsEmpty && !failure.model)
        ? <ActivityIndicator color={colors.text.tertiary} style={{ marginVertical: 18 }} accessibilityLabel={t("loadingMore")} />
        : null}
      ListEmptyComponent={failure.model ? (
        <ProblemState embedded model={failure.model} onAction={failure.onAction} busy={c.query.isRefetching ? "retry" : null} />
      ) : c.showsEmpty ? (
        <NotifEmptyState filter={c.filter} onShowAll={() => c.setFilter("all")} />
      ) : null}
      keyboardShouldPersistTaps="handled"
    />
  );

  return <>{frame(header, body)}</>;
}

/**
 * La liste, branchée sur la feuille qui la porte (le crochet doit être lu
 * SOUS la feuille : le corps y est rendu, le centre au-dessus). Tirer pour
 * rafraîchir hors d'une feuille seulement (panneau de la tablette) : dans la
 * feuille, tirer vers le bas depuis le haut la RÉDUIT — les deux gestes se
 * disputaient le même doigt. La feuille relit tout à chaque ouverture.
 */
function SheetSectionList({ refresh, ...props }: SectionListProps<AppNotification> & { refresh: () => Promise<void> }) {
  const sheetScroll = useBottomSheetScroll();
  const { colors } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const pull = useCallback(() => {
    setRefreshing(true);
    void refresh().finally(() => setRefreshing(false));
  }, [refresh]);
  const inSheet = sheetScroll.onScroll !== undefined;
  return (
    <SectionList
      {...props}
      {...sheetScroll}
      refreshControl={inSheet ? undefined : <RefreshControl refreshing={refreshing} onRefresh={pull} tintColor={colors.text.tertiary} />}
    />
  );
}
