import { memo, useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { Easing, FadeInRight, FadeOutRight, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { TV_STAGE } from "@tentacle-tv/theme";
import { GlassSurface } from "../../glass/GlassSurface";
import { Icon } from "../../icons/Icon";
import { colors, fonts, text, white } from "../../theme/tokens";

/**
 * Les messages que l'administrateur envoie à ce téléviseur (tableau de bord
 * de Jellyfin ou de Tentacle) — deux au plus, en haut à droite, par-dessus
 * tout, film compris. Rien ne se ferme d'un geste : un bandeau focalisable
 * volerait le focus. Chacun s'efface seul, et sa barre ambre qui se vide le
 * dit (sur `transform` seulement).
 *
 * Contrat : `onSessionMessage` alimente la liste (l'hôte borne le délai à
 * 3–60 s, 15 s par défaut, et retire le message à échéance). `remaining` est
 * la part du délai qui reste (1 à l'arrivée) ; avec `durationMs`, la barre
 * se vide jusqu'au bout, sans lui, elle reste où elle est (banc).
 */

export interface SessionMessageModel {
  id: string | number;
  header?: string;
  text?: string;
  /** 0 → 1 : ce qui reste du délai d'affichage. */
  remaining: number;
  /** Le délai complet ; absent = barre figée. */
  durationMs?: number;
}

const WIDTH = 660;

export const SessionMessages = memo(function SessionMessages({ messages }: { messages: SessionMessageModel[] }) {
  const { t } = useTranslation("sessions");
  if (!messages.length) return null;
  return (
    <View pointerEvents="none" style={styles.layer}>
      {messages.slice(-2).map((message) => (
        <Animated.View key={message.id} entering={FadeInRight.duration(360)} exiting={FadeOutRight.duration(300)}>
          <MessageCard message={message} label={t("messageFrom")} />
        </Animated.View>
      ))}
    </View>
  );
});

function MessageCard({ message, label }: { message: SessionMessageModel; label: string }) {
  const remaining = useSharedValue(message.remaining);
  useEffect(() => {
    if (!message.durationMs) return;
    remaining.value = withTiming(0, { duration: message.durationMs * message.remaining, easing: Easing.linear });
  }, [message.durationMs, message.remaining, remaining]);
  const bar = useAnimatedStyle(() => ({ transform: [{ scaleX: remaining.value }] }));
  return (
    <View style={styles.shadow}>
      <View style={styles.card}>
        <GlassSurface radius={RADIUS} tone="strong" style={StyleSheet.absoluteFill} />
        <View style={styles.body}>
          <View style={styles.kickerRow}>
            <Icon name="message" size={24} color={colors.accent} strokeWidth={2.4} />
            <Text style={[text.kicker, styles.kicker]} numberOfLines={1}>{label}</Text>
          </View>
          {message.header ? <Text style={styles.header} numberOfLines={2}>{message.header}</Text> : null}
          {message.text ? <Text style={styles.text} numberOfLines={6}>{message.text}</Text> : null}
        </View>
        <View style={styles.track}>
          <Animated.View style={[styles.fill, bar]} />
        </View>
      </View>
    </View>
  );
}

const RADIUS = 30;

const styles = StyleSheet.create({
  layer: { position: "absolute", top: TV_STAGE.safe.y, right: TV_STAGE.safe.x, width: WIDTH, gap: 18 },
  // Le fond dense porte l'ombre ; la carte, dessus, rogne la barre aux coins.
  shadow: {
    width: WIDTH,
    borderRadius: RADIUS,
    backgroundColor: "rgba(10, 10, 14, 0.96)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.45,
    shadowRadius: 30,
  },
  card: { borderRadius: RADIUS, overflow: "hidden" },
  body: { paddingHorizontal: 32, paddingTop: 26, paddingBottom: 28, gap: 10 },
  kickerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  kicker: { fontSize: 22, letterSpacing: 2.6, flexShrink: 1 },
  header: { ...fonts.bold, fontSize: 32, lineHeight: 40, color: colors.text },
  text: { ...fonts.regular, fontSize: 26, lineHeight: 36, color: colors.textSecondary },
  track: { height: 6, backgroundColor: white(0.1) },
  fill: { flex: 1, backgroundColor: colors.accent, transformOrigin: "left" },
});
