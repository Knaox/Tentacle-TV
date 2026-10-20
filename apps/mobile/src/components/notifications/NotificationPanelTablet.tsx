import { useEffect, type ReactNode } from "react";
import { Modal, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { SHADOW_RN, useTheme } from "@/theme";
import { retainModal } from "@/components/ui/modalGate";

/** Largeur du panneau : celle du menu déroulant de la cloche du bureau, un peu plus pour le doigt. */
const PANEL_WIDTH = 400;
/** Sous l'en-tête persistant, où vit la cloche. */
const HEADER_OFFSET = 56;
const EDGE = 12;

/**
 * La tablette : le centre en PANNEAU ancré sous la cloche, en haut à droite,
 * comme le menu du bureau — une feuille du bas pleine largeur, sur un iPad
 * paysage, éloignait la liste du geste qui l'ouvre. Voile léger, toucher
 * dehors ferme ; déclaré au portier des modales tant qu'il est monté (une
 * affiche d'invitation n'arrive qu'une fois le panneau retiré).
 */
export function NotificationPanelTablet({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: ReactNode }) {
  const { t } = useTranslation("common");
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  useEffect(() => (visible ? retainModal() : undefined), [visible]);

  const top = insets.top + HEADER_OFFSET;
  const panelWidth = Math.min(PANEL_WIDTH, width - EDGE * 2);
  const panelHeight = Math.min(height - top - insets.bottom - EDGE * 2, 680);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} supportedOrientations={["portrait", "landscape"]}>
      <Pressable
        style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay.scrimSoft }]}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t("close")}
      />
      <View
        accessibilityViewIsModal
        style={[
          SHADOW_RN.sheet,
          {
            position: "absolute",
            top,
            right: Math.max(insets.right, EDGE),
            width: panelWidth,
            height: panelHeight,
            borderRadius: 20,
            paddingTop: 14,
            overflow: "hidden",
            backgroundColor: colors.surface.s1,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.border.subtle,
          },
        ]}
      >
        {children}
      </View>
    </Modal>
  );
}
