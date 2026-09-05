import { memo, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { useTranslation } from "react-i18next";
import { recoPosterUrl, useJellyfinClient } from "@tentacle-tv/api-client";
import type { RecoRowItem } from "@tentacle-tv/api-client";
import { Badge, PressableCard } from "@/components/ui";
import { typography, RADIUS, SHADOW_RN, FONT_FAMILY, useResponsive, useThemedStyles, type AppTheme } from "@/theme";

interface Props {
  item: RecoRowItem;
  /** Faux : nulle part où aller (hors bibliothèque, sans catalogue Vigie) —
   *  la carte le dit, l'appui ne fait rien. */
  canOpen: boolean;
  onPress: () => void;
  onLongPress: () => void;
}

/**
 * Une carte de recommandation (2:3) : l'affiche Jellyfin d'un titre en
 * bibliothèque, TMDB sinon — badge « À la demande » hors bibliothèque,
 * « Découverte » pour une exploration, la note globale, titre et année. Même
 * gabarit que MobileMediaCard ; les items ne sont pas des MediaItem.
 */
export const RecoCard = memo(function RecoCard({ item, canOpen, onPress, onLongPress }: Props) {
  const { t } = useTranslation("reco");
  const client = useJellyfinClient();
  const st = useThemedStyles(makeStyles);
  const { isTablet } = useResponsive();
  const width = isTablet ? 168 : 130;
  const [imgError, setImgError] = useState(false);
  const poster = recoPosterUrl(item, (id) => client.getImageUrl(id, "Primary", { width: 300, quality: 80 }));
  const showFallback = !poster || imgError;
  const onDemand = item.jellyfinItemId === null;
  const subtitle = onDemand && !canOpen
    ? [item.year, t("unavailableHint")].filter(Boolean).join(" — ")
    : item.year != null ? String(item.year) : null;

  return (
    <PressableCard
      onPress={canOpen ? onPress : undefined}
      onLongPress={onLongPress}
      style={{ width, opacity: canOpen ? 1 : 0.7 }}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}${item.year ? `, ${item.year}` : ""}`}
    >
      <View style={st.poster}>
        <View style={st.imageClip} pointerEvents="none">
          {showFallback ? (
            <View style={st.fallback}>
              <Text style={st.fallbackLetter}>{item.title.charAt(0).toUpperCase()}</Text>
            </View>
          ) : (
            <Image
              source={{ uri: poster }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              onError={() => setImgError(true)}
              transition={250}
            />
          )}
        </View>
        {onDemand && <Badge label={t("onDemandBadge")} variant="muted" style={st.badgeLeft} />}
        {item.exploration && <Badge label={t("explorationBadge")} variant="brand" style={st.badgeRight} />}
        {item.voteAverage != null && item.voteAverage > 0 && (
          <View style={st.rating}>
            <Text style={st.ratingText}>★ {item.voteAverage.toFixed(1)}</Text>
          </View>
        )}
      </View>
      <Text numberOfLines={1} style={st.title}>{item.title}</Text>
      {subtitle && <Text numberOfLines={1} style={st.year}>{subtitle}</Text>}
    </PressableCard>
  );
});

const makeStyles = (t: AppTheme) => StyleSheet.create({
  poster: { aspectRatio: 2 / 3, borderRadius: RADIUS.lg, backgroundColor: t.colors.surface.s2, ...SHADOW_RN.elev2 },
  imageClip: { ...StyleSheet.absoluteFillObject, borderRadius: RADIUS.lg, overflow: "hidden", backgroundColor: t.colors.surface.s2 },
  fallback: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", backgroundColor: t.colors.surface.s2 },
  fallbackLetter: { fontSize: 36, fontFamily: FONT_FAMILY.extrabold, color: t.colors.text.disabled, letterSpacing: -0.5 },
  badgeLeft: { position: "absolute", top: 7, left: 7 },
  badgeRight: { position: "absolute", top: 7, right: 7 },
  rating: { position: "absolute", bottom: 7, right: 7, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2, backgroundColor: t.colors.glass.tintStrong },
  ratingText: { fontSize: 11, lineHeight: 13, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.primary },
  title: { ...typography.small, fontSize: 13, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.primary, marginTop: 8, letterSpacing: -0.1 },
  year: { ...typography.badge, fontFamily: FONT_FAMILY.medium, color: t.colors.text.tertiary, marginTop: 2 },
});
