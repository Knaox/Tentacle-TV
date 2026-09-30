import { memo } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { RoundButton } from "../../controls/RoundButton";
import { colors, fonts, white } from "../../theme/tokens";
import type { SheetHeaderModel } from "./sheetTypes";

/**
 * L'en-tête : l'image de la carte — sa forme, affiche ou vignette —, son
 * titre et sa ligne de contexte, ce que le voile vient de recouvrir ; puis la
 * croix, la sortie visible (Retour ferme aussi).
 */

const ART = { poster: { width: 104, height: 156 }, landscape: { width: 224, height: 126 } };

export const SheetHeader = memo(function SheetHeader({
  header,
  onClose,
}: {
  header: SheetHeaderModel;
  onClose?: () => void;
}) {
  const { t } = useTranslation("common");
  const art = ART[header.shape];
  return (
    <View style={styles.header}>
      <View style={[styles.art, art]}>
        {header.imageUri ? (
          <Image source={{ uri: header.imageUri }} style={StyleSheet.absoluteFill} resizeMode="cover" fadeDuration={0} />
        ) : null}
      </View>
      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={2}>{header.title}</Text>
        {header.subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{header.subtitle}</Text> : null}
      </View>
      <RoundButton icon="close" label={t("close")} size={60} focusKey="sheet:close" onPress={onClose} />
    </View>
  );
});

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 24 },
  art: { borderRadius: 16, overflow: "hidden", backgroundColor: white(0.08) },
  text: { flex: 1, gap: 6 },
  title: { ...fonts.bold, fontSize: 36, lineHeight: 42, color: colors.text },
  subtitle: { ...fonts.medium, fontSize: 24, color: colors.textTertiary },
});
