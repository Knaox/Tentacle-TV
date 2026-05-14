import { memo, useState, useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import type { LibraryView } from "@tentacle-tv/shared";
import { PressableCard, GradientOverlay } from "@/components/ui";
import { colors, spacing, BORDER, FONT_FAMILY, RADIUS, SHADOW_RN, SURFACE } from "@/theme";

const ROTATE_INTERVAL = 8_000;

function getCollectionIcon(type?: string): string {
  switch (type?.toLowerCase()) {
    case "movies": return "film";
    case "tvshows": return "tv";
    case "music": return "music";
    case "books": return "book";
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

/**
 * Carte librairie 16:9 cinematic — backdrop rotate 8s, gradient bas dramatique
 * vers pure black, badge icône glass top-left, title Inter extrabold avec
 * textShadow pour lisibilité over backdrop.
 */
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
          <Image
            source={{ uri: imageUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={600}
          />
        ) : (
          <View style={styles.fallback}>
            <Feather name={iconName} size={48} color="rgba(255,255,255,0.25)" />
          </View>
        )}
        <GradientOverlay direction="bottom" height="55%" color="#000000" intensity="strong" />

        {/* Badge icône type — glass top-left */}
        <View style={styles.badge}>
          <Feather name={iconName} size={14} color="#fff" />
        </View>

        <View style={styles.labelContainer}>
          <Text style={styles.name} numberOfLines={1} maxFontSizeMultiplier={1.2}>
            {library.Name}
          </Text>
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
    borderRadius: RADIUS.xl,
    overflow: "hidden",
    backgroundColor: SURFACE.s2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER.subtle,
    ...SHADOW_RN.elev3,
  },
  fallback: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: SURFACE.s2,
  },
  badge: {
    position: "absolute",
    top: 12,
    left: 12,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.18)",
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
    fontSize: 26,
    fontFamily: FONT_FAMILY.extrabold,
    color: colors.textPrimary,
    letterSpacing: -0.5,
    textShadowColor: "rgba(0,0,0,0.7)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
  count: {
    fontSize: 13,
    fontFamily: FONT_FAMILY.medium,
    color: "rgba(255,255,255,0.7)",
    marginTop: 4,
    letterSpacing: 0.1,
    textShadowColor: "rgba(0,0,0,0.7)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
