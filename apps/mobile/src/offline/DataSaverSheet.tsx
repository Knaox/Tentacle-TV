import { useCallback, useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { BottomSheet, Button } from "@/components/ui";
import { spacing, typography, FONT_FAMILY, useThemedStyles, type AppTheme } from "@/theme";
import { useDataSaverActive, useDataSaverSetting } from "./useDataSaver";

interface Props {
  visible: boolean;
  onClose: () => void;
}

/**
 * La bulle de la pastille « Économie » : pourquoi le mode est actif (forcé ou
 * détecté), ce qu'il change, le rappel du retour à la normale, et le bouton
 * qui le coupe pour cet appareil.
 */
export function DataSaverSheet({ visible, onClose }: Props) {
  const { t } = useTranslation("downloads");
  const { t: to } = useTranslation("offline");
  const active = useDataSaverActive();
  const { setting, setSetting } = useDataSaverSetting();
  const st = useThemedStyles(makeStyles);

  // Plus rien à expliquer une fois le mode inactif.
  useEffect(() => {
    if (visible && !active) onClose();
  }, [visible, active, onClose]);

  const disable = useCallback(() => {
    onClose();
    setSetting("off");
  }, [onClose, setSetting]);

  return (
    <BottomSheet visible={visible} onClose={onClose} snapPoints={[0.42, 0.6]}>
      <View style={st.body}>
        <Text style={st.title} accessibilityRole="header">{t("saverPopoverTitle")}</Text>
        <Text style={st.text}>{setting === "on" ? t("saverForcedReason") : to("saverAutoReason")}</Text>
        <Text style={st.hint}>{t("saverEffects")}</Text>
        {setting === "auto" && <Text style={st.hint}>{t("saverAutoHint")}</Text>}
        <View style={st.actions}>
          <Button title={t("saverDisable")} onPress={disable} variant="secondary" fullWidth />
        </View>
      </View>
    </BottomSheet>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    body: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.sm },
    title: { ...typography.subtitle, fontFamily: FONT_FAMILY.bold, color: t.colors.text.primary },
    text: { ...typography.body, color: t.colors.text.secondary, lineHeight: 20 },
    hint: { ...typography.caption, color: t.colors.text.quaternary, lineHeight: 17 },
    actions: { gap: spacing.sm, marginTop: spacing.md },
  });
