import { memo } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { TV_STAGE } from "@tentacle-tv/theme";
import { GlassSurface } from "../../glass/GlassSurface";
import { Icon } from "../../icons/Icon";
import { colors, fonts, white } from "../../theme/tokens";
import { DENSE_BASE, SOFT_BASE } from "./surfaces";

/**
 * Ce que le lecteur dit sans rien demander — aucun de ces éléments n'est
 * focalisable :
 * - `BufferingBadge` : la mémoire tampon se remplit (rechargement doux compris) ;
 * - `QualityNotice` : le plafond automatique de débit a réduit la qualité ;
 * - `ErrorBanner` : une erreur de lecture, qui s'efface seule (8 s, côté app).
 */

const SAFE = TV_STAGE.safe;

export const BufferingBadge = memo(function BufferingBadge() {
  return (
    <View pointerEvents="none" style={styles.center}>
      <GlassSurface radius={70} tone="regular" elevated style={styles.buffering}>
        <ActivityIndicator size="large" color={colors.text} style={styles.spinner} />
      </GlassSurface>
    </View>
  );
});

export const QualityNotice = memo(function QualityNotice({ text }: { text: string }) {
  return (
    <View pointerEvents="none" style={styles.top}>
      <GlassSurface radius={32} tone="regular" elevated style={styles.notice}>
        <Icon name="gauge" size={28} color={colors.accentLight} strokeWidth={2.2} />
        <Text style={styles.noticeText} numberOfLines={1}>{text}</Text>
      </GlassSurface>
    </View>
  );
});

export const ErrorBanner = memo(function ErrorBanner({ title, message }: { title: string; message?: string }) {
  return (
    <View pointerEvents="none" style={styles.top}>
      <GlassSurface radius={32} tone="strong" elevated style={styles.error}>
        <View style={styles.errorIcon}>
          <Icon name="alert" size={30} color={colors.text} strokeWidth={2.2} />
        </View>
        <View style={styles.errorText}>
          <Text style={styles.errorTitle} numberOfLines={1}>{title}</Text>
          {message ? <Text style={styles.errorMessage} numberOfLines={2}>{message}</Text> : null}
        </View>
      </GlassSurface>
    </View>
  );
});

const styles = StyleSheet.create({
  center: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  buffering: { width: 140, height: 140, alignItems: "center", justifyContent: "center", backgroundColor: SOFT_BASE },
  spinner: { transform: [{ scale: 1.5 }] },
  top: { position: "absolute", top: SAFE.y, left: 0, right: 0, alignItems: "center" },
  notice: { flexDirection: "row", alignItems: "center", gap: 16, height: 64, paddingHorizontal: 30, backgroundColor: SOFT_BASE },
  noticeText: { ...fonts.semibold, fontSize: 26, color: colors.text },
  error: { flexDirection: "row", alignItems: "center", gap: 22, width: 1040, paddingVertical: 22, paddingHorizontal: 28, backgroundColor: DENSE_BASE },
  errorIcon: { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center", backgroundColor: colors.error },
  errorText: { flex: 1, gap: 4 },
  errorTitle: { ...fonts.bold, fontSize: 30, color: colors.text },
  errorMessage: { ...fonts.medium, fontSize: 24, lineHeight: 32, color: white(0.72) },
});
