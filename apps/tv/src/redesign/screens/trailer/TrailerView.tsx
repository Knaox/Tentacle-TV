import { memo, type ReactNode } from "react";
import { ActivityIndicator, Image, StyleSheet, Text, View } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { TV_STAGE } from "@tentacle-tv/theme";
import { PillButton } from "../../controls/PillButton";
import { useFocusProgress } from "../../focus/useFocusProgress";
import { GlassSurface } from "../../glass/GlassSurface";
import { useNativeGlassBacking } from "../../glass/glassBacking";
import { Icon } from "../../icons/Icon";
import { colors, fonts, scrim, text } from "../../theme/tokens";

/**
 * La bande-annonce, plein écran. La vidéo occupe tout ; par-dessus, rien que
 * « Fermer » en haut à gauche — la seule chose focalisable (la vidéo, sourde,
 * ne doit pas prendre les touches) — et le titre, qui s'effacent ensemble
 * quand le câblage le dit (`chromeDimmed`, 3 s après le début). « Fermer »
 * garde le focus pendant toute la lecture : c'est le câblage qui rallume le
 * chrome, au moindre geste de la télécommande.
 *
 * Vue pure. Contrat :
 * - `video` : le lecteur (WebView relais sur Android, flux MP4 sur tvOS),
 *   rendu par le câblage ; absent, l'image de l'œuvre en tient lieu. Il est
 *   monté DÈS le chargement (sans quoi il ne chargerait jamais), sous un
 *   voile opaque qui ne se lève qu'en lecture ;
 * - `state` : `loading` tant que l'embed charge, `playing`, `unavailable`
 *   (pas d'identifiant YouTube, pas de serveur, erreur) ;
 * - `waiting` : la lecture lancée attend le réseau — une roue au centre, sur
 *   la dernière image, pour qu'elle ne paraisse jamais figée ;
 * - `onClose` : « Fermer » ; Retour ferme aussi (câblage).
 * Clé du banc : `trailer:close`.
 */

export interface TrailerViewProps {
  state: "loading" | "playing" | "unavailable";
  /** Le nom de la bande-annonce, sinon le titre de l'œuvre. */
  title: string;
  /** L'image de l'œuvre : le fond du chargement et de l'indisponible. */
  backdropUri?: string;
  video?: ReactNode;
  /** Le chrome s'est effacé (lecture en cours, 3 s sans geste). */
  chromeDimmed?: boolean;
  /** La lecture lancée attend le réseau (le temps n'avance plus). */
  waiting?: boolean;
  onClose?: () => void;
}

const CLOSE_KEY = "trailer:close";

export const TrailerView = memo(function TrailerView({ state, title, backdropUri, video, chromeDimmed = false, waiting = false, onClose }: TrailerViewProps) {
  const { t } = useTranslation("common");
  const lit = useFocusProgress(state !== "playing" || !chromeDimmed, 420);
  const chrome = useAnimatedStyle(() => ({ opacity: 0.15 + 0.85 * lit.value }));
  const caption = useAnimatedStyle(() => ({ opacity: lit.value }));
  const backing = useNativeGlassBacking("strong");

  return (
    <View style={styles.root}>
      {state !== "unavailable" && video ? <View style={StyleSheet.absoluteFill}>{video}</View> : null}
      {state === "playing" && !video && backdropUri ? (
        <Image source={{ uri: backdropUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : null}
      {state !== "playing" ? (
        <View style={[StyleSheet.absoluteFill, styles.cover]}>
          {backdropUri ? (
            <Image source={{ uri: backdropUri }} style={[StyleSheet.absoluteFill, styles.dimArt]} resizeMode="cover" blurRadius={state === "unavailable" ? 18 : 0} />
          ) : null}
        </View>
      ) : null}

      {state === "playing" ? (
        <Animated.View pointerEvents="none" style={[styles.bottom, caption]}>
          <LinearGradient colors={[scrim(0), scrim(0.7)]} style={StyleSheet.absoluteFill} />
          <Text style={styles.kicker}>{t("trailer")}</Text>
          <Text style={styles.title} numberOfLines={2}>{title}</Text>
        </Animated.View>
      ) : null}

      {state === "playing" && waiting ? (
        <View pointerEvents="none" style={styles.center}>
          <View style={styles.waitBadge}>
            <ActivityIndicator size="large" color={colors.text} style={styles.waitSpinner} />
          </View>
        </View>
      ) : null}

      {state === "loading" ? (
        <View pointerEvents="none" style={styles.center}>
          <ActivityIndicator size="large" color={colors.text} style={styles.spinner} />
          <Text style={styles.kicker}>{t("trailer")}</Text>
          <Text style={[styles.title, styles.centered]} numberOfLines={2}>{title}</Text>
        </View>
      ) : null}

      {state === "unavailable" ? (
        <View style={styles.center}>
          <GlassSurface radius={TV_STAGE.radius.panel} tone="strong" elevated style={[styles.panel, backing]}>
            <View style={styles.badge}>
              <Icon name="trailer" size={40} color={colors.text} />
            </View>
            <Text style={[styles.title, styles.centered]} numberOfLines={2}>{title}</Text>
            <Text style={[text.body, styles.centered]}>{t("trailerUnavailableTv")}</Text>
            <View style={styles.action}>
              <PillButton label={t("close")} icon="close" focusKey={CLOSE_KEY} onPress={onClose} />
            </View>
          </GlassSurface>
        </View>
      ) : (
        <Animated.View style={[styles.close, chrome]}>
          <PillButton label={t("close")} icon="close" variant="glass" size="md" focusKey={CLOSE_KEY} onPress={onClose} />
        </Animated.View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  // Le voile du chargement : opaque, il cache le lecteur qui se prépare dessous.
  cover: { backgroundColor: "#000" },
  dimArt: { opacity: 0.32 },
  center: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", paddingHorizontal: 240 },
  spinner: { transform: [{ scale: 1.6 }], marginBottom: 44 },
  // La roue de l'attente, sur un disque sombre : lisible sur une image claire.
  waitBadge: { width: 128, height: 128, borderRadius: 64, alignItems: "center", justifyContent: "center", backgroundColor: scrim(0.55) },
  waitSpinner: { transform: [{ scale: 1.6 }] },
  bottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: TV_STAGE.safe.x,
    paddingTop: 160,
    paddingBottom: TV_STAGE.safe.y + 16,
  },
  kicker: { ...text.kicker, color: colors.accentLight, marginBottom: 10 },
  title: { ...fonts.bold, fontSize: 44, lineHeight: 52, color: colors.text },
  centered: { textAlign: "center" },
  panel: { width: 900, alignItems: "center", gap: 18, paddingHorizontal: 64, paddingVertical: 52, backgroundColor: "rgba(12, 12, 16, 0.78)" },
  badge: { width: 88, height: 88, borderRadius: 44, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255, 255, 255, 0.1)", marginBottom: 6 },
  action: { marginTop: 18 },
  close: { position: "absolute", top: TV_STAGE.safe.y, left: TV_STAGE.safe.x },
});
