import { memo } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { TV_STAGE } from "@tentacle-tv/theme";
import { BrandMark } from "../../brand/BrandMark";
import { PillButton } from "../../controls/PillButton";
import { GlassSurface } from "../../glass/GlassSurface";
import type { IconName } from "../../icons/Icon";
import { colors, text } from "../../theme/tokens";

/**
 * Ce qui remplace un écran quand il n'a rien à montrer : chargement, erreur,
 * vide. Une phrase qui dit ce qui se passe, une autre qui dit quoi faire, et
 * au plus deux actions — jamais une page noire sans rien de focalisable.
 */

export interface StatusPanelProps {
  kind: "loading" | "error" | "empty";
  title: string;
  message?: string;
  primary?: { label: string; icon?: IconName; onPress?: () => void };
  secondary?: { label: string; icon?: IconName; onPress?: () => void };
}

export const StatusPanel = memo(function StatusPanel({ kind, title, message, primary, secondary }: StatusPanelProps) {
  return (
    <View style={styles.center}>
      <GlassSurface radius={TV_STAGE.radius.panel} tone="strong" style={styles.panel} elevated>
        {kind === "loading" ? (
          <ActivityIndicator size="large" color={colors.text} style={styles.spinner} />
        ) : (
          <BrandMark size={96} crying={kind === "error"} />
        )}
        <Text style={[text.heading, styles.title]}>{title}</Text>
        {message ? <Text style={[text.body, styles.message]}>{message}</Text> : null}
        {primary || secondary ? (
          <View style={styles.actions}>
            {primary ? <PillButton variant="primary" label={primary.label} icon={primary.icon} focusKey="status:primary" onPress={primary.onPress} /> : null}
            {secondary ? <PillButton variant="glass" label={secondary.label} icon={secondary.icon} focusKey="status:secondary" onPress={secondary.onPress} /> : null}
          </View>
        ) : null}
      </GlassSurface>
    </View>
  );
});

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingLeft: TV_STAGE.contentLeft },
  panel: { width: 880, paddingHorizontal: 64, paddingVertical: 56, alignItems: "center", gap: 22 },
  spinner: { transform: [{ scale: 1.6 }], marginVertical: 20 },
  title: { textAlign: "center" },
  message: { textAlign: "center", maxWidth: 700 },
  actions: { flexDirection: "row", gap: 18, marginTop: 14 },
});
