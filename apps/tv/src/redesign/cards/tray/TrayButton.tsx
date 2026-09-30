import { memo } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { FocusTarget } from "../../focus/FocusTarget";
import { useFocusProgress } from "../../focus/useFocusProgress";
import { Icon, type IconName } from "../../icons/Icon";
import { BrandGradient } from "../../brand/BrandGradient";
import { colors, white } from "../../theme/tokens";
import { ToggleGlyph } from "../ToggleGlyph";
import type { CardTrayAction, CardTrayActionKind } from "../cardTypes";
import { trayGlyphSize } from "./trayLayout";

/**
 * Un bouton du plateau — le `CardTrayButton` du bureau, à trois mètres :
 * - au repos, un rond sans fond, glyphe blanc ; une bascule POSÉE prend un
 *   voile blanc et son glyphe se remplit (le cœur au rose de marque) ;
 * - l'action primaire, en tête, a son TON : « Lire » discret (`quiet` — un
 *   verre plus dense, cerclé, sans couleur), « Demander » au dégradé de marque
 *   violet → rose (le `brand` du bureau, la seule couleur du plateau) ;
 * - au focus, le rond devient BLANC, glyphe noir, et grandit : pas d'anneau.
 *
 * Aucune taille propre : `size` vient du plateau, qui resserre ses boutons
 * ensemble sur une affiche étroite. Occupé (`busy`), il n'a plus de geste —
 * une roue à la place du glyphe —, sans devenir `disabled`.
 */

const ICON_OF: Record<Exclude<CardTrayActionKind, "watchlist" | "favorite" | "watched">, IconName> = {
  play: "play",
  request: "plus",
  details: "info",
  dismiss: "eyeOff",
};

const FOCUS_SCALE = 1.14;

export interface TrayButtonProps {
  action: CardTrayAction;
  size: number;
  /** Le titre de la carte : la lecture et la demande le disent (« Reprendre — Dune »). */
  title: string;
  focusKey?: string;
  onPress?: () => void;
  onFocusChange: (focused: boolean) => void;
}

export const TrayButton = memo(function TrayButton({ action, size, title, focusKey, onPress, onFocusChange }: TrayButtonProps) {
  const named = action.kind === "play" || action.kind === "request";
  return (
    <FocusTarget
      focusKey={focusKey}
      onPress={action.busy ? undefined : onPress}
      onFocusChange={onFocusChange}
      accessibilityLabel={named ? `${action.label} — ${title}` : action.label}
    >
      {(focused) => <Round action={action} size={size} focused={focused} />}
    </FocusTarget>
  );
});

function Round({ action, size, focused }: { action: CardTrayAction; size: number; focused: boolean }) {
  const p = useFocusProgress(focused);
  const lift = useAnimatedStyle(() => ({ transform: [{ scale: 1 + (FOCUS_SCALE - 1) * p.value }] }));
  const light = useAnimatedStyle(() => ({ opacity: p.value }));
  const round = { width: size, height: size, borderRadius: size / 2 };
  const glyph = trayGlyphSize(size);
  const heart = action.kind === "favorite" && action.active === true;
  return (
    <Animated.View style={[round, toneOf(action), lift]}>
      {action.kind === "request" ? <BrandGradient diagonal /> : null}
      <View style={styles.center}>
        <Glyph action={action} size={glyph} color={idleInk(action)} />
      </View>
      <Animated.View style={[StyleSheet.absoluteFill, styles.center, styles.lit, { borderRadius: size / 2 }, light]}>
        <Glyph action={action} size={glyph} color={heart ? colors.accentDeep : colors.ctaFg} />
      </Animated.View>
    </Animated.View>
  );
}

function Glyph({ action, size, color }: { action: CardTrayAction; size: number; color: string }) {
  if (action.busy) return <ActivityIndicator size="small" color={color} />;
  if (action.kind === "watchlist" || action.kind === "favorite" || action.kind === "watched") {
    return <ToggleGlyph kind={action.kind} active={action.active === true} color={color} size={size} />;
  }
  return <Icon name={ICON_OF[action.kind]} size={size} color={color} strokeWidth={2.2} />;
}

function toneOf(action: CardTrayAction) {
  if (action.kind === "request") return styles.brand;
  if (action.kind === "play") return styles.quiet;
  return action.active ? styles.active : null;
}

function idleInk(action: CardTrayAction): string {
  if (action.kind === "request") return colors.onAccent;
  if (action.kind === "favorite" && action.active) return colors.accentLight;
  return action.active || action.kind === "play" ? colors.text : white(0.86);
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  lit: { backgroundColor: colors.ctaBg },
  active: { backgroundColor: white(0.15) },
  quiet: { backgroundColor: white(0.2), borderWidth: 1, borderColor: white(0.3) },
  brand: { overflow: "hidden", borderWidth: 1, borderColor: white(0.25) },
});
