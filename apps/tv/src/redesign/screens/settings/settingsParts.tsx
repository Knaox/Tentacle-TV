import { memo } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { Icon, type IconName } from "../../icons/Icon";
import { colors, fonts, white } from "../../theme/tokens";

/**
 * Les petites pièces des réglages : les styles de texte du panneau, le titre
 * d'une section, une ligne « libellé — valeur », le portrait du compte.
 * Planchers de la scène : rien sous 22, texte courant 26, titres 36.
 */

export const settingsText = StyleSheet.create({
  section: { ...fonts.bold, fontSize: 36, lineHeight: 44, letterSpacing: -0.3, color: colors.text },
  caption: { ...fonts.regular, fontSize: 26, lineHeight: 36, color: colors.textTertiary },
  hint: { ...fonts.regular, fontSize: 26, lineHeight: 36, color: colors.textSecondary },
  label: { ...fonts.bold, fontSize: 22, lineHeight: 28, letterSpacing: 2, textTransform: "uppercase", color: colors.textTertiary },
  value: { ...fonts.semibold, fontSize: 28, lineHeight: 36, color: colors.text },
  small: { ...fonts.medium, fontSize: 22, lineHeight: 30, color: colors.textTertiary },
});

/** Le titre d'une section du panneau, et sa phrase d'explication. */
export const SectionTitle = memo(function SectionTitle({ title, caption }: { title: string; caption?: string }) {
  return (
    <View style={styles.section}>
      <Text style={settingsText.section}>{title}</Text>
      {caption ? <Text style={[settingsText.caption, styles.sectionCaption]}>{caption}</Text> : null}
    </View>
  );
});

/** « SERVEUR   http://… » : ce qu'on vient lire, jamais focalisable. */
export const InfoRow = memo(function InfoRow({ label, value, icon, labelWidth = 230 }: {
  label: string;
  value: string;
  icon?: IconName;
  labelWidth?: number;
}) {
  return (
    <View style={styles.infoRow}>
      {icon ? <Icon name={icon} size={26} color={colors.textTertiary} /> : null}
      <Text style={[settingsText.label, { width: labelWidth }]} numberOfLines={1}>{label}</Text>
      <Text style={[settingsText.value, styles.infoValue]} numberOfLines={1}>{value}</Text>
    </View>
  );
});

/** Le portrait du compte ; l'initiale sur le rose de la marque quand il n'y en a pas. */
export const Avatar = memo(function Avatar({ uri, name, size }: { uri?: string; name: string; size: number }) {
  const round = { width: size, height: size, borderRadius: size / 2 };
  return (
    <View style={[round, styles.avatarRing]}>
      {uri ? (
        <Image source={{ uri }} style={round} fadeDuration={0} />
      ) : (
        <View style={[round, styles.initialBox]}>
          <Text style={[styles.initial, { fontSize: size * 0.42 }]}>{(name[0] ?? "?").toUpperCase()}</Text>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  section: { gap: 8, marginBottom: 22 },
  sectionCaption: { maxWidth: 1040 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 18, minHeight: 44 },
  infoValue: { flex: 1 },
  avatarRing: {
    borderWidth: 2,
    borderColor: white(0.16),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
  },
  initialBox: { alignItems: "center", justifyContent: "center", backgroundColor: colors.accent },
  initial: { ...fonts.extrabold, color: colors.onAccent },
});
