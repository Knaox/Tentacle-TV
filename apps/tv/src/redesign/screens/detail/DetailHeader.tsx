import { memo, useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { useTranslation } from "react-i18next";
import { STAR_PATH, STAR_VIEWBOX, formatUserScore } from "@tentacle-tv/shared";
import { Chip } from "../../controls/Chip";
import { MetaLine } from "../../hero/MetaLine";
import { TitleArt } from "../../hero/TitleArt";
import { colors, fonts, text, white } from "../../theme/tokens";
import { DetailActions } from "./DetailActions";
import type { DetailActionsModel, DetailCallbacks, DetailHeaderModel } from "./detailTypes";

/**
 * L'en-tête de la fiche, posé sur l'image : le logo de l'œuvre (sinon son
 * titre en très grand), la ligne de métadonnées, les pastilles de qualité et
 * de langues, les actions, le synopsis — et, sous condition, la phrase du
 * rappel « bandes-annonces », jamais focalisable.
 *
 * Fiche d'épisode : le logo de la SÉRIE en petit, le titre de l'épisode, et
 * la pastille « One Piece — S1 · E2 › » qui mène à la série.
 *
 * Contrat : `useMediaItem` (titre, images, métadonnées), `extractMediaQuality`
 * (pastilles), `useCardRatingTarget` (note perso), `useTrailerHint` (rappel).
 */

type Props = Pick<
  DetailCallbacks,
  "onPlay" | "onTrailer" | "onToggleWatchlist" | "onToggleFavorite" | "onToggleWatched" | "onRate" | "onOpenSeries"
> & {
  header: DetailHeaderModel;
  actions?: DetailActionsModel;
  showTrailerHint?: boolean;
  onFocusChange?: (focused: boolean) => void;
};

/** Entrée de l'en-tête : un fondu et un léger glissé, une fois, à l'ouverture. */
function useEntrance() {
  const reduced = useReducedMotion();
  const progress = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    progress.value = withTiming(1, { duration: reduced ? 0 : 520, easing: Easing.bezier(0.22, 1, 0.36, 1) });
  }, [progress, reduced]);
  return useAnimatedStyle(() => ({ opacity: progress.value, transform: [{ translateX: -28 * (1 - progress.value) }] }));
}

/** La note perso, à la manière des cartes : la pastille ambre à l'étoile sombre. */
function UserScorePill({ score }: { score: number }) {
  const { t } = useTranslation();
  return (
    <View style={styles.userScore} accessibilityLabel={t("media:detailYourScoreValue", { score })}>
      <Svg width={20} height={20} viewBox={STAR_VIEWBOX}>
        <Path d={STAR_PATH} fill={colors.onAccent} />
      </Svg>
      <Text style={styles.userScoreText}>{formatUserScore(score)}</Text>
    </View>
  );
}

export const DetailHeader = memo(function DetailHeader({
  header,
  actions,
  showTrailerHint,
  onFocusChange,
  onOpenSeries,
  ...callbacks
}: Props) {
  const { t } = useTranslation();
  const entrance = useEntrance();
  const episode = header.kind === "episode";
  return (
    <Animated.View style={[styles.block, entrance]}>
      {episode ? (
        <>
          {header.logoUri ? <TitleArt title={header.seriesLink ?? header.title} logoUri={header.logoUri} maxWidth={420} maxHeight={110} /> : null}
          <Text style={styles.episodeTitle} numberOfLines={2}>{header.title}</Text>
          {header.seriesLink ? (
            <View style={styles.seriesLink}>
              <Chip label={header.seriesLink} trailingIcon="chevronRight" size="md" focusKey="detail:series" onPress={onOpenSeries} onFocusChange={onFocusChange} />
            </View>
          ) : null}
        </>
      ) : (
        // Sans logo, le titre en toutes lettres : plus large qu'un logo, serré, deux lignes au plus.
        <TitleArt
          title={header.title}
          logoUri={header.logoUri}
          maxWidth={header.logoUri ? 680 : 1040}
          maxHeight={210}
          fontSize={header.logoUri ? undefined : 84}
        />
      )}
      <View style={styles.metaRow}>
        <MetaLine items={header.meta} size={26} />
        {header.userScore ? <UserScorePill score={header.userScore} /> : null}
      </View>
      {header.badges?.length ? <MetaLine items={header.badges} size={24} /> : null}
      {actions ? (
        <View style={styles.actions}>
          <DetailActions actions={actions} onFocusChange={onFocusChange} {...callbacks} />
        </View>
      ) : null}
      {header.synopsis ? <Text style={styles.synopsis} numberOfLines={showTrailerHint ? 3 : 4}>{header.synopsis}</Text> : null}
      {showTrailerHint ? <Text style={styles.hint} numberOfLines={2}>{t("trailerHelp:hintTv")}</Text> : null}
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  block: { width: 1100, gap: 22 },
  episodeTitle: { ...text.title, fontSize: 64, lineHeight: 70, maxWidth: 1000 },
  seriesLink: { flexDirection: "row", marginTop: -2 },
  metaRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 16, marginTop: 6 },
  userScore: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: colors.accent,
  },
  userScoreText: { ...fonts.extrabold, fontSize: 23, color: colors.onAccent },
  // Les ronds disent leur nom SOUS eux, au focus : la place est gardée.
  actions: { marginTop: 18, marginBottom: 40 },
  synopsis: { ...text.body, maxWidth: 900, color: white(0.82) },
  hint: { ...fonts.regular, fontSize: 23, lineHeight: 32, maxWidth: 900, color: colors.textTertiary },
});
