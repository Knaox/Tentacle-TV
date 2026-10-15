import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { notificationStateMeta, type AppNotification, type NotificationTone } from "@tentacle-tv/api-client";
import { useTheme } from "@/theme";

/**
 * La pastille d'état d'une notification (même table que la cloche du web :
 * un mot sur un aplat du ton, jamais la couleur seule). Rien sans état.
 */
export function NotifStateBadgeMobile({ state }: { state: AppNotification["state"] }) {
  const { t } = useTranslation("notifications");
  const { colors } = useTheme();
  const meta = notificationStateMeta(state);
  if (!meta) return null;
  const pair = pairOf(meta.tone, colors);
  return (
    <View style={{ alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: pair.bg }}>
      <Text style={{ fontSize: 11, fontWeight: "700", color: pair.fg }}>{t(meta.labelKey)}</Text>
    </View>
  );
}

type Colors = ReturnType<typeof useTheme>["colors"];

function pairOf(tone: NotificationTone, colors: Colors): { bg: string; fg: string } {
  switch (tone) {
    case "success": return colors.statusPairs.success;
    case "info": return colors.statusPairs.info;
    case "warning": return colors.statusPairs.warning;
    case "danger": return colors.statusPairs.error;
    default: return { bg: colors.fill.soft, fg: colors.text.tertiary };
  }
}
