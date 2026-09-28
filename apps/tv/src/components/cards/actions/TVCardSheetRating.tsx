import { memo, useCallback, useState } from "react";
import { StyleSheet, Text, TVFocusGuideView, View } from "react-native";
import Svg, { ClipPath, Defs, Path, Rect } from "react-native-svg";
import { useTranslation } from "react-i18next";
import { useDeleteRating, useRateItem, type RatingIdentity } from "@tentacle-tv/api-client";
import { BRAND, STAR_PATH, STAR_VIEWBOX } from "@tentacle-tv/shared";
import { Focusable } from "../../focus/Focusable";
import { useTVUserScore } from "./useTVUserScore";
import { Colors, Fonts } from "../../../theme/colors";

const STARS = [1, 2, 3, 4, 5] as const;
/** La case d'une étoile (sa cible de focus) et l'étoile elle-même. */
const STAR_BOX = 56;
const STAR = 34;
/** La grille du tracé partagé de l'étoile (`STAR_VIEWBOX`, 20 × 20). */
const STAR_GRID = 20;
/** La hauteur du bloc, gardée pendant qu'une série se charge. */
export const SHEET_RATING_HEIGHT = 124;

interface TVCardSheetRatingProps {
  /** Ce que notent les étoiles — `null` tant que la série d'un épisode se charge. */
  identity: RatingIdentity | null;
  jellyfinItemId: string | null;
}

/**
 * La note, dans la feuille d'actions : cinq étoiles focalisables, en étoiles
 * ENTIÈRES (une étoile = 2 sur 10). La télécommande n'a pas de moitié
 * d'étoile à viser — une note en demi-étoile posée ailleurs s'affiche telle
 * quelle, et se remplace d'un appui.
 *
 * Le focus tient lieu de survol : l'étoile visée prévisualise la note, et la
 * ligne d'aide dit ce que fera OK — « Noter 8 sur 10 », ou « Retirer votre
 * note » sur la note actuelle, dont les étoiles pâlissent. Comme le web, un
 * appui sur la note actuelle la retire.
 *
 * Le guide `autoFocus` fait entrer le focus par la première étoile (puis par
 * la dernière visitée), quelle que soit l'action d'où l'on descend.
 *
 * Les textes sont ceux de la feuille de la LG (`CardRatingRowTv`) :
 * « Votre note », « Noter 8 sur 10 », « Retirer votre note (8/10) ».
 */
export const TVCardSheetRating = memo(function TVCardSheetRating({ identity, jellyfinItemId }: TVCardSheetRatingProps) {
  const { t } = useTranslation("reco");
  const score = useTVUserScore(identity);
  const rate = useRateItem();
  const remove = useDeleteRating();
  const [focusedStar, setFocusedStar] = useState<number | null>(null);

  const current = score ?? null;
  const pick = useCallback((star: number) => {
    if (!identity) return;
    const next = star * 2;
    if (current === next) remove.mutate(identity);
    else rate.mutate({ ...identity, jellyfinItemId: jellyfinItemId ?? undefined, score: next });
  }, [identity, jellyfinItemId, current, rate, remove]);

  // La série d'un épisode se charge : la place est gardée, rien ne saute.
  if (!identity) return <View style={{ height: SHEET_RATING_HEIGHT }} />;

  const previewing = focusedStar !== null;
  const removing = previewing && current === focusedStar * 2;
  const shown = previewing ? focusedStar * 2 : (current ?? 0);
  const hint = previewing
    ? removing
      ? t("reco:removeRatingAria", { score: current })
      : t("reco:rateAria", { score: focusedStar * 2 })
    : current !== null
      ? t("reco:ratingValue", { score: current })
      : null;

  return (
    <View style={styles.block}>
      <Text style={styles.title}>{t("reco:yourRating")}</Text>
      <View style={styles.line}>
        <TVFocusGuideView autoFocus style={styles.stars}>
          {STARS.map((star) => (
            <Focusable
              key={star}
              variant="button"
              focusRadius={STAR_BOX / 2}
              scaleOverride={1.12}
              phantomPressGuard
              onFocus={() => setFocusedStar(star)}
              onBlur={() => setFocusedStar((s) => (s === star ? null : s))}
              onPress={() => pick(star)}
              accessibilityLabel={current === star * 2
                ? t("reco:removeRatingAria", { score: current })
                : t("reco:rateAria", { score: star * 2 })}
              testID={`card-sheet-star-${star}`}
            >
              <View style={styles.starBox}>
                <StarCell star={star} fraction={starFraction(shown, star)} dim={removing} />
              </View>
            </Focusable>
          ))}
        </TVFocusGuideView>
        <Text numberOfLines={1} style={[styles.hint, removing && styles.hintRemoving]}>
          {hint ?? ""}
        </Text>
      </View>
    </View>
  );
});

/** Le remplissage d'une étoile pour une note sur 10 : 0, ½ ou 1. */
function starFraction(score: number, star: number): number {
  return Math.min(Math.max(score - (star - 1) * 2, 0), 2) / 2;
}

/**
 * Une étoile : le contour, et le plein rogné à sa fraction — rogné DANS le
 * SVG (`ClipPath`). Une vue `overflow: hidden` autour d'un SVG ne le rogne
 * pas sur Android : une demi-étoile y sortait pleine (mesuré à l'émulateur).
 */
function StarCell({ star, fraction, dim }: { star: number; fraction: number; dim: boolean }) {
  const clipId = `sheet-star-${star}`;
  return (
    <View style={[styles.star, dim && styles.starDim]}>
      <Svg width={STAR} height={STAR} viewBox={STAR_VIEWBOX}>
        <Defs>
          <ClipPath id={clipId}>
            <Rect x={0} y={0} width={STAR_GRID * fraction} height={STAR_GRID} />
          </ClipPath>
        </Defs>
        <Path d={STAR_PATH} fill="none" stroke="rgba(255, 255, 255, 0.72)" strokeWidth={1.3} strokeLinejoin="round" />
        {fraction > 0 && <Path d={STAR_PATH} fill={BRAND.accent} clipPath={`url(#${clipId})`} />}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { height: SHEET_RATING_HEIGHT, justifyContent: "center", gap: 10 },
  title: { color: Colors.textSecondary, fontSize: 16, fontWeight: "600", fontFamily: Fonts.semibold, letterSpacing: 0.3 },
  line: { flexDirection: "row", alignItems: "center", gap: 20 },
  stars: { flexDirection: "row", gap: 6 },
  starBox: { width: STAR_BOX, height: STAR_BOX, alignItems: "center", justifyContent: "center" },
  star: { width: STAR, height: STAR },
  starDim: { opacity: 0.4 },
  hint: { flex: 1, color: Colors.textSecondary, fontSize: 17, fontWeight: "500", fontFamily: Fonts.medium },
  hintRemoving: { color: Colors.textPrimary },
});
