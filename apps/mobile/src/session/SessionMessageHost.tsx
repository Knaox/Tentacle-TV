import { memo, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AccessibilityInfo, Platform, StyleSheet, View } from "react-native";
import Animated, { FadeInUp, FadeOutUp, LinearTransition } from "react-native-reanimated";
import { FullWindowOverlay } from "react-native-screens";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import { onSessionMessage, type SessionMessage } from "@tentacle-tv/api-client";
import { SHEET_MAX_WIDTH, spacing } from "@/theme";
import { MessageBanner } from "./MessageBanner";
import { useMessageCountdown } from "./useMessageCountdown";

/**
 * Les messages que l'administrateur envoie à cet appareil — depuis le tableau
 * de bord de Jellyfin (`DisplayMessage`) ou celui de Tentacle, web comme
 * mobile. Monté une fois, à la racine : ils arrivent aussi en pleine lecture.
 *
 * Sur iOS, le lecteur est une modale plein écran NATIVE, au-dessus de toute la
 * hiérarchie React de la racine : le bandeau passe par une `FullWindowOverlay`
 * (react-native-screens), posée seulement quand un message est là — elle ne
 * laisse passer aucun geste de plus que la place des bandeaux. Sur Android,
 * la modale vit dans la même fenêtre : une vue posée après la pile suffit.
 *
 * Mêmes règles que le web : avec un délai, le message s'efface seul (borné à
 * 3–60 s) et le DIT — compte à rebours et barre qui se vide, suspendus tant
 * que le doigt le tient ou que l'app est en arrière-plan ; sans délai, il
 * reste jusqu'à ce qu'on le ferme. Trois au plus, les plus anciens cèdent.
 */

const MIN_TIMEOUT_MS = 3_000;
const MAX_TIMEOUT_MS = 60_000;
const MAX_VISIBLE = 3;

interface Shown extends SessionMessage {
  id: number;
  durationMs: number | null;
}

export function SessionMessageHost() {
  const { t } = useTranslation("sessions");
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Shown[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => {
    setMessages((current) => current.filter((m) => m.id !== id));
  }, []);

  useEffect(() => onSessionMessage((message) => {
    seq.current += 1;
    const id = seq.current;
    const durationMs = message.timeoutMs === undefined
      ? null
      : Math.min(Math.max(message.timeoutMs, MIN_TIMEOUT_MS), MAX_TIMEOUT_MS);
    setMessages((current) => [...current, { ...message, id, durationMs }].slice(-MAX_VISIBLE));
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    AccessibilityInfo.announceForAccessibility([t("messageFrom"), message.header, message.text].filter(Boolean).join(". "));
  }), [t]);

  if (messages.length === 0) return null;

  const stack = (
    <View pointerEvents="box-none" style={[st.stack, { top: Math.max(insets.top, 12) + spacing.sm }]}>
      {messages.map((message) => (
        <Banner key={message.id} message={message} onDismiss={dismiss} />
      ))}
    </View>
  );
  return <Overlay>{stack}</Overlay>;
}

/** Au-dessus de tout : la fenêtre entière sur iOS, la racine ailleurs. */
function Overlay({ children }: { children: ReactNode }) {
  if (Platform.OS === "ios") return <FullWindowOverlay>{children}</FullWindowOverlay>;
  return <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, st.androidLayer]}>{children}</View>;
}

const Banner = memo(function Banner({ message, onDismiss }: { message: Shown; onDismiss: (id: number) => void }) {
  const [held, setHeld] = useState(false);
  const { id } = message;
  const countdown = useMessageCountdown(message.durationMs, held, () => onDismiss(id));
  return (
    <Animated.View
      entering={FadeInUp.duration(220)}
      exiting={FadeOutUp.duration(140)}
      layout={LinearTransition.duration(200)}
      style={st.item}
    >
      <MessageBanner
        header={message.header}
        text={message.text}
        countdown={countdown}
        durationMs={message.durationMs}
        onHold={setHeld}
        onDismiss={() => onDismiss(id)}
      />
    </Animated.View>
  );
});

const st = StyleSheet.create({
  stack: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    alignItems: "center",
    gap: spacing.sm,
  },
  item: { width: "100%", maxWidth: SHEET_MAX_WIDTH },
  androidLayer: { zIndex: 100, elevation: 24 },
});
