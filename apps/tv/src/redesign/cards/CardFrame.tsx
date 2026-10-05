import { memo, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import { TV_LIGHT, TV_STAGE } from "@tentacle-tv/theme";
import { boundedLight, type ArtworkPalette } from "../color/artworkPalette";
import { useFocusProgress } from "../focus/useFocusProgress";
import { pressScale, usePressProgress } from "../motion/pressProgress";
import { useRecede, type RowPlace } from "../motion/useRowRecede";
import { colors, white } from "../theme/tokens";
import { dressingStyles, FadingRestShadow, FocusRaised, FocusSheen, useFocusDressing } from "./CardFocusDressing";
import { DropShadow } from "../render/DropShadow";

/**
 * Le cadre d'une carte et son focus façon Apple TV — SANS contour :
 * - la carte grandit (× 1,08) et se soulève ;
 * - son ombre passe de l'élévation de repos à celle du soulèvement, par DEUX
 *   calques en fondu d'opacité (jamais une ombre animée — cf. `cards.css`) ;
 *   avec `glow`, le soulèvement n'est plus une grande ombre noire mais la
 *   LUMIÈRE de l'œuvre que la carte jette autour d'elle — une ombre de sa
 *   couleur, même calque, même coût : dans une grille pleine de cartes, la
 *   carte focalisée ne flotte plus sur un « grand noir » (essai sur l'Apple
 *   TV, 2026-10-01). L'ombre de repos reste alors dessous, comme un contact ;
 * - un reflet spéculaire discret glisse en travers de l'image ;
 * - une voisine a le focus, la carte recule un peu : `place` (sa place dans
 *   une rangée, lue sur le fil d'interface, sans rendu), ou `dimmed`.
 *
 * Au repos, une carte n'a que son ombre de contact et sa transformation : le
 * soulèvement, le reflet et le fondu de l'ombre (`CardFocusDressing`) ne
 * naissent qu'avec le focus — une grille en monte des centaines.
 *
 * Le cadre ne fait que DESSINER : sur tvOS, un focalisable recouvert par un
 * frère qui dessine n'est plus proposé par la recherche géométrique du focus.
 * Une carte rend donc son cadre DANS sa cible focalisable (`FocusTarget
 * form="card"`), jamais en frère par-dessus elle — et la parallaxe au pouce
 * d'Apple TV, jouée sur la vue focalisée, l'emporte avec elle.
 */

/** L'agrandissement et le soulèvement du focus, pour une valeur de 0 à 1 —
 *  et l'appui (OK enfoncé), qui l'enfonce d'un cran. */
function cardLift(progress: number, press: number): [{ translateY: number }, { scale: number }] {
  "worklet";
  return [{ translateY: -4 * progress }, { scale: (1 + (TV_STAGE.focus.cardScale - 1) * progress) * pressScale(press) }];
}

/** Le point fixe de l'agrandissement : le haut dans une rangée, le centre dans une grille. */
function cardOrigin(origin: "top" | "center") {
  return { transformOrigin: origin === "top" ? "50% 0%" : "50% 50%" };
}

export interface CardFrameProps {
  width: number;
  height: number;
  radius: number;
  focused: boolean;
  /** Sa place dans une rangée (`useRowFocus`) : elle recule quand une
   *  voisine a le focus, sans que rien ne se redessine. */
  place?: RowPlace;
  /** Recule — pour une carte hors d'une rangée à valeur partagée. */
  dimmed?: boolean;
  /** L'appui sur la carte (OK enfoncé), tenu par sa cible (`FocusTarget`) —
   *  à défaut, celui de la cible qui CONTIENT le cadre (casting, extras,
   *  épisodes : le cadre y est rendu par la cible elle-même). */
  press?: SharedValue<number>;
  /** Point fixe de l'agrandissement : le haut pour une rangée (la légende
   *  dessous ne bouge pas), le centre dans une grille. */
  origin?: "top" | "center";
  /** La lueur du focus (`cardGlowOf`) ; sans elle, l'ombre noire. */
  glow?: CardGlow;
  /** Le ressort du focus, quand la carte le partage avec ce qu'elle dessine
   *  hors du cadre (la légende qui suit l'image) : un seul ressort, les mêmes
   *  valeurs à chaque image. Sans lui, le cadre a le sien. */
  focusProgress?: SharedValue<number>;
  /** Ce qui ne paraît qu'au focus, DANS l'image (les badges de qualité) :
   *  monté avec l'habit du focus, le temps du retour compris — rien au repos. */
  focusLayer?: ReactNode;
  children: ReactNode;
}

/** La lueur d'une carte focalisée : sa couleur et sa force. */
export interface CardGlow {
  color: string;
  opacity: number;
}

const G = TV_LIGHT.cardGlow;
const NEUTRAL_GLOW: CardGlow = { color: G.neutral, opacity: G.neutralOpacity };

/**
 * La lueur d'une carte : `art`, la lumière de son œuvre (clarté bornée comme
 * celle du fond vivant) ; `neutral`, un blanc doux et bas — une carte qui doit
 * rester grise (titre hors de la bibliothèque) garde un focus lisible sans
 * prendre de couleur. Sans palette, rien : l'ombre noire.
 */
export function cardGlowOf(palette: ArtworkPalette | undefined, tone: "art" | "neutral"): CardGlow | undefined {
  if (tone === "neutral") return NEUTRAL_GLOW;
  if (!palette) return undefined;
  return { color: boundedLight(palette.glows[1], TV_LIGHT.ambient.maxLuminance), opacity: G.opacity };
}

export const CardFrame = memo(function CardFrame(props: CardFrameProps) {
  // Le recul d'une carte de rangée (une réaction sur le fil d'interface)
  // n'existe que pour elle : `place` ne change pas d'un rendu à l'autre.
  return props.place ? <RowCardFrame {...props} place={props.place} /> : <FrameBody {...props} recede={null} />;
});

function RowCardFrame(props: CardFrameProps & { place: RowPlace }) {
  const recede = useRecede(props.place);
  return <FrameBody {...props} recede={recede} />;
}

function FrameBody({
  width,
  height,
  radius,
  focused,
  recede,
  dimmed = false,
  press,
  origin = "top",
  glow,
  focusLayer,
  focusProgress,
  children,
}: CardFrameProps & { recede: SharedValue<number> | null }) {
  // Partagé, le ressort propre reste au repos (jamais lancé).
  const own = useFocusProgress(focusProgress === undefined && focused);
  const p = focusProgress ?? own;
  const dim = useFocusProgress(dimmed && !focused, "recede");
  const enclosing = usePressProgress();
  const pressed = press ?? enclosing;
  const lift = useAnimatedStyle(() => ({
    opacity: 1 - (1 - TV_STAGE.focus.recede) * (recede ? recede.value : dim.value),
    transform: cardLift(p.value, pressed ? pressed.value : 0),
  }));
  // Soulèvement, reflet et fondu de l'ombre : au focus, le temps du retour.
  const [dressed, settle] = useFocusDressing(focused);
  const shape = { width, height, borderRadius: radius };
  return (
    <Animated.View style={[shape, cardOrigin(origin), lift]}>
      {dressed && !glow ? (
        <FadingRestShadow progress={p} radius={radius} />
      ) : (
        <View style={[StyleSheet.absoluteFill, dressingStyles.shadowRest, { borderRadius: radius }]}>
          <DropShadow of={[dressingStyles.shadowRest, { borderRadius: radius }]} />
        </View>
      )}
      {dressed ? <FocusRaised progress={p} glow={glow} radius={radius} focused={focused} onSettled={settle} /> : null}
      <View style={[shape, styles.clip]}>
        {children}
        {dressed ? focusLayer : null}
        {dressed ? <FocusSheen progress={p} width={width} height={height} /> : null}
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: radius }, styles.hairline]} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: "hidden", backgroundColor: colors.surface2 },
  hairline: { borderWidth: 1, borderColor: white(0.12) },
});
