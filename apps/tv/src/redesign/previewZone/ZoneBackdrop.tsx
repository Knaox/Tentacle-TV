import { memo, useCallback, useLayoutEffect, useRef, useState } from "react";
import { Image, StyleSheet } from "react-native";
import Animated, { runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, type SharedValue } from "react-native-reanimated";
import { PREVIEW_ZONE_FADE, previewZoneBackdropLayer } from "@tentacle-tv/tv-core";
import { motionTo } from "../motion/motion";

/**
 * Le FOND de la zone d'aperçu, en fondu croisé sur deux calques (tv-core
 * `previewZoneBackdropLayer`) : l'image neuve se pose sur le calque de
 * derrière, et n'entre — par-dessus l'ancienne, restée pleine dessous — qu'une
 * fois CHARGÉE : jamais un noir entre deux fonds. Préchargée par la page
 * (`useCardPreviewWarm`), elle est là au focus même.
 *
 * Revenir à un fond resté chargé sur le calque de derrière (A → B → A) ne
 * recharge rien : l'image y est déjà, elle entre aussitôt — sans cela, son
 * `onLoad` ne revenait jamais et le fond restait figé (lot 1 du testeur).
 *
 * Un changement qui arrive pendant un fondu attend sa fin, et seul le DERNIER
 * passe : une rafale de flèches ne fait pas défiler dix fonds empilés, la zone
 * rattrape le focus dès qu'il se pose. Seule l'opacité s'anime.
 */

type Layer = 0 | 1;

interface State {
  uris: [string | null, string | null];
  front: Layer;
  /** Le calque qui attend son image, puis entre. */
  incoming: Layer | null;
}

export const ZoneBackdrop = memo(function ZoneBackdrop({ uri }: { uri: string | null }) {
  const reduced = useReducedMotion();
  const [state, setState] = useState<State>({ uris: [null, null], front: 0, incoming: null });
  const live = useRef(state);
  live.current = state;
  const opacity0 = useSharedValue(0);
  const opacity1 = useSharedValue(0);
  const opacities: [SharedValue<number>, SharedValue<number>] = [opacity0, opacity1];
  const latest = useRef(uri);
  latest.current = uri;
  const busy = useRef(false);
  // L'image chargée de chaque calque.
  const loaded = useRef<[string | null, string | null]>([null, null]);

  const begin = useCallback(() => {
    if (busy.current) return;
    const current = live.current;
    const next = latest.current;
    if (next === null) return;
    const target = previewZoneBackdropLayer(current, next);
    if (target === null) return;
    busy.current = true;
    (target === 0 ? opacity0 : opacity1).value = 0;
    setState({ ...current, uris: target === 0 ? [next, current.uris[1]] : [current.uris[0], next], incoming: target });
    // Déjà chargée sur ce calque : aucun `onLoad` ne viendra, elle entre tout de suite.
    if (loaded.current[target] === next) requestAnimationFrame(() => fadeIn.current(target));
  }, [opacity0, opacity1]);

  const settle = useCallback(
    (layer: Layer) => {
      busy.current = false;
      setState((s) => ({ ...s, front: layer, incoming: null }));
      // Le dernier fond demandé pendant le fondu passe à son tour.
      requestAnimationFrame(begin);
    },
    [begin],
  );

  useLayoutEffect(begin, [uri, begin]);

  const onLoaded = useCallback(
    (layer: Layer, uri: string) => {
      loaded.current[layer] = uri;
      if (live.current.incoming !== layer || live.current.uris[layer] !== uri) return;
      (layer === 0 ? opacity0 : opacity1).value = motionTo(1, PREVIEW_ZONE_FADE.backdropMs, reduced, (finished) => {
        "worklet";
        if (finished) runOnJS(settle)(layer);
      });
    },
    [opacity0, opacity1, reduced, settle],
  );
  const fadeIn = useRef<(layer: Layer) => void>(() => undefined);
  fadeIn.current = (layer) => {
    const uri = live.current.uris[layer];
    if (uri) onLoaded(layer, uri);
  };
  // Une image qui ne vient pas : la précédente reste, la suivante pourra passer.
  const onFailed = useCallback(
    (layer: Layer) => {
      if (live.current.incoming !== layer) return;
      busy.current = false;
      setState((s) => ({ ...s, incoming: null }));
      // Le dernier fond demandé entre-temps passe à son tour.
      requestAnimationFrame(begin);
    },
    [begin],
  );

  // Le calque qui entre (ou qui se voit) au-dessus.
  const top: Layer = state.incoming ?? state.front;
  const order: Layer[] = top === 0 ? [1, 0] : [0, 1];
  return (
    <>
      {order.map((layer) => (
        <BackdropLayer key={layer} layer={layer} uri={state.uris[layer]} opacity={opacities[layer]} onLoaded={onLoaded} onFailed={onFailed} />
      ))}
    </>
  );
});

const BackdropLayer = memo(function BackdropLayer({ layer, uri, opacity, onLoaded, onFailed }: {
  layer: Layer;
  uri: string | null;
  opacity: SharedValue<number>;
  onLoaded: (layer: Layer, uri: string) => void;
  onFailed: (layer: Layer) => void;
}) {
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const onLoad = useCallback(() => {
    if (uri) onLoaded(layer, uri);
  }, [onLoaded, layer, uri]);
  const onError = useCallback(() => onFailed(layer), [onFailed, layer]);
  if (!uri) return null;
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      <Image key={uri} source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" fadeDuration={0} onLoad={onLoad} onError={onError} />
    </Animated.View>
  );
});
