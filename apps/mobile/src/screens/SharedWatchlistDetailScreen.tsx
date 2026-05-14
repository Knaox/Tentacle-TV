import { useCallback, useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  Dimensions,
  StyleSheet,
  RefreshControl,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import {
  useSharedWatchlistItems,
  useMySharedWatchlists,
  useJellyfinClient,
  useDeleteSharedWatchlist,
  useBatchRemoveSharedItems,
  useSharedWatchlistMembers,
} from "@tentacle-tv/api-client";
import type { SharedWatchlistItemData } from "@tentacle-tv/api-client";
import { FadeIn, SkeletonCard, SubtleBackground } from "@/components/ui";
import { MediaActionSheet } from "@/components/MediaActionSheet";
import { ManageMembersSheet } from "@/components/ManageMembersSheet";
import { SelectionBar } from "@/components/SelectionBar";
import { SelectableGridCard } from "@/components/watchlist/SelectableGridCard";
import { SharedHeader } from "@/components/shared-watchlist/SharedHeader";
import { useMultiSelect } from "@/hooks/useMultiSelect";
import {
  colors,
  spacing,
  typography,
  BRAND,
  FONT_FAMILY,
} from "@/theme";

const POSTER_ASPECT = 2 / 3;
const ITEM_GAP = spacing.sm;

function getNumColumns(): number {
  return Dimensions.get("window").width >= 768 ? 4 : 3;
}

interface Props { listId: string }

/**
 * Détail d'une watchlist partagée — pattern cinematic :
 *  - SubtleBackground ambient violet
 *  - SharedHeader (back / titre Inter ExtraBold / role / actions / membres)
 *  - Grille 2:3 SelectableGridCard (multi-select creator only)
 *  - SelectionBar polished avec haptic, ManageMembersSheet legacy
 */
export function SharedWatchlistDetailScreen({ listId }: Props) {
  const { t } = useTranslation("common");
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const client = useJellyfinClient();
  const { data: items, isLoading, refetch, isRefetching } = useSharedWatchlistItems(listId);
  const { data: lists } = useMySharedWatchlists();
  const { data: members } = useSharedWatchlistMembers(listId);
  const list = lists?.find((l) => l.id === listId);
  const [numColumns, setNumColumns] = useState(getNumColumns);
  const [longPressItemId, setLongPressItemId] = useState<string | null>(null);
  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  const [membersSheetVisible, setMembersSheetVisible] = useState(false);
  const selection = useMultiSelect<string>();
  const deleteListMutation = useDeleteSharedWatchlist();
  const batchRemoveItems = useBatchRemoveSharedItems(listId);
  const isCreator = list?.myRole === "creator";

  useEffect(() => {
    const sub = Dimensions.addEventListener("change", () => setNumColumns(getNumColumns()));
    return () => sub.remove();
  }, []);

  const cardWidth = useMemo(() => {
    const screenW = Dimensions.get("window").width - spacing.screenPadding * 2;
    return (screenW - ITEM_GAP * (numColumns - 1)) / numColumns;
  }, [numColumns]);

  const handlePress = useCallback(
    (item: SharedWatchlistItemData) => {
      if (selection.active) selection.toggle(item.id);
      else router.push(`/media/${item.jellyfinItemId}`);
    },
    [router, selection],
  );

  const handleLongPress = useCallback(
    (item: SharedWatchlistItemData) => {
      if (selection.active) return;
      setLongPressItemId(item.jellyfinItemId);
      setActionSheetVisible(true);
    },
    [selection.active],
  );

  const handleDeleteList = useCallback(() => {
    Alert.alert(t("deleteList"), t("confirmDeleteList"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("delete"),
        style: "destructive",
        onPress: async () => {
          await deleteListMutation.mutateAsync(listId);
          router.back();
        },
      },
    ]);
  }, [t, deleteListMutation, listId, router]);

  const handleDeleteItems = useCallback(async () => {
    const ids = Array.from(selection.selected);
    if (ids.length === 0) return;
    await batchRemoveItems.mutateAsync(ids);
    selection.clear();
  }, [selection, batchRemoveItems]);

  const handleSelectAll = useCallback(() => {
    if (!items) return;
    if (selection.count === items.length) selection.selectAll([]);
    else selection.selectAll(items.map((i) => i.id));
  }, [items, selection]);

  const renderItem = useCallback(
    ({ item }: { item: SharedWatchlistItemData }) => {
      const poster = item.imageTag
        ? client.getImageUrl(item.jellyfinItemId, "Primary", { width: 300, quality: 80, tag: item.imageTag })
        : client.getImageUrl(item.jellyfinItemId, "Primary", { width: 300, quality: 80 });
      return (
        <SelectableGridCard
          posterUri={poster}
          title={item.name}
          year={item.year ?? null}
          watched={item.userData?.played === true}
          width={cardWidth}
          selectable={selection.active}
          selected={selection.selected.has(item.id)}
          onPress={() => handlePress(item)}
          onLongPress={() => handleLongPress(item)}
        />
      );
    },
    [cardWidth, client, handlePress, handleLongPress, selection.active, selection.selected],
  );

  const keyExtractor = useCallback((item: SharedWatchlistItemData) => item.id, []);

  const skeletons = useMemo(() => {
    const cardH = cardWidth / POSTER_ASPECT;
    return Array.from({ length: numColumns * 3 }).map((_, i) => (
      <View key={i} style={{ width: cardWidth, marginBottom: ITEM_GAP }}>
        <SkeletonCard width={cardWidth} height={cardH} />
      </View>
    ));
  }, [numColumns, cardWidth]);

  const totalItems = items?.length ?? 0;

  return (
    <SubtleBackground ambient>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <SharedHeader
          list={list}
          members={members}
          itemCount={totalItems}
          selectionActive={selection.active}
          showSelectionToggle={isCreator === true && totalItems > 0}
          onBack={() => router.back()}
          onEnterSelection={selection.enter}
          onOpenMembers={() => setMembersSheetVisible(true)}
          onDeleteList={handleDeleteList}
        />

        {isLoading ? (
          <View style={styles.skeletonGrid}>{skeletons}</View>
        ) : totalItems === 0 ? (
          <View style={styles.emptyContainer}>
            <Feather name="film" size={48} color={BRAND.light} style={{ opacity: 0.6 }} />
            <Text style={styles.emptyTitle}>{t("noSharedLists")}</Text>
            <Text style={styles.emptyHint}>{t("emptyWatchlistHint")}</Text>
          </View>
        ) : (
          <FadeIn delay={80} style={{ flex: 1 }}>
            <FlatList
              key={`sw-${numColumns}`}
              data={items}
              numColumns={numColumns}
              keyExtractor={keyExtractor}
              renderItem={renderItem}
              contentContainerStyle={[
                styles.gridContent,
                selection.active && { paddingBottom: spacing.xxxl + 100 },
              ]}
              columnWrapperStyle={{ gap: ITEM_GAP }}
              refreshControl={
                <RefreshControl
                  refreshing={isRefetching}
                  onRefresh={selection.active ? undefined : refetch}
                  tintColor={BRAND.violet}
                />
              }
              showsVerticalScrollIndicator={false}
            />
          </FadeIn>
        )}

        {longPressItemId && (
          <MediaActionSheet
            visible={actionSheetVisible}
            itemId={longPressItemId}
            onClose={() => setActionSheetVisible(false)}
          />
        )}

        {list && (
          <ManageMembersSheet
            visible={membersSheetVisible}
            watchlistId={listId}
            watchlistName={list.name}
            onClose={() => setMembersSheetVisible(false)}
          />
        )}

        {selection.active && (
          <SelectionBar
            count={selection.count}
            totalCount={totalItems}
            onSelectAll={handleSelectAll}
            onDelete={handleDeleteItems}
            onCancel={selection.clear}
          />
        )}
      </View>
    </SubtleBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  skeletonGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: spacing.screenPadding,
    gap: ITEM_GAP,
  },
  gridContent: { paddingHorizontal: spacing.screenPadding, paddingBottom: spacing.xxxl + 60 },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.screenPadding,
    gap: spacing.sm,
  },
  emptyTitle: {
    ...typography.subtitle,
    fontFamily: FONT_FAMILY.bold,
    fontSize: 18,
    color: colors.textPrimary,
    marginTop: spacing.md,
    letterSpacing: -0.3,
  },
  emptyHint: {
    ...typography.caption,
    fontFamily: FONT_FAMILY.regular,
    color: colors.textMuted,
    textAlign: "center",
    maxWidth: 280,
  },
});
