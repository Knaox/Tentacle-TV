import { memo } from "react";
import { View, Image, Dimensions } from "react-native";
import Animated, {
  type SharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";
import LinearGradient from "react-native-linear-gradient";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { Colors } from "../../theme/colors";

const { width: SCREEN_W } = Dimensions.get("window");

interface TVHeroBackdropProps {
  current: MediaItem;
  next: MediaItem | null;
  /** 0→1, drives crossfade. */
  currentOpacity: SharedValue<number>;
  nextOpacity: SharedValue<number>;
  /** 1→1.05, drives Ken Burns zoom on the active backdrop. */
  kenBurns: SharedValue<number>;
  height: number;
}

/**
 * Stack of two backdrops (current + next) with crossfade + Ken Burns zoom.
 * Renders the cinematic gradient stack on top.
 *
 * Why split out: keeps the TVHeroBillboard orchestrator small and lets the
 * backdrop be reused independently if we ever want a partial-bleed hero.
 */
export const TVHeroBackdrop = memo(function TVHeroBackdrop({
  current,
  next,
  currentOpacity,
  nextOpacity,
  kenBurns,
  height,
}: TVHeroBackdropProps) {
  const client = useJellyfinClient();
  const backdropId = current.Type === "Episode" && current.SeriesId ? current.SeriesId : current.Id;
  const backdropUri = client.getImageUrl(backdropId, "Backdrop", { width: 1920, quality: 85 });
  const nextBackdropUri = next
    ? client.getImageUrl(
        next.Type === "Episode" && next.SeriesId ? next.SeriesId : next.Id,
        "Backdrop",
        { width: 1920, quality: 85 },
      )
    : null;

  const currentStyle = useAnimatedStyle(() => ({ opacity: currentOpacity.value }));
  const nextStyle = useAnimatedStyle(() => ({ opacity: nextOpacity.value }));
  const kenBurnsStyle = useAnimatedStyle(() => ({ transform: [{ scale: kenBurns.value }] }));

  return (
    <View style={{ position: "absolute", inset: 0, width: SCREEN_W, height }}>
      <Animated.View style={[{ position: "absolute", width: "100%", height: "100%" }, currentStyle]}>
        <Animated.Image
          source={{ uri: backdropUri }}
          style={[{ width: "100%", height: "100%" }, kenBurnsStyle]}
          resizeMode="cover"
        />
      </Animated.View>

      {nextBackdropUri && (
        <Animated.View style={[{ position: "absolute", width: "100%", height: "100%" }, nextStyle]}>
          {/* Même Ken Burns que la couche courante → au commit (la suivante devient
              courante), le scale est identique : aucun saut/saccade. */}
          <Animated.Image
            source={{ uri: nextBackdropUri }}
            style={[{ width: "100%", height: "100%" }, kenBurnsStyle]}
            resizeMode="cover"
          />
        </Animated.View>
      )}

      {/* Bottom fade-to-bg — fond jusqu'au bord (la bande noire venait d'un
          fondu terminé trop tôt + d'un cache opaque de 28dp) */}
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.55)", Colors.bgDeep]}
        locations={[0, 0.55, 1]}
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: height * 0.6,
        }}
      />

      {/* Left horizontal scrim for text legibility (aligné DetailHero web) */}
      <LinearGradient
        colors={[Colors.bgDeep, "rgba(0,0,0,0.55)", "transparent"]}
        locations={[0, 0.32, 0.72]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          bottom: 0,
          width: SCREEN_W * 0.6,
        }}
      />
    </View>
  );
});
