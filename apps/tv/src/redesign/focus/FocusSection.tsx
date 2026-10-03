import { memo, type ReactNode, type Ref } from "react";
import { View, type LayoutChangeEvent, type StyleProp, type ViewProps, type ViewStyle } from "react-native";
import { TV_MOTION } from "@tentacle-tv/theme";
import { REVEAL_NEAREST_MARGIN } from "@tentacle-tv/tv-core";
import { useFocusBinding } from "./focusBinding";
import { NativeFocusSection } from "./nativeFocusSection";

/**
 * Une SECTION d'une page : une rangée (son titre et son accessoire compris),
 * une ligne de grille, un réglage, l'en-tête d'une fiche. La vue en dit deux
 * choses, et rien de plus :
 *
 * - QUE c'en est une (`focusKey`) : l'intégration y applique, par le port du
 *   focus, la règle de voisinage — HAUT / BAS vers la section voisine, sur
 *   l'élément au centre le plus proche (`@tentacle-tv/tv-core`,
 *   `focus/sections.ts`) — et, s'il le faut, son entrée déclarée ;
 * - COMMENT la page la montre quand le focus y entre (`reveal`) : `nearest`
 *   (le moins de défilement possible pour la voir entière, à `margin` des
 *   bords — `REVEAL_NEAREST_MARGIN`, 56, par défaut ; la règle :
 *   `@tentacle-tv/tv-core`, `focus/reveal.ts`), `anchor` (son haut à `top` du haut de l'écran),
 *   `start` (la page tout en haut). Sur Apple TV, la page y va en UN mouvement,
 *   sur le ressort `TV_MOTION.spring.scroll`, à la place du défilement de
 *   tvOS — jamais par-dessus (`ios/TentacleTV/TentacleRevealScroller.m`).
 *
 * Une section peut se dire LISTE de lignes (`list` : un panneau de réglages) :
 * rien ne la coiffe, HAUT y va à la ligne du dessus au plus proche, comme BAS
 * — sinon, en remontant, seul ce qui est à l'aplomb compte (la pastille d'un
 * en-tête n'est pas une étape obligée).
 *
 * Les sections d'une page ne s'imbriquent pas pour le voisinage ; une section
 * qui ne fait que montrer (sans `focusKey`) peut en contenir — la section des
 * épisodes d'une fiche, qui montre ses onglets et sa rangée.
 *
 * Hors d'Apple TV, ou sur un binaire qui ne l'embarque pas : une `View`, aux
 * mêmes style et `pointerEvents` — ni règle, ni défilement propre.
 */

export type FocusSectionReveal = { mode: "nearest"; margin?: number } | { mode: "anchor"; top: number } | { mode: "start" };

export interface FocusSectionProps {
  /** La clé de la section : le port du focus y pose la règle de voisinage. */
  focusKey?: string;
  /** Ce que la page montre quand le focus y entre ; sans : rien de plus. */
  reveal?: FocusSectionReveal;
  /** Une liste de lignes, sans en-tête qui la coiffe (un panneau de réglages). */
  list?: boolean;
  style?: StyleProp<ViewStyle>;
  pointerEvents?: ViewProps["pointerEvents"];
  onLayout?: (event: LayoutChangeEvent) => void;
  children?: ReactNode;
}

export const FocusSection = memo(function FocusSection({ focusKey, reveal, list, style, pointerEvents, onLayout, children }: FocusSectionProps) {
  const binding = useFocusBinding(focusKey, "section");
  if (!NativeFocusSection) {
    return (
      <View style={style} pointerEvents={pointerEvents} onLayout={onLayout}>
        {children}
      </View>
    );
  }
  return (
    <NativeFocusSection
      // Les props natives de l'intégration d'abord (la règle, une entrée).
      {...binding?.native}
      ref={binding?.ref as Ref<never> | undefined}
      style={style}
      pointerEvents={pointerEvents}
      onLayout={onLayout}
      revealMode={reveal?.mode ?? "none"}
      revealMargin={reveal?.mode === "nearest" ? (reveal.margin ?? REVEAL_NEAREST_MARGIN) : undefined}
      revealTop={reveal?.mode === "anchor" ? reveal.top : undefined}
      revealResponse={TV_MOTION.spring.scroll.response}
      revealDamping={TV_MOTION.spring.scroll.dampingFraction}
      lineList={list}
    >
      {children}
    </NativeFocusSection>
  );
});
