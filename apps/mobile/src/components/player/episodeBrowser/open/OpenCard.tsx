import { memo, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import type { EpisodeEntry } from "../../../../player/episodes/episodeBrowserModel";
import { openCardPlace } from "../../../../player/episodes/episodeBrowserLayout";
import { EpisodeArtwork } from "../EpisodeArtwork";

interface Props {
  entry: EpisodeEntry;
  index: number;
  /** Le défilement de la rangée, en pas (une carte au repos et son écart). */
  progress: SharedValue<number>;
  step: number;
  restWidth: number;
  openWidth: number;
  openHeight: number;
  radius: number;
  artwork: ReactNode;
  spoken: string;
  onAccessibilityTap: () => void;
}

/**
 * Une carte de la rangée qui s'ouvre. Mise en page à la taille OUVERTE (l'image
 * reste nette), elle ne bouge que par transformation, sur le fil d'interface :
 * réduite au repos, ancrée en bas à gauche, poussée à droite quand la carte
 * d'avant s'ouvre (`openCardPlace`), effacée une fois passée. Le toucher se décide au niveau de la
 * rangée (`openCardAt`) : la carte n'en reçoit aucun, elle reste lisible par
 * VoiceOver.
 */
export const OpenCard = memo(function OpenCard({ entry, index, progress, step, restWidth, openWidth, openHeight, radius, artwork, spoken, onAccessibilityTap }: Props) {
  const placed = useAnimatedStyle(() => {
    const place = openCardPlace(index, progress.value, step, restWidth, openWidth);
    const shrink = 1 - place.scale;
    // Passée (à gauche de la carte ouverte), elle s'efface : la rangée commence toujours par la carte ouverte.
    const passed = Math.min(1, Math.max(0, progress.value - index));
    return {
      opacity: 1 - Math.min(1, passed * 1.6),
      transform: [
        { translateX: place.left - index * step - (openWidth * shrink) / 2 },
        { translateY: (openHeight * shrink) / 2 },
        { scale: place.scale },
      ],
    };
  });
  return (
    <View
      style={{ width: restWidth, height: openHeight }}
      accessible
      accessibilityRole="button"
      accessibilityState={{ selected: entry.current }}
      accessibilityLabel={spoken}
      onAccessibilityTap={onAccessibilityTap}
    >
      <Animated.View pointerEvents="none" style={[st.card, { width: openWidth, height: openHeight }, placed]}>
        <EpisodeArtwork entry={entry} width={openWidth} radius={radius} artwork={artwork} badge />
      </Animated.View>
    </View>
  );
});

const st = StyleSheet.create({
  card: { position: "absolute", left: 0, top: 0 },
});
