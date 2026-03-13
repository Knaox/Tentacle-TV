import { useState, useCallback } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useMediaItem, useFavorite, useToggleWatchlist, useJellyfinClient } from "@tentacle-tv/api-client";
import { BottomSheet } from "./ui";
import { SharedWatchlistPickerContent } from "./SharedWatchlistPickerSheet";
import { colors, spacing, typography } from "@/theme";

interface Props {
  visible: boolean;
  itemId: string;
  onClose: () => void;
}

export function MediaActionSheet({ visible, itemId, onClose }: Props) {
  const { t } = useTranslation("common");
  const client = useJellyfinClient();
  const { data: item } = useMediaItem(visible ? itemId : undefined);

  // Pour les épisodes, cibler la série parente (les listes filtrent Movie,Series)
  const isEpisode = item?.Type === "Episode";
  const actionTargetId = isEpisode ? (item?.SeriesId ?? itemId) : itemId;
  const { data: targetItem } = useMediaItem(visible && isEpisode ? item?.SeriesId : undefined);
  const actionTarget = isEpisode ? targetItem : item;

  // Affichage header : série parente si épisode
  const displayItem = actionTarget ?? item;
  const displayPoster = displayItem ? client.getImageUrl(displayItem.Id, "Primary", { width: 200, quality: 80 }) : null;

  const favorite = useFavorite(actionTargetId);
  const watchlist = useToggleWatchlist(actionTargetId);
  const [showPicker, setShowPicker] = useState(false);

  const isFav = actionTarget?.UserData?.IsFavorite === true;
  const isInList = actionTarget?.UserData?.Likes === true;

  const handleToggleFav = useCallback(() => {
    if (isFav) favorite.remove.mutate();
    else favorite.add.mutate();
  }, [isFav, favorite]);

  const handleToggleWatchlist = useCallback(() => {
    if (isInList) watchlist.remove.mutate();
    else watchlist.add.mutate();
  }, [isInList, watchlist]);

  const handleClose = useCallback(() => {
    setShowPicker(false);
    onClose();
  }, [onClose]);

  return (
    <BottomSheet
      visible={visible}
      onClose={handleClose}
      snapPoints={showPicker ? [0.65, 0.9] : [0.42, 0.65]}
    >
      {showPicker ? (
        <SharedWatchlistPickerContent
          itemId={actionTargetId}
          alreadyInWatchlist={isInList}
          onClose={handleClose}
        />
      ) : (
        <View style={st.content}>
          {/* Header : poster + titre */}
          {displayItem && (
            <View style={st.header}>
              <View style={st.posterWrap}>
                {displayPoster && <Image source={{ uri: displayPoster }} style={StyleSheet.absoluteFill} contentFit="cover" />}
              </View>
              <View style={st.headerInfo}>
                <Text numberOfLines={2} style={st.title}>{displayItem.Name}</Text>
                {displayItem.ProductionYear != null && (
                  <Text style={st.year}>{displayItem.ProductionYear} · {displayItem.Type}</Text>
                )}
              </View>
            </View>
          )}

          {/* Actions */}
          <View style={st.actions}>
            <ActionRow
              icon="heart"
              label={isFav ? t("removeFromFavorites") : t("addToFavorites")}
              active={isFav}
              activeColor="#ef4444"
              onPress={handleToggleFav}
            />
            <ActionRow
              icon="bookmark"
              label={isInList ? t("removeFromMyList") : t("addToMyList")}
              active={isInList}
              activeColor={colors.accent}
              onPress={handleToggleWatchlist}
            />
            <ActionRow
              icon="list"
              label={t("addToSharedList")}
              active={false}
              activeColor={colors.accent}
              onPress={() => setShowPicker(true)}
            />
          </View>
        </View>
      )}
    </BottomSheet>
  );
}

/* ── Ligne action ─────────────────────────────────── */

function ActionRow({ icon, label, active, activeColor, onPress }: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  active: boolean;
  activeColor: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={st.actionRow}>
      <Feather name={icon} size={20} color={active ? activeColor : colors.textMuted} />
      <Text style={[st.actionLabel, active && { color: activeColor }]}>{label}</Text>
      {active && <View style={[st.dot, { backgroundColor: activeColor }]} />}
    </Pressable>
  );
}

const st = StyleSheet.create({
  content: { flex: 1, paddingHorizontal: spacing.screenPadding },
  header: { flexDirection: "row", alignItems: "center", marginBottom: spacing.lg },
  posterWrap: {
    width: 50, aspectRatio: 2 / 3, borderRadius: 8,
    overflow: "hidden", backgroundColor: colors.surfaceElevated,
  },
  headerInfo: { flex: 1, marginLeft: spacing.md },
  title: { ...typography.body, color: colors.textPrimary, fontWeight: "600" },
  year: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  actions: { gap: 4 },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: spacing.cardRadius,
  },
  actionLabel: { ...typography.body, color: colors.textSecondary, flex: 1, marginLeft: spacing.md },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
