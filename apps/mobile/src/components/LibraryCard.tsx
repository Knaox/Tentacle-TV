import { memo, useState, useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import type { LibraryView } from "@tentacle-tv/shared";
import { PressableCard, GradientOverlay } from "@/components/ui";
import { colors, spacing } from "@/theme";

const ROTATE_INTERVAL = 8_000;

function getCollectionIcon(type?: string): string {
  switch (type?.toLowerCase()) {
    case "movies": return "film";
    case "tvshows": return "tv";
    case "music": return "music";
    default: return "star";
  }
}

interface RandomItem {
  id: string;
  hasBackdrop: boolean;
  hasPrimary: boolean;
}

interface Props {
  library: LibraryView;
  onPress: () => void;
  width: number;
}

function getImageUrl(
  client: ReturnType<typeof useJellyfinClient>,
  item: RandomItem | undefined,
) {
  if (!item) return null;
  if (item.hasBackdrop)
    return client.getImageUrl(item.id, "Backdrop", { width: 900, quality: 80, index: 0 });
  if (item.hasPrimary)
    return client.getImageUrl(item.id, "Primary", { width: 900, quality: 80 });
  return null;
}

export const LibraryCard = memo(function LibraryCard({ library, onPress, width }: Props) {
  const { t } = useTranslation("common");
  const client = useJellyfinClient();
  const randomItems: RandomItem[] = (library as any)._randomItems ?? [];

  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (randomItems.length <= 1) return;
    const id = setInterval(() => {
      setIndex((prev) => (prev + 1) % randomItems.length);
    }, ROTATE_INTERVAL);
    return () => clearInterval(id);
  }, [randomItems.length]);

  const currentItem = randomItems[index % randomItems.length];
  const imageUrl = getImageUrl(client, currentItem);
  const iconName = getCollectionIcon(library.CollectionType) as any;

  return (
    <PressableCard onPress={onPress} style={{ width }}>
      <View style={[styles.card, { width }]}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={600} />
        ) : (
          <View style={styles.fallback}>
            <Feather name={iconName} size={48} color={colors.textMuted} />
          </View>
        )}
        <GradientOverlay direction="bottom" height="40%" color="rgba(0,0,0,0.8)" />

        {/* Badge icône type */}
        <View style={styles.badge}>
          <Feather name={iconName} size={14} color="rgba(255,255,255,0.85)" />
        </View>

        <View style={styles.labelContainer}>
          <Text style={styles.name} numberOfLines={1} maxFontSizeMultiplier={1.2}>{library.Name}</Text>
          {(library.RecursiveItemCount ?? library.ChildCount) != null &&
            (library.RecursiveItemCount ?? library.ChildCount)! > 0 && (
            <Text style={styles.count}>
              {t("libraryTitles", { count: library.RecursiveItemCount ?? library.ChildCount })}
            </Text>
          )}
        </View>
      </View>
    </PressableCard>
  );
});

const styles = StyleSheet.create({
  card: {
    aspectRatio: 16 / 9,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.12)",
  },
  fallback: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceElevated,
  },
  badge: {
    position: "absolute",
    top: 10,
    left: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  labelContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  name: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.textPrimary,
    textShadowColor: "rgba(0,0,0,0.7)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  count: {
    fontSize: 14,
    color: "#9ca3af",
    marginTop: 2,
    textShadowColor: "rgba(0,0,0,0.7)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
