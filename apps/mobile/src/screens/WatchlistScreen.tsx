import { memo, useCallback, useState, useEffect, useMemo } from "react";
import { View, Text, FlatList, Dimensions, Pressable, StyleSheet, TextInput, ActivityIndicator, ScrollView, Alert } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useWatchlistAll, useJellyfinClient, useMySharedWatchlists, useCreateSharedWatchlist, useDeleteSharedWatchlist, useBatchRemoveWatchlist } from "@tentacle-tv/api-client";
import type { SharedWatchlistSummary } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { PressableCard, ProgressBar, SkeletonCard, FadeIn } from "@/components/ui";
import { MediaActionSheet } from "@/components/MediaActionSheet";
import { SelectionBar } from "@/components/SelectionBar";
import { useMultiSelect } from "@/hooks/useMultiSelect";
import { colors, spacing, typography } from "@/theme";

const POSTER_ASPECT = 2 / 3;
const ITEM_GAP = spacing.sm;

function getNumColumns(): number {
  return Dimensions.get("window").width >= 768 ? 4 : 3;
}

export function WatchlistScreen() {
  const { t } = useTranslation("common");
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const client = useJellyfinClient();
  const { data, isLoading, refetch, isRefetching } = useWatchlistAll();
  const { data: sharedLists } = useMySharedWatchlists();
  const [numColumns, setNumColumns] = useState(getNumColumns);
  const [longPressItemId, setLongPressItemId] = useState<string | null>(null);
  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  const selection = useMultiSelect<string>();
  const batchRemove = useBatchRemoveWatchlist();

  useEffect(() => {
    const sub = Dimensions.addEventListener("change", () => setNumColumns(getNumColumns()));
    return () => sub.remove();
  }, []);

  const cardWidth = useMemo(() => {
    const screenW = Dimensions.get("window").width - spacing.screenPadding * 2;
    return (screenW - ITEM_GAP * (numColumns - 1)) / numColumns;
  }, [numColumns]);

  const handlePress = useCallback(
    (item: MediaItem) => {
      if (selection.active) {
        selection.toggle(item.Id);
      } else {
        router.push(`/media/${item.Id}`);
      }
    },
    [router, selection],
  );

  const handleLongPress = useCallback((item: MediaItem) => {
    if (selection.active) return;
    setLongPressItemId(item.Id);
    setActionSheetVisible(true);
  }, [selection.active]);

  const handleDelete = useCallback(async () => {
    const ids = Array.from(selection.selected);
    if (ids.length === 0) return;
    await batchRemove.mutateAsync(ids);
    selection.clear();
  }, [selection, batchRemove]);

  const handleSelectAll = useCallback(() => {
    if (!data) return;
    if (selection.count === data.length) {
      selection.selectAll([]);
    } else {
      selection.selectAll(data.map((i) => i.Id));
    }
  }, [data, selection]);

  const renderItem = useCallback(
    ({ item }: { item: MediaItem }) => (
      <GridItemCard
        item={item}
        width={cardWidth}
        client={client}
        onPress={() => handlePress(item)}
        onLongPress={() => handleLongPress(item)}
        selectable={selection.active}
        selected={selection.selected.has(item.Id)}
      />
    ),
    [cardWidth, client, handlePress, handleLongPress, selection.active, selection.selected],
  );

  const keyExtractor = useCallback((item: MediaItem) => item.Id, []);

  const skeletons = useMemo(() => {
    const cardH = cardWidth / POSTER_ASPECT;
    return Array.from({ length: numColumns * 3 }).map((_, i) => (
      <View key={i} style={{ width: cardWidth, marginBottom: ITEM_GAP }}>
        <SkeletonCard width={cardWidth} height={cardH} />
      </View>
    ));
  }, [numColumns, cardWidth]);

  const sharedFooter = useMemo(
    () => <SharedListsSection lists={sharedLists ?? []} router={router} />,
    [sharedLists, router],
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
          <Feather name="chevron-left" size={26} color={colors.accent} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>{t("myList")}</Text>
        {data && data.length > 0 && !selection.active && (
          <Pressable onPress={selection.enter} hitSlop={12} style={{ padding: spacing.xs }}>
            <Feather name="check-square" size={20} color={colors.accent} />
          </Pressable>
        )}
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.skeletonGrid}>{skeletons}</View>
      ) : !data || data.length === 0 ? (
        <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl }}>
          <View style={styles.emptyContainer}>
            <Feather name="bookmark" size={48} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>{t("emptyWatchlist")}</Text>
            <Text style={styles.emptyHint}>{t("emptyWatchlistHint")}</Text>
          </View>
          {sharedFooter}
        </ScrollView>
      ) : (
        <FadeIn delay={100} style={{ flex: 1 }}>
          <FlatList
            key={`watchlist-${numColumns}`}
            data={data}
            numColumns={numColumns}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            ListFooterComponent={sharedFooter}
            contentContainerStyle={[
              styles.gridContent,
              selection.active && { paddingBottom: spacing.xxl + 80 },
            ]}
            columnWrapperStyle={{ gap: ITEM_GAP }}
            onRefresh={selection.active ? undefined : refetch}
            refreshing={isRefetching}
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

      {selection.active && (
        <SelectionBar
          count={selection.count}
          totalCount={data?.length ?? 0}
          onSelectAll={handleSelectAll}
          onDelete={handleDelete}
          onCancel={selection.clear}
        />
      )}
    </View>
  );
}

