import { memo, useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { rulerAimAfter, rulerReading, scaleAimOf, type RulerAim } from "@tentacle-tv/tv-core";
import { useForcedFocusKey } from "../../focus/focusPreview";
import { Icon } from "../../icons/Icon";
import { RatingStars } from "../../rating/RatingStars";
import { colors, fonts, text } from "../../theme/tokens";
import { RatingRuler } from "./RatingRuler";
import type { SheetRatingModel } from "./sheetTypes";
import { useRemoteHints } from "../../remote/remoteHints";

/**
 * La note, dans le grand panneau : les étoiles en GRAND (demi-étoiles
 * comprises, au rose de la marque) et « 7/10 » — la valeur visée sur
 * l'échelle, sinon la note posée —, une ligne qui dit ce que fera OK
 * (« Noter 7 sur 10 », « Votre note actuelle », « Retirer votre note »),
 * puis l'échelle horizontale (`RatingRuler`) et sa légende.
 *
 * Vue pure : la valeur visée vient du focus de l'échelle (natif, ou figé au
 * banc) ; ce qu'elle dit de la note est la règle de tv-core
 * (`cards/ratingRuler`) ; `onRate(note | null)`.
 */

type Translate = (key: string, options?: Record<string, unknown>) => string;

/** La ligne, mise en mots, de chaque sens que tv-core lui donne. */
const LINES: Record<ReturnType<typeof rulerReading>["line"], (t: Translate, aim: RulerAim | null, current: number | null) => string> = {
  pending: () => "",
  remove: (t, _aim, current) => t("reco:removeRatingAria", { score: current }),
  rate: (t, aim) => t("reco:rateAria", { score: aim }),
  current: (t) => t("cards:currentRating"),
  unrated: (t) => t("cards:notRatedYet"),
};

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
  const hints = useRemoteHints();
  const [nativeAim, setNativeAim] = useState<RulerAim | null>(null);
  const forced = useForcedFocusKey();
  const aim = forced !== null ? scaleAimOf(forced) : nativeAim;
  const onAim = useCallback((next: RulerAim, focused: boolean) => {
    setNativeAim((now) => rulerAimAfter(now, next, focused));
  }, []);

  const { current, pending = false } = rating;
  const reading = rulerReading(aim, current, pending);
  const big = reading.value === "pending" ? "…" : reading.value === "none" ? "—" : t("reco:ratingValue", { score: reading.value });
  const line = LINES[reading.line](t, aim, current);

  return (
    <View style={styles.block}>
      <Text style={text.kicker}>{t("reco:yourRating")}</Text>
      <View style={styles.value}>
        <RatingStars score={reading.stars} size={54} gap={8} dim={reading.dim} />
        <Text style={styles.big}>{big}</Text>
      </View>
      <Text style={[styles.line, reading.line === "remove" && styles.danger]} numberOfLines={1}>{line}</Text>
      <RatingRuler current={current} pending={pending} aim={aim} width={width} onAim={onAim} onRate={onRate} />
      <View style={styles.hint}>
        <Icon name="chevronLeft" size={22} color={colors.textTertiary} strokeWidth={2.4} />
        <Icon name="chevronRight" size={22} color={colors.textTertiary} strokeWidth={2.4} />
        <Text style={styles.hintText}>{t(hints.ratingRuler)}</Text>
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
