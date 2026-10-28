/**
 * Octave (mobile) — la grande pochette du lecteur : elle se RÉTRÉCIT un peu en pause (le son s'est arrêté, la
 * pochette « recule »), se balaie de côté pour changer de titre (elle suit le doigt, sort, et la suivante entre
 * du côté opposé), et se tire vers le bas pour refermer le lecteur (`onDrag` / `onDragEnd`, tenus par la feuille).
 *
 * Fluidité (balayage qui « laggait », 28/10) :
 * - le geste est pris par une zone FIXE, jamais par la pochette qui bouge : un second balayage posé pendant
 *   qu'elle revient de côté est pris quand même (avant, il tombait à côté d'elle et ne faisait rien) ;
 * - deux décalages sur le fil d'interface : le DOIGT (`drag`) et le GLISSEMENT programmé (`slide`, sortie puis
 *   entrée) — reprendre la pochette en vol ne la fait jamais sauter ;
 * - le titre change dès le LÂCHER (le son part plus tôt), l'ancienne pochette restant affichée jusqu'à sa sortie
 *   (`shownUrl`) ; les voisines sont déjà préparées (`useNeighbourArtworkPrefetch`).
 */

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PanResponder, StyleSheet, View } from "react-native";
import Animated, { runOnJS, runOnUI, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { haptic } from "@/utils/haptics";
import { PlayerArtwork } from "./PlayerArtwork";
import { useOctavePlayer, usePlayerSelector } from "./OctavePlayerContext";
import { decideSwipe, gestureAxis, rubberBand, swipeExitOffset } from "./playerGestures";
import { useNeighbourArtworkPrefetch } from "./useNeighbourArtworkPrefetch";

interface Props {
  size: number;
  onDrag: (dy: number) => void;
  onDragEnd: (dy: number, vy: number) => void;
}

const SPRING = { damping: 18, stiffness: 220, mass: 0.9 } as const;
const BREATHE = { damping: 16, stiffness: 120, mass: 1 } as const;
const EXIT_MS = 170;
/** La pochette en pause : elle recule, sans disparaître. */
const PAUSED_SCALE = 0.84;

export const NowPlayingArtwork = memo(function NowPlayingArtwork({ size, onDrag, onDragEnd }: Props) {
  const player = useOctavePlayer();
  const reduceMotion = useReducedMotion();
  const url = usePlayerSelector((s) => s.current?.artworkUrl ?? null);
  const playing = usePlayerSelector((s) => s.wantsPlay);
  const hasNext = usePlayerSelector((s) => s.queue.cursor < s.queue.items.length - 1 || s.queue.repeat !== "off");
  useNeighbourArtworkPrefetch();
  // Le doigt, et le glissement programmé (sortie, puis entrée du côté opposé).
  const drag = useSharedValue(0);
  const slide = useSharedValue(0);
  const live = useRef({ size, hasNext, reduceMotion, onDrag, onDragEnd });
  live.current = { size, hasNext, reduceMotion, onDrag, onDragEnd };

  // La pochette AFFICHÉE : celle du titre en cours, sauf pendant la sortie d'un balayage (l'ancienne s'en va).
  const [shownUrl, setShownUrl] = useState(url);
  const latestUrl = useRef(url);
  latestUrl.current = url;
  const leaving = useRef(false);
  useEffect(() => {
    if (!leaving.current) setShownUrl(url);
  }, [url]);
  // Sortie finie : la nouvelle pochette, puis son entrée du côté opposé une fois posée (jamais l'ancienne qui rentre).
  // (Un compteur, pas l'adresse : « Précédent » qui reprend le même titre doit rentrer aussi.)
  const enterFrom = useRef<number | null>(null);
  const [flips, setFlips] = useState(0);
  const flip = useCallback((from: number) => {
    leaving.current = false;
    enterFrom.current = from;
    setShownUrl(latestUrl.current);
    setFlips((n) => n + 1);
  }, []);
  useEffect(() => {
    const from = enterFrom.current;
    if (from === null) return;
    enterFrom.current = null;
    slide.value = from;
    slide.value = withSpring(0, SPRING);
  }, [flips, slide]);

  const change = useCallback((outcome: "next" | "previous") => {
    haptic("select");
    if (outcome === "next") player.next();
    else player.previous();
  }, [player]);

  const responder = useMemo(() => {
    let axis: "horizontal" | "vertical" | null = null;
    return PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => gestureAxis(g.dx, g.dy) !== null,
      onPanResponderGrant: () => {
        axis = null;
      },
      onPanResponderMove: (_e, g) => {
        axis ??= gestureAxis(g.dx, g.dy);
        if (axis === "horizontal") drag.value = rubberBand(g.dx, g.dx > 0 || live.current.hasNext);
        else if (axis === "vertical") live.current.onDrag(g.dy);
      },
      onPanResponderRelease: (_e, g) => {
        const { size: width, hasNext: canNext, reduceMotion: still } = live.current;
        if (axis === "vertical") {
          live.current.onDragEnd(g.dy, g.vy);
          return;
        }
        const outcome = decideSwipe(g.dx, g.vx, width);
        const allowed = outcome === "previous" || (outcome === "next" && canNext);
        if (outcome === "stay" || !allowed || still || leaving.current) {
          drag.value = withSpring(0, SPRING);
          if (outcome !== "stay" && allowed) change(outcome);
          return;
        }
        const out = swipeExitOffset(outcome, width);
        leaving.current = true;
        // Sur le fil d'interface, d'un bloc : le doigt rend la main au glissement là où il a lâché la pochette.
        runOnUI(() => {
          "worklet";
          slide.value = slide.value + drag.value;
          drag.value = 0;
          slide.value = withTiming(out, { duration: EXIT_MS }, () => {
            runOnJS(flip)(-out);
          });
        })();
        change(outcome);
      },
      onPanResponderTerminate: () => {
        drag.value = withSpring(0, SPRING);
        if (axis === "vertical") live.current.onDragEnd(0, 0);
      },
    });
  }, [drag, slide, change, flip]);

  const style = useAnimatedStyle(() => {
    const x = slide.value + drag.value;
    return {
      transform: [
        { translateX: x },
        // En lecture la pochette s'avance, en pause elle recule — un ressort plus lent que le geste : elle respire.
        { scale: reduceMotion ? withTiming(playing ? 1 : PAUSED_SCALE, { duration: 120 }) : withSpring(playing ? 1 : PAUSED_SCALE, BREATHE) },
        { rotateZ: `${(x / Math.max(1, size)) * -4}deg` },
      ],
    };
  }, [playing, size, reduceMotion]);

  return (
    // La zone du geste ne bouge pas (`collapsable` : elle reste une vraie vue, donc touchable même vide).
    <View collapsable={false} style={{ width: size, height: size }} {...responder.panHandlers}>
      <Animated.View style={[styles.wrap, { width: size, height: size }, style]}>
        <PlayerArtwork url={shownUrl} size={size} radius={Math.round(size * 0.05) + 6} crossfade />
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { shadowColor: "#000", shadowOpacity: 0.45, shadowRadius: 28, shadowOffset: { width: 0, height: 18 }, elevation: 14 },
});
