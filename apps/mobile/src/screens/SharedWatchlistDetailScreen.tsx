import { memo, useCallback, useState, useEffect, useMemo } from "react";
import { View, Text, FlatList, Dimensions, Pressable, StyleSheet, RefreshControl, Alert } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useSharedWatchlistItems, useMySharedWatchlists, useJellyfinClient, useDeleteSharedWatchlist, useBatchRemoveSharedItems } from "@tentacle-tv/api-client";
import type { SharedWatchlistItemData } from "@tentacle-tv/api-client";
import { SkeletonCard, FadeIn } from "@/components/ui";
import { MediaActionSheet } from "@/components/MediaActionSheet";
import { ManageMembersSheet } from "@/components/ManageMembersSheet";
import { SelectionBar } from "@/components/SelectionBar";
import { useMultiSelect } from "@/hooks/useMultiSelect";
import { colors, spacing, typography } from "@/theme";

const POSTER_ASPECT = 2 / 3;
const ITEM_GAP = spacing.sm;

function getNumColumns(): number {
  return Dimensions.get("window").width >= 768 ? 4 : 3;
}

interface Props { listId: string }

export function SharedWatchlistDetailScreen({ listId }: Props) {
  const { t } = useTranslation("common");
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const client = useJellyfinClient();
  const { data: items, isLoading, refetch, isRefetching } = useSharedWatchlistItems(listId);
  const { data: lists } = useMySharedWatchlists();
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
      if (selection.active) {
        selection.toggle(item.id);
      } else {
        router.push(`/media/${item.jellyfinItemId}`);
      }
    },
    [router, selection],
  );

  const handleLongPress = useCallback((item: SharedWatchlistItemData) => {
    if (selection.active) return;
    setLongPressItemId(item.jellyfinItemId);
    setActionSheetVisible(true);
  }, [selection.active]);

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
    if (selection.count === items.length) {
      selection.selectAll([]);
    } else {
      selection.selectAll(items.map((i) => i.id));
    }
  }, [items, selection]);

  const renderItem = useCallback(
    ({ item }: { item: SharedWatchlistItemData }) => (
      <SharedItemCard
        item={item}
        width={cardWidth}
        client={client}
        onPress={() => handlePress(item)}
        onLongPress={() => handleLongPress(item)}
        selectable={selection.active}
        selected={selection.selected.has(item.id)}
      />
    ),
    [cardWidth, client, handlePress, handleLongPress, selection.active, selection.selected],
  );

  const keyExtractor = useCallback((item: SharedWatchlistItemData) => item.id, []);

  const roleBadgeColor: Record<string, string> = {
    creator: colors.accent,
    contributor: colors.gold,
    reader: colors.textMuted,
  };

  const skeletons = useMemo(() => {
    const cardH = cardWidth / POSTER_ASPECT;
    return Array.from({ length: numColumns * 3 }).map((_, i) => (
      <View key={i} style={{ width: cardWidth, marginBottom: ITEM_GAP }}>
        <SkeletonCard width={cardWidth} height={cardH} />
      </View>
    ));
  }, [numColumns, cardWidth]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
          <Feather name="chevron-left" size={26} color={colors.accent} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>{list?.name ?? "..."}</Text>
        {list && (
          <View style={{
            paddingHorizontal: spacing.sm,
            paddingVertical: 2,
            borderRadius: spacing.badgeRadius,
            backgroundColor: `${roleBadgeColor[list.myRole] ?? colors.textMuted}20`,
            marginLeft: spacing.sm,
          }}>
            <Text style={{ ...typography.badge, color: roleBadgeColor[list.myRole] ?? colors.textMuted }}>
              {t(list.myRole)}
            </Text>
          </View>
        )}
        <View style={{ marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
          {isCreator && items && items.length > 0 && !selection.active && (
            <Pressable onPress={selection.enter} hitSlop={12} style={{ padding: spacing.xs }}>
              <Feather name="check-square" size={20} color={colors.accent} />
            </Pressable>
          )}
          {isCreator && (
            <Pressable onPress={handleDeleteList} hitSlop={12} style={{ padding: spacing.xs }}>
              <Feather name="trash-2" size={20} color={colors.danger} />
            </Pressable>
          )}
          {isCreator && (
            <Pressable onPress={() => setMembersSheetVisible(true)} hitSlop={12} style={{ padding: spacing.xs }}>
              <Feather name="users" size={20} color={colors.accent} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.skeletonGrid}>{skeletons}</View>
      ) : !items || items.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Feather name="list" size={48} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>{t("noSharedLists")}</Text>
        </View>
      ) : (
        <FadeIn delay={100} style={{ flex: 1 }}>
          <FlatList
            key={`sw-${numColumns}`}
            data={items}
            numColumns={numColumns}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            contentContainerStyle={[
              styles.gridContent,
              selection.active && { paddingBottom: spacing.xxl + 80 },
            ]}
            columnWrapperStyle={{ gap: ITEM_GAP }}
            refreshControl={
              <RefreshControl
                refreshing={isRefetching}
                onRefresh={selection.active ? undefined : refetch}
                tintColor={colors.accent}
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
          totalCount={items?.length ?? 0}
          onSelectAll={handleSelectAll}
          onDelete={handleDeleteItems}
          onCancel={selection.clear}
        />
      )}
    </View>
  );
}

