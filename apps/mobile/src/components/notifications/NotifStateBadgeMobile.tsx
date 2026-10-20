import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { notificationStateMeta, type AppNotification } from "@tentacle-tv/api-client";
import { useTheme } from "@/theme";
import { tonePair } from "./NotifIconTile";

/**
 * La pastille d'état d'une notification (même table que la cloche du web :
 * un mot sur un aplat du ton, jamais la couleur seule). Rien sans état.
 */
export function NotifStateBadgeMobile({ state }: { state: AppNotification["state"] }) {
  const { t } = useTranslation("notifications");
  const { colors } = useTheme();
  const meta = notificationStateMeta(state);
  if (!meta) return null;
  const pair = tonePair(meta.tone, colors);
  return (
    <View style={{ alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: pair.bg }}>
      <Text style={{ fontSize: 11, fontWeight: "700", color: pair.fg }}>{t(meta.labelKey)}</Text>
    </View>
  );
}
