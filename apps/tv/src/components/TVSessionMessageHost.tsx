import { memo, useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { TV_OVERSCAN_PT } from "@tentacle-tv/theme";
import { useSessionMessages, type ShownSessionMessage } from "../hooks/useSessionMessages";
import { REDESIGN_ACTIVE } from "../redesignWiring/redesignGate";
import { SessionMessagesRedesign } from "../redesignWiring/overlays/noticesRedesign";
import { Colors, Typography } from "../theme/colors";

/**
 * Les messages que l'administrateur envoie à ce téléviseur — depuis le tableau
 * de bord de Jellyfin (`DisplayMessage`) ou celui de Tentacle. Monté une fois,
 * au-dessus du navigateur : ils arrivent aussi en pleine lecture.
 *
 * La file (délais bornés, deux au plus, effacement toujours seul) est commune
 * aux deux téléviseurs : `useSessionMessages`. Ici, le rendu — une barre qui
 * se vide dit le temps qui reste.
 */

const WIDTH = 560;

export function TVSessionMessageHost() {
  return REDESIGN_ACTIVE ? <SessionMessagesRedesign /> : <LegacySessionMessageHost />;
}

function LegacySessionMessageHost() {
  const { t } = useTranslation("sessions");
  const messages = useSessionMessages();

  if (messages.length === 0) return null;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: "flex-end" }]}>
      <View style={{ marginTop: TV_OVERSCAN_PT.y, marginRight: TV_OVERSCAN_PT.x, gap: 12 }}>
        {messages.map((message) => (
          <Banner key={message.id} message={message} label={t("messageFrom")} />
        ))}
      </View>
    </View>
  );
}

const Banner = memo(function Banner({ message, label }: {
  message: ShownSessionMessage;
  label: string;
}) {
  const remaining = useSharedValue(1);
  const { durationMs } = message;

  useEffect(() => {
    // `transform` seulement : la barre se vide sur le fil UI, sans repeindre.
    remaining.value = withTiming(0, { duration: durationMs, easing: Easing.linear });
  }, [durationMs, remaining]);

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
