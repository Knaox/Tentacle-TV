import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { GlassSurface } from "../../glass/GlassSurface";
import { useNativeGlassBacking } from "../../glass/glassBacking";
import { Icon } from "../../icons/Icon";
import { colors, fonts } from "../../theme/tokens";
import { SOFT_BASE } from "./surfaces";

/**
 * Le badge d'un saut OSD caché (double appui ←/→) : « +30 s » du côté où
 * l'on va, « −10 s » de l'autre — sans rallumer l'habillage. Les appuis
 * rapprochés se cumulent (+60, +90) : c'est l'intégration qui compte.
 */
export const SeekFlash = memo(function SeekFlash({ forward, label }: { forward: boolean; label: string }) {
  const backing = useNativeGlassBacking("regular");
  return (
    <View pointerEvents="none" style={[styles.anchor, forward ? styles.right : styles.left]}>
      <GlassSurface radius={48} tone="regular" elevated style={[styles.pill, backing]}>
        {forward ? null : <Icon name="replay" size={40} color={colors.text} strokeWidth={2.2} />}
        <Text style={styles.label}>{label}</Text>
        {forward ? <Icon name="forward" size={40} color={colors.text} strokeWidth={2.2} /> : null}
      </GlassSurface>
    </View>
  );
});

const styles = StyleSheet.create({
  anchor: { position: "absolute", top: 492 },
  left: { left: 160 },
  right: { right: 160 },
  pill: { flexDirection: "row", alignItems: "center", gap: 16, height: 96, paddingHorizontal: 36, backgroundColor: SOFT_BASE },
  label: { ...fonts.extrabold, fontSize: 40, color: colors.text, fontVariant: ["tabular-nums"] },
});
