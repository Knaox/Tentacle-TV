import { memo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import Svg, { ClipPath, Defs, Path, Rect } from "react-native-svg";
import { useTranslation } from "react-i18next";
import { STAR_PATH, STAR_VIEWBOX } from "@tentacle-tv/shared";
import { useForcedFocusKey } from "../../focus/focusPreview";
import { FocusTarget } from "../../focus/FocusTarget";
import { useFocusProgress } from "../../focus/useFocusProgress";
import { colors, fonts, white } from "../../theme/tokens";
import type { SheetRatingModel } from "./sheetTypes";

/**
 * La note : cinq étoiles focalisables, ENTIÈRES (une étoile = 2 sur 10) — la
 * télécommande n'a pas de demi-étoile à viser ; une note en demi-étoile posée
 * ailleurs s'affiche telle quelle. L'étoile visée prévisualise la note, la
 * ligne d'aide, face au titre, dit ce que fera OK : « Noter 8 sur 10 », ou « Retirer votre
 * note (8/10) » sur la note actuelle, dont les étoiles pâlissent.
 */

const STARS = [1, 2, 3, 4, 5] as const;
const BOX = 76;
const STAR = 46;
const FOCUS_PREFIX = "sheet:star:";
/** La hauteur du bloc, gardée pendant que la cible se résout. */
export const RATING_HEIGHT = 128;

/** Le remplissage d'une étoile pour une note sur 10 : 0, ½ ou 1. */
function fractionOf(score: number, star: number): number {
  return Math.min(Math.max(score - (star - 1) * 2, 0), 2) / 2;
}

export const SheetRating = memo(function SheetRating({
  rating,
  onRate,
}: {
  rating: SheetRatingModel;
  onRate?: (stars: number) => void;
}) {
  const { t } = useTranslation("reco");
  const [nativeStar, setNativeStar] = useState<number | null>(null);
  const forced = useForcedFocusKey();
  const forcedStar = forced?.startsWith(FOCUS_PREFIX) ? Number(forced.slice(FOCUS_PREFIX.length)) : null;
  const star = forced !== null ? forcedStar : nativeStar;

  if (rating.pending) return <View style={{ height: RATING_HEIGHT }} />;
  const { current } = rating;
  const removing = star !== null && current === star * 2;
  const shown = star !== null ? star * 2 : current ?? 0;
  const hint =
    star !== null
      ? removing
        ? t("removeRatingAria", { score: current })
        : t("rateAria", { score: star * 2 })
      : current !== null
        ? t("ratingValue", { score: current })
        : "";

  return (
    <View style={styles.block}>
      <View style={styles.heading}>
        <Text style={styles.title}>{t("yourRating")}</Text>
        <Text style={[styles.hint, removing && styles.hintRemoving]} numberOfLines={1}>{hint}</Text>
      </View>
      <View style={styles.stars}>
        {STARS.map((n) => (
          <FocusTarget
            key={n}
            focusKey={`${FOCUS_PREFIX}${n}`}
            onPress={() => onRate?.(n)}
            onFocusChange={(focused) => setNativeStar((s) => (focused ? n : s === n ? null : s))}
            accessibilityLabel={current === n * 2 ? t("removeRatingAria", { score: current }) : t("rateAria", { score: n * 2 })}
          >
            {(focused) => <StarCell id={n} fraction={fractionOf(shown, n)} dim={removing} focused={focused} />}
          </FocusTarget>
        ))}
      </View>
    </View>
  );
});

function StarCell({ id, fraction, dim, focused }: { id: number; fraction: number; dim: boolean; focused: boolean }) {
  const p = useFocusProgress(focused);
  const lift = useAnimatedStyle(() => ({ transform: [{ scale: 1 + 0.12 * p.value }] }));
  const disc = useAnimatedStyle(() => ({ opacity: p.value }));
  const clipId = `sheet-star-${id}`;
  return (
    <Animated.View style={[styles.box, lift]}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.disc, disc]} />
      {/* Le plein est rogné DANS le SVG : une vue `overflow: hidden` autour
          d'un SVG ne le rogne pas partout. */}
      <Svg width={STAR} height={STAR} viewBox={STAR_VIEWBOX} style={dim ? styles.dim : undefined}>
        <Defs>
          <ClipPath id={clipId}>
            <Rect x={0} y={0} width={20 * fraction} height={20} />
          </ClipPath>
        </Defs>
        <Path d={STAR_PATH} fill="none" stroke={white(0.55)} strokeWidth={1.2} strokeLinejoin="round" />
        {fraction > 0 ? <Path d={STAR_PATH} fill={colors.accentLight} clipPath={`url(#${clipId})`} /> : null}
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 10, minHeight: RATING_HEIGHT },
  heading: { flexDirection: "row", alignItems: "baseline", gap: 18, paddingRight: 4 },
  title: { ...fonts.semibold, fontSize: 26, color: colors.textSecondary },
  stars: { flexDirection: "row", gap: 4, marginLeft: -12 },
  box: { width: BOX, height: BOX, alignItems: "center", justifyContent: "center" },
  disc: { borderRadius: BOX / 2, backgroundColor: white(0.16) },
  dim: { opacity: 0.4 },
  hint: { ...fonts.semibold, fontSize: 24, color: colors.text, flex: 1, textAlign: "right" },
  hintRemoving: { color: colors.errorFg },
});
