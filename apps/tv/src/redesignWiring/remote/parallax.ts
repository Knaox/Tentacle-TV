import { AccessibilityInfo, Platform, type TVParallaxProperties } from "react-native";
import { TV_MOTION } from "@tentacle-tv/theme";
import type { FocusForm } from "../../redesign/focus/focusBinding";

/**
 * La parallaxe au pouce — ce que le pavé tactile de la Siri Remote fait à
 * l'élément focalisé, comme dans les apps d'Apple : le doigt posé ou qui
 * glisse l'incline et le décale un peu. C'est tvOS qui la joue : React Native
 * tvOS pose des effets de mouvement natifs sur la vue FOCALISÉE, que le
 * moteur de focus pilote d'après le doigt. Rien ne passe par le JS pendant le
 * geste, rien ne se redessine.
 *
 * React Native en pose une par défaut sur tout focalisable (2 points,
 * 0,05 rad). Ici, selon la FORME que la vue déclare (`FocusTarget form`) :
 * - `card` — le cadre d'une carte s'incline et glisse davantage
 *   (`TV_MOTION.parallax.card`). Sa cible ne porte que le cadre : la légende,
 *   dessinée sous la cible, ne bouge pas ;
 * - `row` — une ligne large glisse sans s'incliner : l'inclinaison par
 *   défaut en déformait les bords ;
 * - sans forme — le défaut de React Native (boutons, pastilles, touches).
 * Jamais d'agrandissement natif (`magnification`, `pressMagnification` à
 * 1) : le focus et l'appui s'animent déjà par Reanimated.
 *
 * Mouvement réduit (réglage d'accessibilité) : aucune parallaxe, sur aucun
 * élément. Lu quand une cible se lie : il vaut pour l'écran suivant.
 */

const SUPPORTED = Platform.OS === "ios";

let reduced = false;
let watching = false;

/** Suit le réglage « Réduire les animations », à la première demande. */
function watchReducedMotion(): void {
  if (watching) return;
  watching = true;
  AccessibilityInfo.isReduceMotionEnabled()
    .then((value) => {
      reduced = value;
    })
    .catch(() => {});
  AccessibilityInfo.addEventListener("reduceMotionChanged", (value) => {
    reduced = value;
  });
}

function presetOf(form: FocusForm): TVParallaxProperties {
  const { shift, tilt } = TV_MOTION.parallax[form];
  return { enabled: true, shiftDistanceX: shift, shiftDistanceY: shift, tiltAngle: tilt, magnification: 1, pressMagnification: 1 };
}

const PRESETS: Readonly<Record<FocusForm, TVParallaxProperties>> = { card: presetOf("card"), row: presetOf("row") };
const OFF: TVParallaxProperties = { enabled: false };

/** Les props natives de parallaxe d'un élément de cette forme ; `undefined` :
 *  rien à poser (le défaut de React Native, ou hors Apple TV). */
export function parallaxOf(form: FocusForm | undefined): { tvParallaxProperties: TVParallaxProperties } | undefined {
  if (!SUPPORTED) return undefined;
  watchReducedMotion();
  if (reduced) return { tvParallaxProperties: OFF };
  return form ? { tvParallaxProperties: PRESETS[form] } : undefined;
}
