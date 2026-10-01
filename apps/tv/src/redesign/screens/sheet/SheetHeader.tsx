import { memo } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { BackButton } from "../../controls/BackButton";
import { FocusGroup } from "../../focus/FocusGroup";
import { colors, fonts, white } from "../../theme/tokens";
import type { SheetHeaderModel } from "./sheetTypes";

/**
 * L'en-tête : la croix Retour dans le coin haut-gauche du panneau — la règle
 * de toute la refonte (`controls/BackButton`) —, puis l'image de la carte —
 * sa forme, affiche ou vignette —, son titre et sa ligne de contexte, ce que
 * le voile vient de recouvrir. Menu ferme aussi.
 *
 * Focus (câblage) : groupe `sheet:header`, sur TOUTE la largeur du panneau —
 * la croix, dans son coin, n'est au-dessus ni du cran visé ni des pictos ; le
 * groupe, si. Croix : `sheet:close`.
 */

const ART = { poster: { width: 104, height: 156 }, landscape: { width: 224, height: 126 } };

export const SheetHeader = memo(function SheetHeader({
  header,
  onClose,
}: {
  header: SheetHeaderModel;
  onClose?: () => void;
}) {
  const art = ART[header.shape];
  return (
    <FocusGroup focusKey="sheet:header" style={styles.header}>
      <View style={styles.back}>
        <BackButton focusKey="sheet:close" onPress={onClose} />
      </View>
      <View style={[styles.art, art]}>
        {header.imageUri ? (
          <Image source={{ uri: header.imageUri }} style={StyleSheet.absoluteFill} resizeMode="cover" fadeDuration={0} />
        ) : null}
      </View>
      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={2}>{header.title}</Text>
        {header.subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{header.subtitle}</Text> : null}
      </View>
    </FocusGroup>
  );
});

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 24 },
  // Dans le coin : calée en haut de l'en-tête, quelle que soit la forme de l'image.
  back: { alignSelf: "flex-start" },
  art: { borderRadius: 16, overflow: "hidden", backgroundColor: white(0.08) },
  text: { flex: 1, gap: 6 },
  title: { ...fonts.bold, fontSize: 36, lineHeight: 42, color: colors.text },
  subtitle: { ...fonts.medium, fontSize: 24, color: colors.textTertiary },
});
