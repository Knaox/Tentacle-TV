import { TVFocusGuideView } from "react-native";
import type { FocusGroupContainerProps } from "../../redesign/focus/focusBinding";

/**
 * Les conteneurs de groupe les plus courants (`FocusBinding.container`) —
 * STABLES : définis une fois, ici, jamais recréés au rendu (le port l'exige :
 * une identité nouvelle remonterait le groupe).
 */

/**
 * Un guide qui MÉMORISE : la première visite va au premier élément du groupe,
 * les suivantes à celui qu'on avait quitté. Il rend aussi atteignable un
 * groupe dont les éléments ne sont pas alignés avec ceux d'à côté : GAUCHE ou
 * DROITE rencontrent le guide, qui transmet.
 */
export function AutoFocusGuide({ style, pointerEvents, children }: FocusGroupContainerProps) {
  return (
    <TVFocusGuideView autoFocus style={style} pointerEvents={pointerEvents}>
      {children}
    </TVFocusGuideView>
  );
}

/**
 * Un guide qui RETIENT : le pavé ne peut pas en sortir (surface bloquante,
 * liste de choix). Il mémorise aussi le dernier élément, comme le précédent.
 */
export function TrapFocusGuide({ style, pointerEvents, children }: FocusGroupContainerProps) {
  return (
    <TVFocusGuideView
      autoFocus
      trapFocusUp
      trapFocusDown
      trapFocusLeft
      trapFocusRight
      style={style}
      pointerEvents={pointerEvents}
    >
      {children}
    </TVFocusGuideView>
  );
}
