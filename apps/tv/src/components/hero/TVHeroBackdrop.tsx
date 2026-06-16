import { memo, useEffect, useRef, useState } from "react";
import { View, Animated, Easing, Dimensions } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { Colors, HeroConfig } from "../../theme/colors";

const { width: SCREEN_W } = Dimensions.get("window");

interface TVHeroBackdropProps {
  current: MediaItem;
  height: number;
  /** Appelé quand le crossfade vers `current` est terminé (image arrivée). */
  onSettled?: () => void;
}

interface Layer {
  key: number;
  uri: string;
  opacity: Animated.Value;
}

function backdropUriOf(client: ReturnType<typeof useJellyfinClient>, item: MediaItem): string {
  const id = item.Type === "Episode" && item.SeriesId ? item.SeriesId : item.Id;
  return client.getImageUrl(id, "Backdrop", { width: 1920, quality: 85 });
}

/**
 * Backdrop du hero avec crossfade ANTI-FLICKER (pattern double-buffer, cf.
 * kolking/react-native-crossfade-image) :
 *  - aucune couche visible ne change JAMAIS de source ;
 *  - un changement de `current` EMPILE une nouvelle couche (opacity 0) ;
 *  - le fondu démarre sur `onLoad` (image prête → pas de blanc) ;
 *  - à la fin on ÉLAGUE pour ne garder que la couche finale.
 * Ken Burns = scale en boucle (RN Animated) appliqué à toutes les couches.
 */
export const TVHeroBackdrop = memo(function TVHeroBackdrop({ current, height, onSettled }: TVHeroBackdropProps) {
  const client = useJellyfinClient();
  const uri = backdropUriOf(client, current);

  const [layers, setLayers] = useState<Layer[]>(() => [
    { key: 0, uri, opacity: new Animated.Value(1) },
  ]);
  const layersRef = useRef(layers);
  layersRef.current = layers;
  const keyRef = useRef(0);
  const lastUriRef = useRef(uri);
  const onSettledRef = useRef(onSettled);
  onSettledRef.current = onSettled;

  // Changement de bannière → empile une couche invisible (le fondu démarre onLoad).
  useEffect(() => {
    if (uri === lastUriRef.current) return;
    lastUriRef.current = uri;
    keyRef.current += 1;
    setLayers((prev) => [...prev, { key: keyRef.current, uri, opacity: new Animated.Value(0) }]);
  }, [uri]);

  const handleLoad = (key: number) => {
    const ls = layersRef.current;
    const last = ls[ls.length - 1];
    // Seule la couche la plus récente (et pas la base) fait son fondu.
    if (ls.length < 2 || last.key !== key) return;
    Animated.timing(last.opacity, {
      toValue: 1,
      duration: HeroConfig.crossfadeDuration,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) return;
      setLayers([last]); // élagage : la nouvelle devient la seule couche
      onSettledRef.current?.();
    });
  };

  // Ken Burns continu (1 ↔ scale), partagé par toutes les couches.
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: HeroConfig.kenBurnsScale,
          duration: HeroConfig.kenBurnsDuration,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: HeroConfig.kenBurnsDuration,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [scale]);

  return (
    <View style={{ position: "absolute", inset: 0, width: SCREEN_W, height }}>
      {layers.map((l) => (
        <Animated.View
          key={l.key}
          style={{ position: "absolute", width: "100%", height: "100%", opacity: l.opacity }}
        >
          <Animated.Image
            source={{ uri: l.uri }}
            style={{ width: "100%", height: "100%", transform: [{ scale }] }}
            resizeMode="cover"
            onLoad={() => handleLoad(l.key)}
          />
        </Animated.View>
      ))}

      {/* Bottom fade-to-bg */}
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.55)", Colors.bgDeep]}
        locations={[0, 0.55, 1]}
        style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: height * 0.6 }}
      />

      {/* Left horizontal scrim for text legibility */}
      <LinearGradient
        colors={[Colors.bgDeep, "rgba(0,0,0,0.55)", "transparent"]}
        locations={[0, 0.32, 0.72]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: SCREEN_W * 0.6 }}
      />
    </View>
  );
});
