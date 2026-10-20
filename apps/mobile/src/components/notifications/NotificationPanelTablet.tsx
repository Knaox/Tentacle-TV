import { useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Easing, Modal, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { SHADOW_RN, useTheme } from "@/theme";
import { retainModal } from "@/components/ui/modalGate";

/** Largeur du panneau latéral : une colonne de lecture, pas une page. */
const PANEL_WIDTH = 420;
const EDGE = 12;
const ENTER_MS = 260;
const EXIT_MS = 180;

/**
 * La tablette : le centre en PANNEAU LATÉRAL à droite, sur toute la hauteur
 * (sous la barre d'état), qui glisse depuis le bord — une feuille du bas,
 * sur un iPad, éloignait la liste du geste qui l'ouvre. Voile léger, toucher
 * dehors ferme ; déclaré au portier des modales tant qu'il est monté (une
 * affiche d'invitation n'arrive qu'une fois le panneau retiré).
 */
export function NotificationPanelTablet({ visible, onClose, header, children }: {
  visible: boolean;
  onClose: () => void;
  header: ReactNode;
  children: ReactNode;
}) {
  const { t } = useTranslation("common");
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const panelWidth = Math.min(PANEL_WIDTH, width - EDGE * 2);
  const slide = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(slide, { toValue: 1, duration: ENTER_MS, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
      return undefined;
    }
    let gone = false;
    const unmount = () => { if (!gone) { gone = true; setMounted(false); } };
    Animated.timing(slide, { toValue: 0, duration: EXIT_MS, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(unmount);
    // Une animation interrompue ne rappelle jamais : la modale resterait montée.
    const guard = setTimeout(unmount, EXIT_MS + 200);
    return () => clearTimeout(guard);
  }, [visible, slide]);

  useEffect(() => (mounted ? retainModal() : undefined), [mounted]);

  if (!mounted) return null;
  const translateX = slide.interpolate({ inputRange: [0, 1], outputRange: [panelWidth + EDGE * 2, 0] });

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} supportedOrientations={["portrait", "landscape"]} statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: slide, backgroundColor: colors.overlay.scrimSoft }]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityRole="button" accessibilityLabel={t("close")} />
      </Animated.View>
      <Animated.View
        accessibilityViewIsModal
        style={[
          SHADOW_RN.sheet,
          styles.panel,
          {
            top: insets.top + EDGE,
            bottom: Math.max(insets.bottom, EDGE),
            right: Math.max(insets.right, EDGE),
            width: panelWidth,
            backgroundColor: colors.surface.s1,
            borderColor: colors.border.subtle,
            transform: [{ translateX }],
          },
        ]}
      >
        <View style={{ paddingTop: 16 }}>{header}</View>
        <View style={{ flex: 1 }}>{children}</View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  panel: { position: "absolute", borderRadius: 22, overflow: "hidden", borderWidth: StyleSheet.hairlineWidth },
});
