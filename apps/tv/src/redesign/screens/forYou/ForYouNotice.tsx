import { memo } from "react";
import { StyleSheet, Text } from "react-native";
import { GlassSurface } from "../../glass/GlassSurface";
import { Icon } from "../../icons/Icon";
import { colors, fonts } from "../../theme/tokens";

/**
 * La ligne d'état de « Pour vous », entre le héros et les étagères, quand la
 * page a encore de quoi montrer : recommandations désactivées pour le compte
 * (des suggestions générales suivent) ou démarrage à froid (le moteur
 * attend des signaux). Une phrase, pas un bouton : sur la télévision, le
 * réglage vit sur le téléphone et l'ordinateur. Non focalisable.
 */

export interface ForYouNoticeModel {
  kind: "disabled" | "cold";
  text: string;
}

export const ForYouNotice = memo(function ForYouNotice({ notice, width }: { notice: ForYouNoticeModel; width: number }) {
  return (
    <GlassSurface radius={30} tone="regular" style={[styles.strip, { maxWidth: width }]}>
      <Icon name={notice.kind === "disabled" ? "eyeOff" : "sparkles"} size={30} color={colors.accentLight} />
      <Text style={styles.text} numberOfLines={2}>{notice.text}</Text>
    </GlassSurface>
  );
});

const styles = StyleSheet.create({
  strip: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 20, paddingHorizontal: 32, paddingVertical: 20 },
  text: { ...fonts.medium, fontSize: 27, lineHeight: 36, color: colors.textSecondary, flexShrink: 1 },
});
