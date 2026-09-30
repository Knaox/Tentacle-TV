import { memo, useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { FocusGroup } from "../../focus/FocusGroup";
import { useForcedFocusKey } from "../../focus/focusPreview";
import { RatingStars } from "../../rating/RatingStars";
import { brandGradient, colors, fonts, text, white } from "../../theme/tokens";
import { STEP_HEIGHT, ScaleStep } from "./ScaleStep";
import type { SheetRatingModel } from "./sheetTypes";

/**
 * La note sur une ÉCHELLE VERTICALE — la barre qu'on parcourt au pavé : HAUT
 * monte, BAS descend, aux valeurs du bureau (dix crans, de ½ à 5 étoiles, 1 à
 * 10), puis « Retirer la note » au bout quand une note est posée. À gauche, la
 * valeur visée EN GRAND — ses étoiles et « 8/10 » ; à côté des crans, une
 * barre qui se remplit, au dégradé de la marque, jusqu'au cran visé.
 *
 * Vue pure. Contrat : `rating` (la note posée ; `pending` tant que sa cible se
 * résout), `onRate(note)` — 1 à 10, ou `null` pour retirer la note.
 * Focus (câblage) : groupe `sheet:scale`, crans `sheet:scale:<1…10>` et
 * `sheet:scale:remove`. OK note ; Menu revient. L'ENTRÉE se pose sur la note
 * posée, sinon sur 6 (trois étoiles) — jamais sur un bout de l'échelle, qu'un
 * OK réflexe validerait ; dans une Modal, tvOS n'honore aucune préférence : le
 * câblage verrouille les autres crans le temps du premier focus
 * (`useChoiceEntry`).
 */

const SCORES = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1] as const;
const PREFIX = "sheet:scale:";
const GAP = 6;
const TRACK_HEIGHT = SCORES.length * STEP_HEIGHT + (SCORES.length - 1) * GAP;

export const scaleFocusKey = (score: number | null) => `${PREFIX}${score ?? "remove"}`;

export const RatingScale = memo(function RatingScale({
  rating,
  onRate,
}: {
  rating: SheetRatingModel;
  onRate?: (score: number | null) => void;
}) {
  const { t } = useTranslation();
  const [nativeTarget, setNativeTarget] = useState<string | null>(null);
  const forced = useForcedFocusKey();
  const target = forced !== null ? (forced.startsWith(PREFIX) ? forced.slice(PREFIX.length) : null) : nativeTarget;
  const removing = target === "remove";
  const aimed = target !== null && !removing ? Number(target) : null;
  const { current, pending } = rating;
  // Retirer la note : on voit ce qui part, pâli.
  const shown = aimed ?? current ?? 0;

  const track = useCallback(
    (id: string) => (focused: boolean) => setNativeTarget((now) => (focused ? id : now === id ? null : now)),
    [],
  );

  const big = pending ? "…" : removing ? "—" : shown > 0 ? t("reco:ratingValue", { score: shown }) : "—";
  const line = pending
    ? ""
    : removing
      ? t("reco:removeRatingAria", { score: current })
      : aimed !== null
        ? aimed === current
          ? t("cards:currentRating")
          : t("reco:rateAria", { score: aimed })
        : current !== null
          ? t("cards:currentRating")
          : t("cards:notRatedYet");

  return (
    <View style={styles.scale}>
      <View style={styles.readout}>
        <Text style={styles.kicker}>{t("reco:yourRating")}</Text>
        <RatingStars score={shown} size={42} gap={4} dim={removing} />
        <Text style={styles.big}>{big}</Text>
        <Text style={[styles.line, removing && styles.danger]} numberOfLines={2}>{line}</Text>
        <Text style={styles.hint} numberOfLines={2}>{t("cards:ratingScaleHint")}</Text>
      </View>
      <FocusGroup focusKey="sheet:scale" style={styles.ladder}>
        <View style={styles.steps}>
          <Fill level={removing ? 0 : shown} />
          <View style={styles.column}>
            {SCORES.map((score) => (
              <ScaleStep
                key={score}
                score={score}
                label={t("reco:ratingValue", { score })}
                current={score === current}
                focusKey={scaleFocusKey(score)}
                onPress={onRate ? () => onRate(score) : undefined}
                onFocusChange={track(String(score))}
              />
            ))}
          </View>
        </View>
        {current !== null ? (
          <ScaleStep
            score={null}
            label={t("cards:removeRating")}
            focusKey={scaleFocusKey(null)}
            onPress={onRate ? () => onRate(null) : undefined}
            onFocusChange={track("remove")}
          />
        ) : null}
      </FocusGroup>
    </View>
  );
});

/** La barre de l'échelle : pleine jusqu'au cran visé, depuis le bas. */
function Fill({ level }: { level: number }) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(level / 10);
  useEffect(() => {
    scale.value = withTiming(level / 10, { duration: reduced ? 0 : 180 });
  }, [level, reduced, scale]);
  const grow = useAnimatedStyle(() => ({ transform: [{ scaleY: scale.value }] }));
  return (
    <View style={styles.track}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.fill, grow]}>
        <LinearGradient colors={brandGradient} start={{ x: 0.5, y: 1 }} end={{ x: 0.5, y: 0 }} style={StyleSheet.absoluteFill} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  scale: { flexDirection: "row", gap: 28 },
  readout: { width: 250, paddingTop: 8, gap: 10 },
  kicker: { ...text.kicker },
  big: { ...fonts.extrabold, fontSize: 72, lineHeight: 80, color: colors.text, fontVariant: ["tabular-nums"] },
  line: { ...fonts.semibold, fontSize: 24, lineHeight: 30, color: colors.text },
  danger: { color: colors.errorFg },
  hint: { ...fonts.medium, fontSize: 22, lineHeight: 28, color: colors.textTertiary, marginTop: 10 },
  ladder: { flex: 1 },
  steps: { flexDirection: "row", gap: 14 },
  column: { flex: 1, gap: GAP },
  track: { width: 6, height: TRACK_HEIGHT, borderRadius: 3, overflow: "hidden", backgroundColor: white(0.12) },
  fill: { transformOrigin: "50% 100%" },
});
