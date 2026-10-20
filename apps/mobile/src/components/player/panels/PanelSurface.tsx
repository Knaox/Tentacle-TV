import { useEffect, useRef, type ReactNode } from "react";
import { Animated, BackHandler, Platform, Pressable, StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
import { useTranslation } from "react-i18next";
import { useThemeMode } from "../../../theme/appThemeContext";
import { getLiquidGlassModule } from "../../../theme/liquidGlass";
import type { PanelFrame } from "../../../player/panels/panelLayout";
import { PANEL } from "./panelTokens";

interface Props {
  frame: PanelFrame;
  onClose: () => void;
  /** La plaque prend toute sa hauteur permise (une liste qui défile dedans). */
  fill?: boolean;
  children: ReactNode;
}

/**
 * Le support d'un panneau du lecteur : une plaque flottante, posée là où
 * `panelLayout` le dit, sur l'image qui reste VISIBLE autour — aucun voile.
 * Toucher l'image ferme le panneau (une couche transparente l'écoute).
 *
 * Matière : le Liquid Glass d'iOS 26 quand il est allumé, sinon le matériau
 * des menus d'iOS (`systemChromeMaterialDark`) ; un fond plein sur Android.
 * Le panneau n'existe que s'il est ouvert (démonté à la fermeture) : aucun
 * verre masqué par l'opacité. L'entrée glisse la plaque et fond le CONTENU
 * seul : un verre natif (UIVisualEffectView) sous un parent à alpha < 1 ne
 * rend pas son effet — il restait transparent, textes illisibles sur la
 * vidéo (banc du 21/10). Fil natif seulement.
 */
export function PanelSurface({ frame, onClose, fill = false, children }: Props) {
  const { t } = useTranslation("player");
  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(enter, { toValue: 1, useNativeDriver: true, damping: 22, stiffness: 260, mass: 0.9 }).start();
  }, [enter]);
  // Android : Retour ferme le panneau, pas le lecteur (le Modal d'avant le faisait).
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => { onClose(); return true; });
    return () => sub.remove();
  }, [onClose]);

  const fromSide = frame.mode === "side";
  const offset = enter.interpolate({ inputRange: [0, 1], outputRange: [fromSide ? 24 : 32, 0] });
  const position = {
    right: frame.right,
    bottom: frame.bottom,
    ...(frame.left !== undefined ? { left: frame.left } : {}),
    ...(frame.width !== undefined ? { width: frame.width } : {}),
    maxHeight: frame.maxHeight,
    borderRadius: frame.radius,
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={t("close")} />
      <Animated.View
        accessibilityViewIsModal
        style={[st.plate, position, { transform: [fromSide ? { translateX: offset } : { translateY: offset }] }]}
      >
        <View style={[st.clip, { borderRadius: frame.radius, maxHeight: frame.maxHeight }, fill && { height: frame.maxHeight }]}>
          <PanelMaterial radius={frame.radius} />
          <Animated.View style={[st.content, fill && st.fill, { opacity: enter }]}>{children}</Animated.View>
        </View>
      </Animated.View>
    </View>
  );
}

function PanelMaterial({ radius }: { radius: number }) {
  const { liquidGlass } = useThemeMode();
  if (Platform.OS === "android") {
    return <View pointerEvents="none" style={[StyleSheet.absoluteFill, st.android, { borderRadius: radius }]} />;
  }
  const glass = liquidGlass.enabled ? getLiquidGlassModule() : null;
  if (glass) {
    const { GlassView } = glass;
    return (
      <GlassView
        pointerEvents="none"
        glassEffectStyle="regular"
        colorScheme="dark"
        // Une teinte sombre sous le verre : lisible sur une image claire.
        tintColor={PANEL.glassTint}
        style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: "hidden" }]}
      />
    );
  }
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, st.clip, { borderRadius: radius }]}>
      <BlurView intensity={100} tint="systemChromeMaterialDark" style={StyleSheet.absoluteFill} />
    </View>
  );
}

const st = StyleSheet.create({
  // Pas d'ombre : sur une vue sans fond, iOS la recalcule depuis le contenu
  // à chaque image (cf. « Coût GPU »). La matière suffit à détacher la plaque.
  plate: { position: "absolute" },
  android: { backgroundColor: PANEL.androidSurface, borderWidth: StyleSheet.hairlineWidth, borderColor: PANEL.androidBorder },
  clip: { overflow: "hidden" },
  content: { flexShrink: 1 },
  fill: { flex: 1 },
});
