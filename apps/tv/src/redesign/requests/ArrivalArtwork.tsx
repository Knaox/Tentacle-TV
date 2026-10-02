import { forwardRef, memo, useCallback, useLayoutEffect, useRef, type ReactNode } from "react";
import { Image, StyleSheet, View, type ViewProps } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, type SharedValue } from "react-native-reanimated";
import { colorFraction } from "@tentacle-tv/tv-core";
import { GreyscaleImage } from "../cards/GreyscaleImage";
import { NativeDesaturate } from "../cards/nativeDesaturate";
import { useFocusProgress } from "../focus/useFocusProgress";
import { motionTo } from "../motion/motion";
import { scrim } from "../theme/tokens";
import { ArrivalSign } from "./ArrivalSign";
import type { ArrivalModel } from "./arrivalTypes";

/**
 * L'AFFICHE d'un titre demandé, façon Apple : grise, elle reprend sa couleur
 * au prorata de l'avancement (0 % gris, 100 % pleine couleur — `colorFraction`,
 * tv-core), le camembert au centre (`ArrivalSign`).
 *
 * Le gris est celui des titres absents — la vue native de désaturation,
 * composée par le GPU —, DOSÉ PAR SON OPACITÉ : 1, gris ; 0, la couleur
 * (mesuré au banc : la saturation suit l'opacité en ligne droite). L'opacité
 * se pose sur la vue native ELLE-MÊME : sur un parent, le groupe composerait
 * le gris contre son propre fond vide, plus contre l'image. Rien ne se dessine
 * sur le processeur, rien ne s'anime image par image : un pas de l'avancement
 * (une seconde, une lecture) POSE une opacité — une image composée, rien de
 * plus ; seul un changement d'état (l'arrivée…) ou un rattrapage de dix points
 * se fond. Mesuré au banc : fondre chaque pas, sous le verre de la fenêtre,
 * coûtait ~100 ms/s de GPU quand l'avancement filait (2,5 %/s).
 *
 * `veil` : le voile qui fait reculer une affiche ABSENTE de la bibliothèque —
 * il s'allège avec la couleur, et tombe à l'arrivée. Sans affiche
 * (`placeholder`) : le cadre fourni, le signe par-dessus.
 */

/** Un rattrapage de cette ampleur se fond (une lecture après un long silence) ; un pas d'avancement se pose. */
const JUMP = 0.1;
/** Le fondu d'un saut de gris ou de voile. */
const EASE_MS = 360;
/** La part du voile que la pleine couleur retire (avant l'arrivée, qui le retire tout). */
const VEIL_LIFT = 0.55;

/* La vue native, animable sur le fil d'interface (Reanimated veut une ref). */
const DesaturateHost = NativeDesaturate;
const DesaturateLayer = DesaturateHost
  ? Animated.createAnimatedComponent(forwardRef<View, ViewProps>((props, ref) => <DesaturateHost ref={ref as never} {...props} />))
  : null;

/** Une valeur qui suit un nombre du rendu : posée pour un pas, fondue quand l'état change (`cue`) ou pour un saut. */
function useEased(target: number, cue: string): SharedValue<number> {
  const reduced = useReducedMotion();
  const value = useSharedValue(target);
  const last = useRef({ target, cue });
  useLayoutEffect(() => {
    const before = last.current;
    last.current = { target, cue };
    const fade = cue !== before.cue || Math.abs(target - before.target) >= JUMP;
    value.value = fade ? motionTo(target, EASE_MS, reduced) : target;
  }, [target, cue, reduced, value]);
  return value;
}

export interface ArrivalArtworkProps {
  uri?: string;
  width: number;
  height: number;
  arrival: ArrivalModel;
  /** L'avancement à l'instant (`useArrivalPercent`, appelé par la carte : son texte dit le même). */
  percent: number | null;
  /** Le diamètre du camembert ; 0 : pas de signe (une affiche de l'arrière d'un éventail). */
  signSize: number;
  /** Le voile d'un titre absent, au repos et au focus ; aucun par défaut. */
  veil?: { rest: number; focused: number };
  focused?: boolean;
  /** Sans affiche : ce qui la remplace (le titre écrit). */
  placeholder?: ReactNode;
}

export const ArrivalArtwork = memo(function ArrivalArtwork({
  uri,
  width,
  height,
  arrival,
  percent,
  signSize,
  veil,
  focused = false,
  placeholder,
}: ArrivalArtworkProps) {
  const arrived = arrival.state === "arrived";
  const fraction = colorFraction(arrival.state, percent);
  const grey = useEased(1 - fraction, arrival.state);
  const dim = useEased(arrived ? 0 : 1 - VEIL_LIFT * fraction, arrival.state);
  const p = useFocusProgress(focused);
  const rest = veil?.rest ?? 0;
  const lit = veil?.focused ?? 0;
  const greyStyle = useAnimatedStyle(() => ({ opacity: grey.value }));
  const veilStyle = useAnimatedStyle(() => ({ opacity: (rest + (lit - rest) * p.value) * dim.value }));
  const shown = useSharedValue(0);
  const appear = useAnimatedStyle(() => ({ opacity: shown.value }));
  const onLoad = useCallback(() => {
    shown.value = motionTo(1, "imageIn");
  }, [shown]);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {uri ? (
        DesaturateLayer ? (
          // L'image ET son gris dans le même groupe : le fondu d'arrivée de l'image ne casse pas la composition.
          <Animated.View style={[StyleSheet.absoluteFill, appear]}>
            <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" fadeDuration={0} onLoad={onLoad} />
            <DesaturateLayer pointerEvents="none" style={[StyleSheet.absoluteFill, greyStyle]} />
          </Animated.View>
        ) : (
          <>
            <Animated.View style={[StyleSheet.absoluteFill, appear]}>
              <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" fadeDuration={0} onLoad={onLoad} />
            </Animated.View>
            {/* Repli (binaire sans la vue native) : l'affiche grise par-dessus la couleur, en fondu. */}
            <Animated.View style={[StyleSheet.absoluteFill, greyStyle]}>
              <GreyscaleImage uri={uri} width={width} height={height} />
            </Animated.View>
          </>
        )
      ) : (
        placeholder ?? null
      )}
      {veil ? <Animated.View style={[StyleSheet.absoluteFill, styles.veil, veilStyle]} /> : null}
      {signSize > 0 ? (
        <View style={styles.center}>
          <ArrivalSign state={arrival.state} percent={percent} size={signSize} />
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  veil: { backgroundColor: scrim(1) },
  center: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
});
