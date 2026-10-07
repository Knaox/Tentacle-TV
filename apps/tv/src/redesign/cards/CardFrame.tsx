import { memo, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import { TV_LIGHT, TV_STAGE } from "@tentacle-tv/theme";
import { boundedLight, type ArtworkPalette } from "../color/artworkPalette";
import { useFocusProgress } from "../focus/useFocusProgress";
import { pressScale, usePressProgress } from "../motion/pressProgress";
import { RECEDE_FRAME_ID, useRecede, type RowPlace } from "../motion/useRowRecede";
import { colors, white } from "../theme/tokens";
import { dressingStyles, FadingRestShadow, FocusOutline, FocusRaised, FocusSheen, useFocusDressing } from "./CardFocusDressing";
import { CARD_FOCUS_OUTLINE } from "./cardFocus";
import { DropShadow } from "../render/DropShadow";
import { effectOff } from "../render/measuredEffects";

// Interrupteur de MESURE (lot Lite) : l'app de mesure seulement, jamais l'app livrée.
const FOCUS_SCALE_OFF = effectOff("focusScale");

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
 * Profil Lite (`cardFocus: "outline"`) : rien de cela — un liseré d'accent
 * au focus (`FocusOutline`), à la taille de la carte, en fondu bref ; ni
 * agrandissement, ni soulèvement, ni ombre, ni reflet. Le recul des voisines
 * et l'appui restent ceux du mouvement (brefs en Lite).
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
  const lifted = FOCUS_SCALE_OFF || CARD_FOCUS_OUTLINE ? 0 : progress;
  return [{ translateY: -4 * lifted }, { scale: (1 + (TV_STAGE.focus.cardScale - 1) * lifted) * pressScale(press) }];
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
  if (!props.place) return <FrameBody {...props} recede={null} />;
  // Sa piste joue le recul (Android TV) : le cadre se désigne, rien ne s'anime ici.
  if (props.place.native) return <FrameBody {...props} recede={null} nativeID={RECEDE_FRAME_ID} />;
  return <RowCardFrame {...props} place={props.place} />;
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
  nativeID,
  dimmed = false,
  press,
  origin = "top",
  glow,
  focusLayer,
  focusProgress,
  children,
}: CardFrameProps & { recede: SharedValue<number> | null; nativeID?: string }) {
  // Partagé, le ressort propre reste au repos (jamais lancé).
  const own = useFocusProgress(focusProgress === undefined && focused);
  const p = focusProgress ?? own;
  const dim = useFocusProgress(dimmed && !focused, "recede");
  const enclosing = usePressProgress();
  const pressed = press ?? enclosing;
  // Deux styles pour deux mouvements indépendants : Reanimated renvoie un
  // style ENTIER dès qu'une de ses valeurs change. D'un seul tenant, chaque
  // carte d'une rangée qui recule (son opacité seule) renvoyait aussi, à
  // chaque image, sa transformation — décomposée en matrice par le
  // gestionnaire de vues. Mêmes valeurs, dans la même image.
  const lift = useAnimatedStyle(() => ({ transform: cardLift(p.value, pressed ? pressed.value : 0) }));
  const fade = useAnimatedStyle(() => ({
    opacity: 1 - (1 - TV_STAGE.focus.recede) * (recede ? recede.value : dim.value),
  }));
  // Soulèvement, reflet et fondu de l'ombre : au focus, le temps du retour.
  const [dressedOn, settle] = useFocusDressing(focused);
  const dressed = dressedOn && !FOCUS_SCALE_OFF;
  const shape = { width, height, borderRadius: radius };
  if (CARD_FOCUS_OUTLINE) {
    return (
      <Animated.View nativeID={nativeID} style={[shape, cardOrigin(origin), lift, fade]}>
        <View style={[shape, styles.clip]}>
          {children}
          {focused ? focusLayer : null}
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: radius }, styles.hairline]} />
        </View>
        <FocusOutline progress={p} radius={radius} />
      </Animated.View>
    );
  }
  return (
    <Animated.View nativeID={nativeID} style={[shape, cardOrigin(origin), lift, fade]}>
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
