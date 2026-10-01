import { memo } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import { TV_STAGE } from "@tentacle-tv/theme";
import { GlassSurface } from "../../glass/GlassSurface";
import { useNativeGlassBacking } from "../../glass/glassBacking";
import { Icon } from "../../icons/Icon";
import { Presented } from "../../motion/Presented";
import { colors, fonts, white } from "../../theme/tokens";
import { DENSE_BASE, SOFT_BASE } from "./surfaces";

/**
 * Ce que le lecteur dit sans rien demander — aucun de ces éléments n'est
 * focalisable :
 * - `BufferingBadge` : la mémoire tampon se remplit (rechargement doux compris) ;
 *   dessous, en fondu, une ligne discrète quand l'attente a une raison à dire
 *   (« Le transcodage peut prendre un peu plus de temps ») ;
 * - `QualityNotice` : le plafond automatique de débit a réduit la qualité ;
 * - `ErrorBanner` : une erreur de lecture, qui s'efface seule (8 s, côté app).
 */

const SAFE = TV_STAGE.safe;

const BADGE = 140;

function BufferingHint({ text, appear }: { text: string; appear: SharedValue<number> }) {
  const backing = useNativeGlassBacking("regular");
  const fade = useAnimatedStyle(() => ({ opacity: appear.value }));
  return (
    <Animated.View style={[styles.hintAnchor, fade]}>
      <GlassSurface radius={28} tone="regular" style={[styles.hint, backing]}>
        <Text style={styles.hintText} numberOfLines={1}>{text}</Text>
      </GlassSurface>
    </Animated.View>
  );
}

/** L'indicateur reste au centre exact de l'image ; la ligne se pose dessous, hors de sa mise en page. */
export const BufferingBadge = memo(function BufferingBadge({ hint }: { hint?: string | null }) {
  const backing = useNativeGlassBacking("regular");
  return (
    <View pointerEvents="none" style={styles.center}>
      <View>
        <GlassSurface radius={BADGE / 2} tone="regular" elevated style={[styles.buffering, backing]}>
          <ActivityIndicator size="large" color={colors.text} style={styles.spinner} />
        </GlassSurface>
        <Presented value={hint ?? null} motion="reveal">{(text, appear) => <BufferingHint text={text} appear={appear} />}</Presented>
      </View>
    </View>
  );
});

export const QualityNotice = memo(function QualityNotice({ text }: { text: string }) {
  const backing = useNativeGlassBacking("regular");
  return (
    <View pointerEvents="none" style={styles.top}>
      <GlassSurface radius={32} tone="regular" elevated style={[styles.notice, backing]}>
        <Icon name="gauge" size={28} color={colors.accentLight} strokeWidth={2.2} />
        <Text style={styles.noticeText} numberOfLines={1}>{text}</Text>
      </GlassSurface>
    </View>
  );
});

export const ErrorBanner = memo(function ErrorBanner({ title, message }: { title: string; message?: string }) {
  const backing = useNativeGlassBacking("strong");
  return (
    <View pointerEvents="none" style={styles.top}>
      <GlassSurface radius={32} tone="strong" elevated style={[styles.error, backing]}>
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
  buffering: { width: BADGE, height: BADGE, alignItems: "center", justifyContent: "center", backgroundColor: SOFT_BASE },
  spinner: { transform: [{ scale: 1.5 }] },
  // Plus large que l'indicateur : centrée sous lui, sur toute la largeur utile.
  hintAnchor: { position: "absolute", top: BADGE + 28, left: -600, right: -600, alignItems: "center" },
  hint: { height: 56, paddingHorizontal: 28, justifyContent: "center", backgroundColor: SOFT_BASE },
  hintText: { ...fonts.medium, fontSize: 26, color: white(0.9) },
  top: { position: "absolute", top: SAFE.y, left: 0, right: 0, alignItems: "center" },
  notice: { flexDirection: "row", alignItems: "center", gap: 16, height: 64, paddingHorizontal: 30, backgroundColor: SOFT_BASE },
  noticeText: { ...fonts.semibold, fontSize: 26, color: colors.text },
  error: { flexDirection: "row", alignItems: "center", gap: 22, width: 1040, paddingVertical: 22, paddingHorizontal: 28, backgroundColor: DENSE_BASE },
  errorIcon: { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center", backgroundColor: colors.error },
  errorText: { flex: 1, gap: 4 },
  errorTitle: { ...fonts.bold, fontSize: 30, color: colors.text },
  errorMessage: { ...fonts.medium, fontSize: 24, lineHeight: 32, color: white(0.72) },
});
