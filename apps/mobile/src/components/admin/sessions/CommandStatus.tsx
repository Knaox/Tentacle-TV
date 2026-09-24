import { memo } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import type { Feedback } from "@tentacle-tv/shared";
import { FONT_FAMILY, useTheme } from "@/theme";

const REQUESTED = { Pause: "pauseRequested", Unpause: "resumeRequested", Stop: "stopRequested" } as const;

/**
 * La ligne d'état d'une lecture — « En lecture », « En pause » — qui suit
 * aussi la commande en cours : « Pause demandée… » tant que l'appareil ne
 * l'a pas appliquée, une coche quand l'instantané la constate, un
 * avertissement s'il tarde. Le bouton dit « envoyé », la ligne dit « fait ».
 */
export const CommandStatus = memo(function CommandStatus({ isPaused, feedback }: {
  isPaused: boolean;
  feedback: Feedback | undefined;
}) {
  const { t } = useTranslation("sessions");
  const theme = useTheme();
  const command = feedback && feedback.command !== "message" ? feedback.command : null;
  const phase = command === null ? null : feedback?.phase;
  const state = isPaused ? t("paused") : t("playing");

  let icon: React.ReactNode;
  let text: string;
  let color = theme.colors.text.tertiary;
  if (command !== null && (phase === "sending" || phase === "waiting")) {
    icon = <ActivityIndicator size="small" color={theme.colors.brand.light} style={st.spinner} />;
    text = t(REQUESTED[command]);
    color = theme.colors.brand.light;
  } else if (command !== null && phase === "late") {
    color = theme.colors.statusPairs.warning.fg;
    icon = <Feather name="alert-circle" size={12} color={color} />;
    text = t("deviceLate");
  } else if ((command === "Pause" || command === "Unpause") && phase === "done") {
    color = theme.colors.statusPairs.success.fg;
    icon = <Feather name="check" size={12} color={color} />;
    text = state;
  } else {
    icon = <Feather name={isPaused ? "pause" : "play"} size={11} color={color} />;
    text = state;
  }

  return (
    <View style={st.row} accessibilityLiveRegion="polite" accessible accessibilityLabel={text}>
      {icon}
      <Text style={[st.text, { color }]} numberOfLines={1}>{text}</Text>
    </View>
  );
});

const st = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 5, flexShrink: 1 },
  spinner: { transform: [{ scale: 0.7 }], width: 12, height: 12 },
  text: { fontSize: 12, fontFamily: FONT_FAMILY.medium },
});
