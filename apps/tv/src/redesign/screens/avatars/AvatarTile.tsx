import { memo, useCallback } from "react";
import { ActivityIndicator, Image, StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { FocusTarget } from "../../focus/FocusTarget";
import { useFocusProgress } from "../../focus/useFocusProgress";
import { Icon } from "../../icons/Icon";
import { pressScale, usePressProgress } from "../../motion/pressProgress";
import { DropShadow } from "../../render/DropShadow";
import { brandGradient, colors, scrim, white } from "../../theme/tokens";
import type { AvatarGalleryCharacter } from "./avatarGalleryTypes";

/** Le diamètre d'une tuile au repos ; au focus, elle grandit de `FOCUS_SCALE`. */
export const AVATAR_TILE = 150;
/** L'écart entre deux tuiles, en ligne comme en colonne. */
export const AVATAR_TILE_GAP = 34;
const FOCUS_SCALE = 1.14;
const BADGE = 46;

/** Ce que la tuile montre de l'envoi qui la concerne. */
export type AvatarTileState = "idle" | "sending" | "done" | "failed";

/**
 * Un personnage de la grille : son rond imprimé — la couleur de son fond
 * d'abord, l'image par-dessus. Au focus : le rond grandit et s'élève, sans
 * anneau (le focus d'Apple TV). Pendant l'envoi, un voile et l'anneau
 * d'attente ; fait, la coche de la marque ; en échec, l'alerte.
 */
export const AvatarTile = memo(function AvatarTile({ character, focusKey, label, state, onPick, onFocusChange }: {
  character: AvatarGalleryCharacter;
  focusKey: string;
  /** Le nom du personnage, pour l'accessibilité. */
  label: string;
  state: AvatarTileState;
  onPick?: (id: string) => void;
  onFocusChange?: (id: string, focused: boolean) => void;
}) {
  const { id } = character;
  const press = useCallback(() => onPick?.(id), [onPick, id]);
  const focus = useCallback((focused: boolean) => onFocusChange?.(id, focused), [onFocusChange, id]);
  return (
    <FocusTarget focusKey={focusKey} onPress={onPick ? press : undefined} onFocusChange={focus} accessibilityLabel={label}>
      {(focused) => <Body character={character} focused={focused} state={state} />}
    </FocusTarget>
  );
});

function Body({ character, focused, state }: { character: AvatarGalleryCharacter; focused: boolean; state: AvatarTileState }) {
  const p = useFocusProgress(focused);
  const press = usePressProgress();
  const lift = useAnimatedStyle(() => ({
    transform: [
      { translateY: -8 * p.value },
      { scale: (1 + (FOCUS_SCALE - 1) * p.value) * pressScale(press ? press.value : 0) },
    ],
  }));
  const glow = useAnimatedStyle(() => ({ opacity: p.value }));
  return (
    <Animated.View style={[styles.tile, lift]}>
      <Animated.View style={[styles.glow, glow]}>
        <DropShadow of={styles.glow} />
      </Animated.View>
      <View style={[styles.round, { backgroundColor: character.tone }]}>
        <Image source={character.thumb} style={styles.image} fadeDuration={0} />
        {state === "sending" ? (
          <View style={[StyleSheet.absoluteFill, styles.veil]}>
            <ActivityIndicator size="large" color={colors.text} />
          </View>
        ) : null}
      </View>
      {state === "done" || state === "failed" ? (
        <View style={[styles.badge, { backgroundColor: state === "done" ? brandGradient[0] : colors.surface2 }]}>
          <Icon name={state === "done" ? "check" : "alert"} size={26} color={state === "done" ? colors.text : colors.warningFg} strokeWidth={2.6} />
        </View>
      ) : null}
    </Animated.View>
  );
}

const round = { width: AVATAR_TILE, height: AVATAR_TILE, borderRadius: AVATAR_TILE / 2 };

const styles = StyleSheet.create({
  tile: { width: AVATAR_TILE, height: AVATAR_TILE },
  glow: {
    ...round,
    position: "absolute",
    top: 0,
    left: 0,
    backgroundColor: "#000",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 22 },
    shadowOpacity: 0.55,
    shadowRadius: 26,
  },
  round: { ...round, overflow: "hidden", borderWidth: 2, borderColor: white(0.14) },
  image: { width: "100%", height: "100%" },
  veil: { alignItems: "center", justifyContent: "center", backgroundColor: scrim(0.5) },
  badge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: BADGE,
    height: BADGE,
    borderRadius: BADGE / 2,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: white(0.24),
  },
});
