import { memo } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import type { CardMarkers } from "@tentacle-tv/shared";
import { TV_STAGE } from "@tentacle-tv/theme";
import { ArtworkHalo } from "../../background/ArtworkHalo";
import { CardFrame } from "../../cards/CardFrame";
import { CardFocusFooter } from "../../cards/CardFocusFooter";
import { CardMarkerLayer } from "../../cards/CardMarkerLayer";
import { FocusTarget } from "../../focus/FocusTarget";
import { useFocusProgress } from "../../focus/useFocusProgress";
import type { RowPlace } from "../../motion/useRowRecede";
import { colors, fonts, white } from "../../theme/tokens";
import type { EpisodeBadge, EpisodeModel } from "./detailTypes";

/**
 * La grande vignette d'un épisode (460 × 259) : son image, la marque « vu »
 * en haut à droite et la jauge au pied (les marqueurs des cartes), le badge
 * Reprendre / À suivre / Épisode actuel en haut à gauche ; dessous, le
 * surtitre (« ÉPISODE 3 · 24MIN »), le titre et le résumé. Au focus : la
 * carte grandit et se soulève, sa lumière déborde (halo monté à la demande,
 * jamais gardé caché), la légende descend avec elle — et, quand l'appui long
 * ouvre la feuille, dit sous elle « Maintenir OK : plus d'options »
 * (`CardFocusFooter`, comme toute carte qui s'ouvre par l'appui maintenu).
 */

export const EPISODE_CARD = { width: 460, height: 259, radius: TV_STAGE.card.landscape.radius } as const;

const WATCHED: CardMarkers = { communityRating: null, userScore: null, statuses: ["watched"], device: null };
const NONE: CardMarkers = { communityRating: null, userScore: null, statuses: [], device: null };

const BADGE_KEY: Record<EpisodeBadge, string> = {
  resume: "common:resume",
  upNext: "common:nextEpisode",
  current: "common:currentEpisode",
};

/** Ce que la carte descend au focus : l'agrandissement de son image, vu du pied. */
const CAPTION_SHIFT = EPISODE_CARD.height * (TV_STAGE.focus.cardScale - 1);

function Caption({ episode, focused, holdHint }: { episode: EpisodeModel; focused: boolean; holdHint: boolean }) {
  const { t } = useTranslation();
  const p = useFocusProgress(focused);
  const shift = useAnimatedStyle(() => ({ transform: [{ translateY: CAPTION_SHIFT * p.value }] }));
  const kicker = [episode.number !== undefined ? t("media:episodeNumber", { number: episode.number }) : null, episode.meta]
    .filter(Boolean)
    .join(" · ");
  return (
    <Animated.View style={[styles.caption, shift]}>
      {kicker ? <Text style={styles.kicker} numberOfLines={1}>{kicker}</Text> : null}
      <Text style={[styles.title, focused && styles.titleFocused]} numberOfLines={2}>{episode.title}</Text>
      {episode.overview ? <Text style={styles.overview} numberOfLines={3}>{episode.overview}</Text> : null}
      <CardFocusFooter hold={holdHint} width={EPISODE_CARD.width} />
    </Animated.View>
  );
}

export const EpisodeCard = memo(function EpisodeCard({
  episode,
  focusKey,
  place,
  onPress,
  onLongPress,
  onFocusChange,
}: {
  episode: EpisodeModel;
  focusKey: string;
  /** Sa place dans la rangée : elle recule quand une voisine a le focus. */
  place?: RowPlace;
  onPress?: () => void;
  onLongPress?: () => void;
  onFocusChange?: (focused: boolean) => void;
}) {
  const { t } = useTranslation();
  const badge = episode.badge ?? null;
  return (
    <FocusTarget
      focusKey={focusKey}
      onPress={onPress}
      onLongPress={onLongPress}
      onFocusChange={onFocusChange}
      accessibilityLabel={episode.title}
      style={styles.cell}
    >
      {(focused) => (
        <View>
          {focused && episode.palette ? (
            <ArtworkHalo width={EPISODE_CARD.width} height={EPISODE_CARD.height} radius={EPISODE_CARD.radius} palette={episode.palette} spread={14} blur={30} opacity={0.4} />
          ) : null}
          <CardFrame width={EPISODE_CARD.width} height={EPISODE_CARD.height} radius={EPISODE_CARD.radius} focused={focused} place={place}>
            {episode.imageUri ? (
              <Image source={{ uri: episode.imageUri }} style={StyleSheet.absoluteFill} resizeMode="cover" fadeDuration={0} />
            ) : (
              <View style={styles.missing}>
                <Text style={styles.missingNumber}>{episode.number ?? ""}</Text>
              </View>
            )}
            <CardMarkerLayer markers={episode.watched ? WATCHED : NONE} progress={episode.watched ? undefined : episode.progress} />
            {badge ? (
              <View style={[styles.badge, badge === "current" && styles.badgeCurrent]}>
                <Text style={[styles.badgeText, badge === "current" && styles.badgeTextCurrent]}>{t(BADGE_KEY[badge])}</Text>
              </View>
            ) : null}
          </CardFrame>
          <Caption episode={episode} focused={focused} holdHint={focused && onLongPress !== undefined} />
        </View>
      )}
    </FocusTarget>
  );
});

const styles = StyleSheet.create({
  cell: { width: EPISODE_CARD.width },
  missing: { flex: 1, justifyContent: "flex-end", padding: 22, backgroundColor: colors.surface3 },
  missingNumber: { ...fonts.extrabold, fontSize: 96, lineHeight: 100, color: white(0.14) },
  badge: {
    position: "absolute",
    top: 14,
    left: 14,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    justifyContent: "center",
    backgroundColor: colors.accent,
  },
  badgeCurrent: { backgroundColor: colors.ctaBg },
  badgeText: { ...fonts.extrabold, fontSize: 22, color: colors.onAccent },
  badgeTextCurrent: { color: colors.ctaFg },
  caption: { marginTop: 18, gap: 6 },
  kicker: { ...fonts.bold, fontSize: 22, letterSpacing: 1.6, textTransform: "uppercase", color: colors.textTertiary },
  title: { ...fonts.bold, fontSize: 26, lineHeight: 32, color: white(0.86) },
  titleFocused: { color: colors.text },
  overview: { ...fonts.regular, fontSize: 22, lineHeight: 30, color: white(0.58) },
});
