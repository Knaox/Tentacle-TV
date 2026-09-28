import { memo, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { useTranslation } from "react-i18next";
import { recoPosterUrl, useJellyfinClient, useRecoCardMarkers } from "@tentacle-tv/api-client";
import type { RecoRowItem } from "@tentacle-tv/api-client";
import { Badge, PressableCard } from "@/components/ui";
import { typography, RADIUS, SHADOW_RN, FONT_FAMILY, useThemedStyles, type AppTheme } from "@/theme";
import { useCardWidth } from "@/contexts/CardDensityContext";
import { CardRatingBadge } from "@/components/cards/CardRatingBadge";
import { CardStatusMarkers } from "@/components/cards/CardStatusMarkers";

interface Props {
  item: RecoRowItem;
  /** Faux : nulle part où aller (hors bibliothèque, sans catalogue Vigie) —
   *  la carte le dit, l'appui ne fait rien. */
  canOpen: boolean;
  onPress: () => void;
  onLongPress: () => void;
  /** La raison verbalisée (« Parce que vous avez aimé… »), sous le titre — la page Pour vous. */
  reason?: string;
}

/**
 * Une carte de recommandation (2:3) : l'affiche Jellyfin d'un titre en
 * bibliothèque, TMDB sinon. Même gabarit et mêmes MARQUEURS que
 * MobileMediaCard (`useRecoCardMarkers` — les items ne sont pas des
 * MediaItem) : la note globale et la vôtre en bas à gauche, la pastille Ma
 * liste / favori / vu en haut à droite. En haut à gauche, empilés : « À la
 * demande » hors bibliothèque, « Découverte » pour une exploration. L'appui
 * long ouvre la feuille (notation, Ma liste, favoris) : au doigt, pas de survol.
 */
export const RecoCard = memo(function RecoCard({ item, canOpen, onPress, onLongPress, reason }: Props) {
  const { t } = useTranslation("reco");
  const client = useJellyfinClient();
  const st = useThemedStyles(makeStyles);
  const width = useCardWidth();
  const [imgError, setImgError] = useState(false);
  const poster = recoPosterUrl(item, (id) => client.getImageUrl(id, "Primary", { width: 300, quality: 80 }));
  const showFallback = !poster || imgError;
  const onDemand = item.jellyfinItemId === null;
  const markers = useRecoCardMarkers(item);
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
        {/* Posés sur l'affiche : blanc/noir constants (« À la demande »), dégradé
            de marque (« Découverte ») — les couleurs du web. */}
        {(onDemand || item.exploration) && (
          <View style={st.badges} pointerEvents="none">
            {onDemand && <Badge label={t("onDemandBadge")} variant="onMedia" />}
            {item.exploration && <Badge label={t("explorationBadge")} variant="gradient" />}
          </View>
        )}
        {/* Les marqueurs de toutes les cartes, à leurs places communes. */}
        <CardRatingBadge rating={markers.communityRating} userScore={markers.userScore} />
        <CardStatusMarkers statuses={markers.statuses} />
      </View>
      <Text numberOfLines={1} style={st.title}>{item.title}</Text>
      {subtitle && <Text numberOfLines={1} style={st.year}>{subtitle}</Text>}
      {reason && <Text numberOfLines={2} style={st.reason}>{reason}</Text>}
    </PressableCard>
  );
});

const makeStyles = (t: AppTheme) => StyleSheet.create({
  poster: { aspectRatio: 2 / 3, borderRadius: RADIUS.lg, backgroundColor: t.colors.surface.s2, ...SHADOW_RN.elev2 },
  imageClip: { ...StyleSheet.absoluteFillObject, borderRadius: RADIUS.lg, overflow: "hidden", backgroundColor: t.colors.surface.s2 },
  fallback: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", backgroundColor: t.colors.surface.s2 },
  fallbackLetter: { fontSize: 36, fontFamily: FONT_FAMILY.extrabold, color: t.colors.text.disabled, letterSpacing: -0.5 },
  badges: { position: "absolute", top: 7, left: 7, alignItems: "flex-start", gap: 4 },
  title: { ...typography.small, fontSize: 13, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.primary, marginTop: 8, letterSpacing: -0.1 },
  year: { ...typography.badge, fontFamily: FONT_FAMILY.medium, color: t.colors.text.tertiary, marginTop: 2 },
  reason: { fontSize: 11.5, lineHeight: 15, fontFamily: FONT_FAMILY.medium, color: t.colors.text.tertiary, marginTop: 3 },
});
