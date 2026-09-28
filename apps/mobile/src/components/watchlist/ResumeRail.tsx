import { memo } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import { cardRatingFor, type MediaItem } from "@tentacle-tv/shared";
import { PressableCard, ProgressBar } from "@/components/ui";
import { CardMarkerLayer } from "@/components/cards/CardMarkerLayer";
import { cardProgress } from "@/components/cards/cardProgress";
import { useCardSheetOpener } from "@/components/cards/sheet/cardSheetContext";
import { landscapeSheetTarget } from "@/components/cards/sheet/cardSheetTarget";
import { spacing, FONT_FAMILY, useThemedStyles, type AppTheme } from "@/theme";
import { useRemainingLabel } from "./useRemainingLabel";

const TILE_WIDTH = 220;

/**
 * « Reprendre » : vignettes 16:9 de 220, rayon 12, en défilement horizontal.
 * Toucher lance la lecture — c'est la seule promesse de la rangée. La
 * vignette porte les marqueurs des cartes à l'échelle du titre montré (sa
 * note, Ma liste, favori), et son appui long ouvre la feuille des cartes en
 * variante 16:9 : la fiche y passe par « Plus d'infos ».
 */
export const ResumeRail = memo(function ResumeRail({
  items, onPlay, pendingId,
}: {
  items: MediaItem[];
  onPlay: (item: MediaItem) => void;
  pendingId: string | null;
}) {
  const { t } = useTranslation("watchlist");
  const client = useJellyfinClient();
  const styles = useThemedStyles(makeStyles);
  const remainingLabel = useRemainingLabel();
  const openSheet = useCardSheetOpener();
  if (items.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.title} accessibilityRole="header">{t("resumeTitle")}</Text>
      <FlatList
        horizontal
        data={items}
        keyExtractor={(item) => item.Id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        snapToInterval={TILE_WIDTH + spacing.md}
        decelerationRate="fast"
        renderItem={({ item }) => {
          const hasBackdrop = (item.BackdropImageTags?.length ?? 0) > 0;
          const uri = client.getImageUrl(item.Id, hasBackdrop ? "Backdrop" : "Primary", { width: 480, quality: 75 });
          const remaining = remainingLabel(item);
          const percent = cardProgress(item);
          const pending = pendingId === item.Id;
          return (
            <PressableCard
              onPress={() => { if (!pending) onPlay(item); }}
              onLongPress={openSheet ? () => openSheet(landscapeSheetTarget(item)) : undefined}
              accessibilityRole="button"
              accessibilityLabel={`${t("resume")} — ${item.Name}${remaining ? `, ${remaining}` : ""}`}
              style={styles.tile}
            >
              <View style={styles.frame}>
                <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
                <LinearGradient
                  colors={["transparent", "rgba(0,0,0,0.2)", "rgba(0,0,0,0.8)"]}
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.playDot}>
                  {pending ? <ActivityIndicator size="small" color="#000" /> : <Feather name="play" size={16} color="#000" style={styles.playIcon} />}
                </View>
                {percent !== null && (
                  <View style={styles.progress}>
                    <ProgressBar progress={percent / 100} />
                  </View>
                )}
                <CardMarkerLayer item={item} communityRating={cardRatingFor(item, "item").rating} scope="item" liftRating={percent !== null} />
              </View>
              <Text style={styles.name} numberOfLines={1}>{item.Name}</Text>
              {remaining && <Text style={styles.remaining} numberOfLines={1}>{remaining}</Text>}
            </PressableCard>
          );
        }}
      />
    </View>
  );
});

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    section: { paddingBottom: spacing.lg },
    title: {
      fontFamily: FONT_FAMILY.bold,
      fontSize: 17,
      letterSpacing: -0.3,
      color: t.colors.text.primary,
      paddingHorizontal: spacing.screenPadding,
      paddingBottom: spacing.sm,
    },
    list: { paddingHorizontal: spacing.screenPadding, gap: spacing.md },
    tile: { width: TILE_WIDTH },
    frame: {
      width: TILE_WIDTH,
      aspectRatio: 16 / 9,
      borderRadius: 12,
      overflow: "hidden",
      backgroundColor: t.colors.surface.s2,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border.subtle,
    },
    playDot: {
      position: "absolute",
      right: 10,
      bottom: 10,
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: "rgba(255,255,255,0.92)",
      alignItems: "center",
      justifyContent: "center",
    },
    playIcon: { marginLeft: 2 },
    progress: { position: "absolute", left: 0, right: 0, bottom: 0 },
    name: { marginTop: 6, fontFamily: FONT_FAMILY.semibold, fontSize: 13, color: t.colors.text.primary },
    remaining: { fontFamily: FONT_FAMILY.regular, fontSize: 11, color: t.colors.text.tertiary },
  });
