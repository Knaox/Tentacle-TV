import Animated, {
  useAnimatedStyle,
  interpolate,
  interpolateColor,
  type SharedValue,
} from "react-native-reanimated";
import {
  FocusBorder,
  FocusButtonStyle,
  FocusGlow,
  FocusPlayerButtonStyle,
  FocusRowStyle,
} from "../../theme/focus";

/**
 * Les calques que `Focusable` peint autour de son enfant.
 *
 * Extraits pour tenir la limite de 300 lignes, mais la coupure n'est pas
 * arbitraire : ces quatre-là sont la seule partie de `Focusable` qui décrive
 * une APPARENCE. Le reste — l'échelle, le rang de peinture, la garde anti-clic
 * fantôme — décrit un comportement.
 *
 * Chacun est un composant à part plutôt qu'un `if` dans un composant commun :
 * les hooks ne se posent pas sous condition, et réunis ils feraient calculer à
 * chaque bouton les quatre styles animés dont il n'en utilise qu'un.
 *
 * Tous s'étendent sur la boîte de l'élément et ne reçoivent aucun geste : le
 * `Pressable` est au-dessus d'eux dans l'arbre, pas en dessous.
 */

const REMPLIR = { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 } as const;

/** Le halo de marque, derrière l'anneau — ce qui décolle l'élément du fond.
 *  Il déborde de six points, donc son rayon aussi. */
export function CalqueHalo({
  progress,
  opacite,
  rayon,
}: {
  progress: SharedValue<number>;
  opacite: number;
  rayon: number;
}) {
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, opacite]),
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[{
        position: "absolute",
        top: -6, left: -6, right: -6, bottom: -6,
        borderRadius: rayon + 6,
        backgroundColor: FocusGlow.color,
      }, style]}
    />
  );
}

/** Variante « bouton » : l'anneau blanc, et pour l'OSD un fond translucide.
 *  Les ronds du lecteur n'ont pas de bordure — l'anneau s'en charge. */
export function CalqueBouton({
  progress,
  rayon,
  osd,
}: {
  progress: SharedValue<number>;
  rayon: number;
  osd: boolean;
}) {
  const style = useAnimatedStyle(() => ({ opacity: progress.value }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[{
        ...REMPLIR,
        borderRadius: rayon,
        backgroundColor: osd ? FocusPlayerButtonStyle.bgColor : FocusButtonStyle.bgColor,
        borderWidth: osd ? 0 : FocusButtonStyle.borderWidth,
        borderColor: FocusButtonStyle.borderColor,
      }, style]}
    />
  );
}

/** Variante « ligne » : le fond se remplit, sans barre — cf. `FocusRowStyle`. */
export function CalqueLigne({
  progress,
  rayon,
}: {
  progress: SharedValue<number>;
  rayon: number;
}) {
  const style = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      ["transparent", FocusRowStyle.bgColor],
    ),
  }));

  return <Animated.View pointerEvents="none" style={[{ ...REMPLIR, borderRadius: rayon }, style]} />;
}

/** Variante « carte » : l'anneau net, dessiné PAR-DESSUS l'affiche. */
export function CalqueCarte({
  progress,
  rayon,
}: {
  progress: SharedValue<number>;
  rayon: number;
}) {
  const style = useAnimatedStyle(() => ({ opacity: progress.value * FocusBorder.opacity }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[{
        ...REMPLIR,
        borderRadius: rayon,
        borderWidth: FocusBorder.width,
        borderColor: FocusBorder.color,
      }, style]}
    />
  );
}