/* ── Section listes partagées ────────────────────── */

function SharedListsSection({ lists, router }: { lists: SharedWatchlistSummary[]; router: ReturnType<typeof useRouter> }) {
  const { t } = useTranslation("common");
  const createList = useCreateSharedWatchlist();
  const deleteList = useDeleteSharedWatchlist();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");

  const handleCreate = useCallback(async () => {
    if (!newName.trim()) return;
    await createList.mutateAsync({ name: newName.trim() });
    setNewName("");
    setShowCreate(false);
  }, [newName, createList]);

  const handleDeleteList = useCallback((list: SharedWatchlistSummary) => {
    Alert.alert(t("deleteList"), t("confirmDeleteList"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("delete"),
        style: "destructive",
        onPress: () => deleteList.mutateAsync(list.id),
      },
    ]);
  }, [t, deleteList]);

  if (lists.length === 0 && !showCreate) return null;

  const roleBadgeColor: Record<string, string> = {
    creator: colors.accent,
    contributor: colors.gold,
    reader: colors.textMuted,
  };

  return (
    <View style={{ marginTop: spacing.lg }}>
      {/* Separator */}
      <View style={{ height: 1, backgroundColor: colors.border, marginBottom: spacing.md }} />
      <Text style={{ ...typography.subtitle, color: colors.textPrimary, marginBottom: spacing.md }}>
        {t("sharedLists")}
      </Text>

      {lists.map((list) => (
        <Pressable
          key={list.id}
          onPress={() => router.push(`/shared-watchlist/${list.id}`)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: colors.surfaceElevated,
            borderRadius: spacing.cardRadius,
            padding: spacing.md,
            marginBottom: spacing.sm,
          }}
        >
          <Feather name="list" size={20} color={colors.accent} />
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Text style={{ ...typography.body, color: colors.textPrimary, fontWeight: "600" }}>{list.name}</Text>
            <Text style={{ ...typography.caption, color: colors.textMuted }}>
              {list.itemCount} {list.itemCount === 1 ? "item" : "items"} · {t("memberCount", { count: list.memberCount })}
            </Text>
          </View>
          <View style={{
            paddingHorizontal: spacing.sm,
            paddingVertical: 2,
            borderRadius: spacing.badgeRadius,
            backgroundColor: `${roleBadgeColor[list.myRole] ?? colors.textMuted}20`,
          }}>
            <Text style={{ ...typography.badge, color: roleBadgeColor[list.myRole] ?? colors.textMuted }}>
              {t(list.myRole)}
            </Text>
          </View>
          {list.myRole === "creator" && (
            <Pressable
              onPress={() => handleDeleteList(list)}
              hitSlop={12}
              style={{ marginLeft: spacing.sm, padding: spacing.xs }}
            >
              <Feather name="trash-2" size={16} color={colors.danger} />
            </Pressable>
          )}
        </Pressable>
      ))}

      {showCreate ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.xs }}>
          <TextInput
            value={newName}
            onChangeText={setNewName}
            placeholder={t("listNamePlaceholder")}
            placeholderTextColor={colors.textDim}
            autoFocus
            style={{
              flex: 1,
              ...typography.body,
              color: colors.textPrimary,
              backgroundColor: colors.surfaceElevated,
              borderRadius: spacing.buttonRadius,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              borderWidth: 1,
              borderColor: colors.borderAccent,
            }}
          />
          <Pressable onPress={handleCreate} disabled={!newName.trim() || createList.isPending} style={{ padding: spacing.sm }}>
            {createList.isPending ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <Feather name="check" size={22} color={newName.trim() ? colors.accent : colors.textDim} />
            )}
          </Pressable>
          <Pressable onPress={() => { setShowCreate(false); setNewName(""); }} style={{ padding: spacing.sm }}>
            <Feather name="x" size={22} color={colors.textMuted} />
          </Pressable>
        </View>
      ) : (
        <Pressable
          onPress={() => setShowCreate(true)}
          style={{ flexDirection: "row", alignItems: "center", marginTop: spacing.xs, paddingVertical: spacing.sm }}
        >
          <Feather name="plus-circle" size={18} color={colors.accent} />
          <Text style={{ ...typography.caption, color: colors.accent, marginLeft: spacing.sm }}>
            {t("createSharedList")}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

/* ── Carte grille (mémoïsée) ─────────────────────── */

interface CardProps {
  item: MediaItem;
  width: number;
  client: ReturnType<typeof useJellyfinClient>;
  onPress: () => void;
  onLongPress?: () => void;
  selectable?: boolean;
  selected?: boolean;
}

const GridItemCard = memo(function GridItemCard({ item, width, client, onPress, onLongPress, selectable, selected }: CardProps) {
  const poster = client.getImageUrl(item.Id, "Primary", { width: 300, quality: 80 });
  const progress = item.UserData?.PlayedPercentage;
  const isWatched = item.UserData?.Played === true;

  return (
    <PressableCard onPress={onPress} onLongPress={onLongPress} style={{ width, marginBottom: spacing.md }}>
      <View style={{ aspectRatio: POSTER_ASPECT, borderRadius: spacing.cardRadius, overflow: "hidden", backgroundColor: colors.surfaceElevated }}>
        <Image source={{ uri: poster }} style={StyleSheet.absoluteFill} contentFit="cover" />
        {progress != null && progress > 0 && !isWatched && (
          <View style={styles.progressContainer}>
            <ProgressBar progress={progress / 100} height={3} />
          </View>
        )}
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
      <Text numberOfLines={1} style={styles.itemTitle}>{item.Name}</Text>
      {item.ProductionYear != null && (
        <Text style={styles.itemYear}>{item.ProductionYear}</Text>
      )}
    </PressableCard>
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
  emptyHint: { ...typography.caption, color: colors.textDim, marginTop: spacing.xs },
  gridContent: { paddingHorizontal: spacing.screenPadding, paddingBottom: spacing.xxl },
  progressContainer: { position: "absolute", bottom: 0, left: 0, right: 0 },
  watchedBadge: { position: "absolute", top: 6, right: 6, width: 20, height: 20, borderRadius: 10, backgroundColor: "#8B5CF6", alignItems: "center", justifyContent: "center" },
  watchedCheck: { color: "#fff", fontSize: 12, fontWeight: "800" as const },
  itemTitle: { ...typography.small, color: colors.textPrimary, fontWeight: "600", marginTop: spacing.xs + 2 },
  itemYear: { ...typography.badge, color: colors.textMuted, marginTop: 2 },
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
