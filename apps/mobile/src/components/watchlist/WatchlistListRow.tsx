import { memo } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useJellyfinClient, useToggleWatchlistForItem, watchProgress, watchStage } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { PressableCard, ProgressBar } from "@/components/ui";
import { ctlGradient, spacing, FONT_FAMILY, useTheme, useThemedStyles, withAlpha, type AppTheme } from "@/theme";
import { useProgressText } from "./useRemainingLabel";

/**
 * Une ligne de la vue liste de Ma liste : affiche 56 × 84, titre 15 semi-gras,
 * méta 12, progression en barre ET en mots ; à droite, Lire (rond plein de 44
 * au dégradé de marque) et Retirer (rond de 44). Toucher la ligne ouvre la
 * fiche — ou coche, en sélection ; l'appui long ouvre la feuille d'actions.
 */
export const WatchlistListRow = memo(function WatchlistListRow({
  item, selecting, selected, pendingPlay, onPress, onLongPress, onPlay, onRemoved,
}: {
  item: MediaItem;
  selecting: boolean;
  selected: boolean;
  pendingPlay: boolean;
  onPress: (item: MediaItem) => void;
  onLongPress: (item: MediaItem) => void;
  onPlay: (item: MediaItem) => void;
  onRemoved: (item: MediaItem) => void;
}) {
  const { t } = useTranslation("watchlist");
  const { t: tc } = useTranslation("common");
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const client = useJellyfinClient();
  const progressText = useProgressText();
  const { remove } = useToggleWatchlistForItem(item);
  const stage = watchStage(item);
  const percent = watchProgress(item);
  const meta = [item.ProductionYear, item.Type === "Movie" ? tc("movie") : tc("series")].filter(Boolean).join(" · ");

  // Retrait annoncé AU GESTE : la ligne se démonte aussitôt (optimiste), et
  // React Query ne rappelle pas le `onSuccess` d'un `mutate` démonté.
  const handleRemove = () => {
    remove.mutate();
    onRemoved(item);
  };

  return (
    <View style={[styles.row, selected && styles.rowSelected]}>
      {/* `PressableCard` pose son style sur sa vue INTÉRIEURE : la place que
          la ligne lui donne se règle ici, sur une enveloppe. */}
      <View style={styles.mainSlot}>
        <PressableCard
          onPress={() => onPress(item)}
          onLongPress={() => onLongPress(item)}
          accessibilityRole="button"
          accessibilityLabel={item.Name}
          accessibilityState={selecting ? { selected } : undefined}
          scaleValue={0.985}
          style={styles.main}
        >
          <View style={styles.poster}>
            <Image
              source={{ uri: client.getImageUrl(item.Id, "Primary", { width: 120, quality: 80 }) }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
            />
            {selecting && (
              <View style={[styles.check, selected && styles.checkOn]}>
                {selected && <Feather name="check" size={12} color="#FFFFFF" />}
              </View>
            )}
          </View>
          <View style={styles.body}>
            <Text style={styles.title} numberOfLines={1}>{item.Name}</Text>
            <Text style={styles.meta} numberOfLines={1}>{meta}</Text>
            {percent != null && stage !== "new" && <ProgressBar progress={percent / 100} style={styles.bar} />}
            <Text style={[styles.progress, stage === "watched" && { color: colors.status.success }]} numberOfLines={1}>
              {progressText(item)}
            </Text>
          </View>
        </PressableCard>
      </View>

      {!selecting && (
        <View style={styles.actions}>
          <Pressable
            onPress={() => onPlay(item)}
            disabled={pendingPlay}
            accessibilityRole="button"
            accessibilityLabel={t("playTitle", { title: item.Name })}
            style={({ pressed }) => [styles.round, pressed && styles.pressed]}
          >
            <LinearGradient {...ctlGradient(colors.brand)} style={StyleSheet.absoluteFill} />
            {pendingPlay ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Feather name="play" size={18} color="#FFFFFF" style={{ marginLeft: 2 }} />}
          </Pressable>
          <Pressable
            onPress={handleRemove}
            accessibilityRole="button"
            accessibilityLabel={t("removeTitle", { title: item.Name })}
            style={({ pressed }) => [styles.round, styles.roundGhost, pressed && styles.pressed]}
          >
            <Feather name="trash-2" size={17} color={colors.text.tertiary} />
          </Pressable>
        </View>
      )}
    </View>
  );
});

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      padding: spacing.sm,
      borderRadius: 16,
      backgroundColor: t.colors.surface.s1,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border.subtle,
    },
    rowSelected: {
      borderColor: t.colors.brand.violet,
      backgroundColor: withAlpha(t.colors.brand.violet, 0.12, t.colors.brand.ghost),
    },
    mainSlot: { flex: 1, minWidth: 0 },
    main: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    poster: { width: 56, aspectRatio: 2 / 3, borderRadius: 8, overflow: "hidden", backgroundColor: t.colors.surface.s2 },
    check: {
      position: "absolute",
      top: 4,
      right: 4,
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: "rgba(255,255,255,0.8)",
      backgroundColor: "rgba(0,0,0,0.4)",
      alignItems: "center",
      justifyContent: "center",
    },
    checkOn: { backgroundColor: t.colors.brand.violet, borderColor: t.colors.brand.violet },
    body: { flex: 1, minWidth: 0 },
    title: { fontFamily: FONT_FAMILY.semibold, fontSize: 15, color: t.colors.text.primary },
    meta: { marginTop: 2, fontFamily: FONT_FAMILY.regular, fontSize: 12, color: t.colors.text.quaternary },
    bar: { marginTop: 8, maxWidth: 180 },
    progress: { marginTop: 4, fontFamily: FONT_FAMILY.medium, fontSize: 11, color: t.colors.text.tertiary },
    actions: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    round: { width: 44, height: 44, borderRadius: 22, overflow: "hidden", alignItems: "center", justifyContent: "center" },
    roundGhost: {
      backgroundColor: t.colors.fill.subtle,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border.subtle,
    },
    pressed: { opacity: 0.7 },
  });