/* ── Carte grille ────────────────────────────────── */

interface CardProps {
  item: SharedWatchlistItemData;
  width: number;
  client: ReturnType<typeof useJellyfinClient>;
  onPress: () => void;
  onLongPress?: () => void;
  selectable?: boolean;
  selected?: boolean;
}

const SharedItemCard = memo(function SharedItemCard({ item, width, client, onPress, onLongPress, selectable, selected }: CardProps) {
  const poster = item.imageTag
    ? client.getImageUrl(item.jellyfinItemId, "Primary", { width: 300, quality: 80, tag: item.imageTag })
    : client.getImageUrl(item.jellyfinItemId, "Primary", { width: 300, quality: 80 });
  const isWatched = item.userData?.played === true;

  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} style={{ width, marginBottom: spacing.md }}>
      <View style={{ aspectRatio: POSTER_ASPECT, borderRadius: spacing.cardRadius, overflow: "hidden", backgroundColor: colors.surfaceElevated }}>
        <Image source={{ uri: poster }} style={StyleSheet.absoluteFill} contentFit="cover" />
        {isWatched && (
          <View style={styles.watchedBadge}>
            <Text style={styles.watchedCheck}>{"\u2713"}</Text>
          </View>
        )}
        {selectable && (
          <View style={[StyleSheet.absoluteFill, styles.selectOverlay, selected && styles.selectOverlayActive]}>
            <View style={[styles.checkbox, selected && styles.checkboxActive]}>
              {selected && <Feather name="check" size={14} color="#fff" />}
            </View>
          </View>
        )}
      </View>
      <Text numberOfLines={1} style={styles.itemTitle}>{item.name}</Text>
      {item.year != null && (
        <Text style={styles.itemYear}>{item.year}</Text>
      )}
    </Pressable>
  );
});

/* ── Styles ──────────────────────────────────────────── */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: spacing.sm,
  },
  backButton: { marginRight: spacing.sm },
  headerTitle: { ...typography.title, color: colors.textPrimary, flex: 1 },
  skeletonGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: spacing.screenPadding,
    gap: ITEM_GAP,
  },
  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center", paddingVertical: spacing.xxxl * 2 },
  emptyTitle: { ...typography.subtitle, color: colors.textMuted, marginTop: spacing.md },
  gridContent: { paddingHorizontal: spacing.screenPadding, paddingBottom: spacing.xxl },
  itemTitle: { ...typography.small, color: colors.textPrimary, fontWeight: "600", marginTop: spacing.xs + 2 },
  itemYear: { ...typography.badge, color: colors.textMuted, marginTop: 2 },
  watchedBadge: { position: "absolute", top: 6, right: 6, width: 20, height: 20, borderRadius: 10, backgroundColor: "#8B5CF6", alignItems: "center", justifyContent: "center" },
  watchedCheck: { color: "#fff", fontSize: 12, fontWeight: "800" },
  selectOverlay: {
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "flex-start",
    alignItems: "flex-end",
    padding: spacing.xs,
  },
  selectOverlayActive: {
    borderWidth: 2,
    borderColor: colors.accent,
    borderRadius: spacing.cardRadius,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
});
