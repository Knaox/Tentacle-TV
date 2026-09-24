import { memo, useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, StyleSheet, Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { onSessionMessage, type SessionMessage } from "@tentacle-tv/api-client";
import { TV_OVERSCAN_PT } from "@tentacle-tv/theme";
import { Colors, Typography } from "../theme/colors";

/**
 * Les messages que l'administrateur envoie à ce téléviseur — depuis le tableau
 * de bord de Jellyfin (`DisplayMessage`) ou celui de Tentacle. Monté une fois,
 * au-dessus du navigateur : ils arrivent aussi en pleine lecture.
 *
 * Différence avec le web et le mobile : ici, rien ne se ferme d'un geste — un
 * bandeau focalisable volerait le focus à ce qu'on est en train de faire (le
 * film, le menu). Un message s'efface donc TOUJOURS seul : son délai s'il en a
 * un (borné à 3–60 s), sinon quinze secondes, et une barre qui se vide le dit.
 * Deux au plus : les plus anciens cèdent.
 */

const MIN_TIMEOUT_MS = 3_000;
const MAX_TIMEOUT_MS = 60_000;
const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_VISIBLE = 2;
const WIDTH = 560;

interface Shown extends SessionMessage {
  id: number;
  durationMs: number;
}

export function TVSessionMessageHost() {
  const { t } = useTranslation("sessions");
  const [messages, setMessages] = useState<Shown[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => {
    setMessages((current) => current.filter((m) => m.id !== id));
  }, []);

  useEffect(() => onSessionMessage((message) => {
    seq.current += 1;
    const durationMs = message.timeoutMs === undefined
      ? DEFAULT_TIMEOUT_MS
      : Math.min(Math.max(message.timeoutMs, MIN_TIMEOUT_MS), MAX_TIMEOUT_MS);
    setMessages((current) => [...current, { ...message, id: seq.current, durationMs }].slice(-MAX_VISIBLE));
    AccessibilityInfo.announceForAccessibility([t("messageFrom"), message.header, message.text].filter(Boolean).join(". "));
  }), [t]);

  if (messages.length === 0) return null;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: "flex-end" }]}>
      <View style={{ marginTop: TV_OVERSCAN_PT.y, marginRight: TV_OVERSCAN_PT.x, gap: 12 }}>
        {messages.map((message) => (
          <Banner key={message.id} message={message} label={t("messageFrom")} onDone={dismiss} />
        ))}
      </View>
    </View>
  );
}

const Banner = memo(function Banner({ message, label, onDone }: {
  message: Shown;
  label: string;
  onDone: (id: number) => void;
}) {
  const remaining = useSharedValue(1);
  const { id, durationMs } = message;

  useEffect(() => {
    // `transform` seulement : la barre se vide sur le fil UI, sans repeindre.
    remaining.value = withTiming(0, { duration: durationMs, easing: Easing.linear });
    const timer = setTimeout(() => onDone(id), durationMs);
    return () => clearTimeout(timer);
  }, [durationMs, id, onDone, remaining]);

  const bar = useAnimatedStyle(() => ({ transform: [{ scaleX: remaining.value }] }));

  return (
    <View style={{
      width: WIDTH, borderRadius: 16, overflow: "hidden",
      backgroundColor: Colors.glassBgHeavy, borderWidth: 1, borderColor: Colors.glassBorder,
    }}>
      <View style={{ paddingHorizontal: 24, paddingTop: 18, paddingBottom: 20 }}>
        <Text style={{
          color: Colors.accentPurpleLight, fontSize: 13, fontWeight: "700", letterSpacing: 1.2,
          textTransform: "uppercase", marginBottom: 6,
        }}>
          {label}
        </Text>
        {message.header ? (
          <Text numberOfLines={2} style={{ color: Colors.textPrimary, ...Typography.cardTitle, fontSize: 20, fontWeight: "700" }}>
            {message.header}
          </Text>
        ) : null}
        {message.text ? (
          <Text numberOfLines={6} style={{ color: Colors.textSecondary, ...Typography.body, fontSize: 18, lineHeight: 26, marginTop: 4 }}>
            {message.text}
          </Text>
        ) : null}
      </View>
      <Animated.View style={[{ height: 3, backgroundColor: Colors.accentPurpleLight, transformOrigin: "left" }, bar]} />
    </View>
  );
});
