import { memo } from "react";
import { StyleSheet } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { ProgressPie } from "../brand/ProgressPie";
import { Icon } from "../icons/Icon";
import { useMotion } from "../motion/useMotion";
import { colors, scrim } from "../theme/tokens";
import type { ArrivalState } from "./arrivalTypes";

/**
 * Le SIGNE d'une demande, au centre de son affiche, façon Apple : sur un
 * disque sombre, le camembert de la marque (`ProgressPie`) — vide en attente,
 * qui se remplit en route, plein à la mise en bibliothèque —, ou le signe
 * d'alerte d'une demande bloquée. À l'ARRIVÉE, le camembert plein s'efface en
 * s'ouvrant, comme l'icône d'une app qui vient de s'installer : opacité et
 * échelle seulement, puis plus rien (ni vue animée, ni dessin).
 *
 * `disc` : faux pour un signe posé sur un fond déjà sombre (une ligne de la
 * feuille des saisons) — le camembert seul.
 */

/** Le temps que met le camembert plein à s'effacer, à l'arrivée. */
export const ARRIVAL_SIGN_OUT_MS = 420;
/** Ce qu'il s'ouvre en s'effaçant. */
const OPEN = 0.22;
/** Le disque déborde du camembert de cette part de son diamètre, de chaque côté. */
const PAD = 0.2;

export interface ArrivalSignProps {
  state: ArrivalState;
  /** L'avancement à l'instant (en route) ; ignoré dans les autres états. */
  percent: number | null;
  /** Le diamètre du camembert. */
  size: number;
  disc?: boolean;
}

export const ArrivalSign = memo(function ArrivalSign({ state, percent, size, disc = true }: ArrivalSignProps) {
  const gone = useMotion(state === "arrived", ARRIVAL_SIGN_OUT_MS);
  const out = useAnimatedStyle(() => ({ opacity: 1 - gone.value, transform: [{ scale: 1 + OPEN * gone.value }] }));
  const outer = disc ? Math.round(size * (1 + 2 * PAD)) : size;
  // En attente : l'anneau seul ; en route : la part de l'avancement ; le fichier là : plein.
  const pie = state === "importing" || state === "arrived" ? 100 : state === "arriving" ? percent : 0;
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.sign, { width: outer, height: outer, borderRadius: outer / 2 }, disc ? styles.disc : null, out]}
    >
      {state === "blocked" ? (
        <Icon name="alert" size={Math.round(size * 0.74)} color={colors.warningFg} strokeWidth={2.4} />
      ) : (
        <ProgressPie percent={pie} size={size} showValue={false} />
      )}
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  sign: { alignItems: "center", justifyContent: "center" },
  disc: { backgroundColor: scrim(0.58) },
});
