import { memo, useCallback, useEffect, useState } from "react";
import { StyleSheet } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { FocusGroup } from "../../focus/FocusGroup";
import { RATING_ENTRY, RATING_SCORES, scaleFocusKey } from "./ratingScaleKeys";
import { RULER_CELL, RulerCell } from "./RulerCell";

/**
 * L'ÉCHELLE HORIZONTALE de la note — une règle qu'on fait défiler au pavé :
 * GAUCHE / DROITE, les valeurs du bureau (1 à 10, demi-étoiles comprises)
 * défilent de droite à gauche, la valeur visée toujours au CENTRE, puis
 * « Retirer la note » au bout quand une note est posée. OK note.
 *
 * Vue pure. `aim` : ce que vise le focus (un cran, le retrait) ; sans focus
 * dans l'échelle, elle se centre sur la note posée, sinon sur 5
 * (`RATING_ENTRY`). Seul `transform` s'anime : la règle glisse, les crans
 * pâlissent avec la distance (`RulerCell`).
 *
 * Focus (câblage) : groupe `sheet:scale`, crans `sheet:scale:<1…10>` et
 * `sheet:scale:remove`. Chaque cran touche ses voisins : GAUCHE / DROITE
 * suivent la géométrie seule, et la règle recentre le cran focalisé.
 */

const STEP = RULER_CELL.width + RULER_CELL.gap;
const REMOVE_INDEX = RATING_SCORES.length;
const HEIGHT = RULER_CELL.height + 24;

/** Le milieu du cran `index` dans la règle. */
function middleOf(index: number): number {
  return index === REMOVE_INDEX ? index * STEP + RULER_CELL.removeWidth / 2 : index * STEP + RULER_CELL.width / 2;
}

export const RatingRuler = memo(function RatingRuler({
  current,
  pending = false,
  aim,
  width,
  onAim,
  onRate,
}: {
  current: number | null;
  pending?: boolean;
  aim: number | "remove" | null;
  /** La largeur visible de la règle : le cran visé se pose en son milieu. */
  width: number;
  /** Le focus arrive sur un cran, ou le quitte. */
  onAim: (aim: number | "remove", focused: boolean) => void;
  onRate?: (score: number | null) => void;
}) {
  const { t } = useTranslation();
  const reduced = useReducedMotion();
  // Le retrait reste à sa place une fois paru : une note retirée depuis
  // l'ouverture ne fait pas disparaître le cran qui a le focus.
  const [removable, setRemovable] = useState(current !== null);
  useEffect(() => {
    if (current !== null) setRemovable(true);
  }, [current]);

  const center = aim === "remove" ? REMOVE_INDEX : (typeof aim === "number" ? aim : current ?? RATING_ENTRY) - 1;
  const target = width / 2 - middleOf(center);
  const x = useSharedValue(target);
  useEffect(() => {
    x.value = withTiming(target, { duration: reduced ? 0 : 220, easing: Easing.out(Easing.cubic) });
  }, [target, reduced, x]);
  const slide = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  const aimAt = useCallback((next: number | "remove") => (focused: boolean) => onAim(next, focused), [onAim]);
  const remove = useCallback(() => {
    if (current !== null) onRate?.(null);
  }, [current, onRate]);

  return (
    <FocusGroup focusKey="sheet:scale" style={[styles.window, { width }]}>
      <Animated.View style={[styles.strip, slide]}>
        {RATING_SCORES.map((score, index) => (
          <RulerCell
            key={score}
            score={score}
            label={t("reco:rateAria", { score })}
            distance={Math.abs(index - center)}
            current={score === current}
            disabled={pending}
            focusKey={scaleFocusKey(score)}
            onPress={onRate ? () => onRate(score) : undefined}
            onFocusChange={aimAt(score)}
          />
        ))}
        {removable ? (
          <RulerCell
            score={null}
            label={t("cards:removeRating")}
            distance={Math.abs(REMOVE_INDEX - center)}
            disabled={current === null}
            focusKey={scaleFocusKey(null)}
            onPress={remove}
            onFocusChange={aimAt("remove")}
          />
        ) : null}
      </Animated.View>
    </FocusGroup>
  );
});

const styles = StyleSheet.create({
  // La fenêtre de la règle : ce qui en sort est rogné ; de la hauteur en plus
  // pour le cran focalisé, qui grandit.
  window: { height: HEIGHT, overflow: "hidden", justifyContent: "center" },
  strip: { flexDirection: "row", alignItems: "center", gap: RULER_CELL.gap, alignSelf: "flex-start" },
});
