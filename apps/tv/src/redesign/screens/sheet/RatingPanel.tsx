import { memo, useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useForcedFocusKey } from "../../focus/focusPreview";
import { Icon } from "../../icons/Icon";
import { RatingStars } from "../../rating/RatingStars";
import { colors, fonts, text } from "../../theme/tokens";
import { RatingRuler } from "./RatingRuler";
import { scaleAimOf } from "./ratingScaleKeys";
import type { SheetRatingModel } from "./sheetTypes";

/**
 * La note, dans le grand panneau : les étoiles en GRAND (demi-étoiles
 * comprises, au rose de la marque) et « 7/10 » — la valeur visée sur
 * l'échelle, sinon la note posée —, une ligne qui dit ce que fera OK
 * (« Noter 7 sur 10 », « Votre note actuelle », « Retirer votre note »),
 * puis l'échelle horizontale (`RatingRuler`) et sa légende.
 *
 * Vue pure : la valeur visée vient du focus de l'échelle (natif, ou figé au
 * banc) ; `onRate(note | null)`.
 */

export const RatingPanel = memo(function RatingPanel({
  rating,
  width,
  onRate,
}: {
  rating: SheetRatingModel;
  /** La largeur de l'échelle. */
  width: number;
  onRate?: (score: number | null) => void;
}) {
  const { t } = useTranslation();
  const [nativeAim, setNativeAim] = useState<number | "remove" | null>(null);
  const forced = useForcedFocusKey();
  const aim = forced !== null ? scaleAimOf(forced) : nativeAim;
  const onAim = useCallback((next: number | "remove", focused: boolean) => {
    setNativeAim((now) => (focused ? next : now === next ? null : now));
  }, []);

  const { current, pending = false } = rating;
  const removing = aim === "remove";
  const aimed = typeof aim === "number" ? aim : null;
  // Retirer la note : on voit ce qui part, pâli.
  const shown = aimed ?? current ?? 0;
  const big = pending ? "…" : removing || shown === 0 ? "—" : t("reco:ratingValue", { score: shown });
  const line = pending
    ? ""
    : removing
      ? t("reco:removeRatingAria", { score: current })
      : aimed !== null && aimed !== current
        ? t("reco:rateAria", { score: aimed })
        : current !== null
          ? t("cards:currentRating")
          : t("cards:notRatedYet");

  return (
    <View style={styles.block}>
      <Text style={text.kicker}>{t("reco:yourRating")}</Text>
      <View style={styles.value}>
        <RatingStars score={shown} size={54} gap={8} dim={removing || pending} />
        <Text style={styles.big}>{big}</Text>
      </View>
      <Text style={[styles.line, removing && styles.danger]} numberOfLines={1}>{line}</Text>
      <RatingRuler current={current} pending={pending} aim={aim} width={width} onAim={onAim} onRate={onRate} />
      <View style={styles.hint}>
        <Icon name="chevronLeft" size={22} color={colors.textTertiary} strokeWidth={2.4} />
        <Icon name="chevronRight" size={22} color={colors.textTertiary} strokeWidth={2.4} />
        <Text style={styles.hintText}>{t("cards:ratingRulerHint")}</Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  block: { alignItems: "center", gap: 10 },
  value: { flexDirection: "row", alignItems: "center", gap: 28, minHeight: 72 },
  big: { ...fonts.extrabold, fontSize: 60, lineHeight: 70, color: colors.text, fontVariant: ["tabular-nums"], minWidth: 170 },
  line: { ...fonts.semibold, fontSize: 26, lineHeight: 32, color: colors.textSecondary, minHeight: 32, marginBottom: 6 },
  danger: { color: colors.errorFg },
  hint: { flexDirection: "row", alignItems: "center", gap: 2 },
  hintText: { ...fonts.medium, fontSize: 22, color: colors.textTertiary, marginLeft: 8 },
});
