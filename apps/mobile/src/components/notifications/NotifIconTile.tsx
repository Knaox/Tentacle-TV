import { memo } from "react";
import { View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { notificationVisual, type AppNotification, type NotificationGlyph, type NotificationTone } from "@tentacle-tv/api-client";
import { useTheme } from "@/theme";

/**
 * Le glyphe partagé (`notificationVisual`, la règle de la cloche du bureau)
 * dans les icônes Feather du mobile. Feather n'a pas de sablier : l'attente
 * prend la pause, la demande garde l'horloge comme sur le bureau.
 */
const GLYPH_ICON: Record<NotificationGlyph, keyof typeof Feather.glyphMap> = {
  available: "check-circle",
  progress: "truck",
  pending: "pause-circle",
  blocked: "alert-triangle",
  declined: "slash",
  failed: "x-circle",
  ticket: "life-buoy",
  family: "users",
  watchlist: "list",
  request: "clock",
  title: "film",
  generic: "bell",
};

type Colors = ReturnType<typeof useTheme>["colors"];

/** Le ton d'une notification dans les jetons du thème (clair et sombre). */
export function tonePair(tone: NotificationTone, colors: Colors): { bg: string; fg: string } {
  switch (tone) {
    case "success": return colors.statusPairs.success;
    case "info": return colors.statusPairs.info;
    case "warning": return colors.statusPairs.warning;
    case "danger": return colors.statusPairs.error;
    default: return { bg: colors.fill.soft, fg: colors.text.tertiary };
  }
}

/** La tuile d'icône de 36 pt : teintée par l'état s'il y en a un, neutre sinon. */
export const NotifIconTile = memo(function NotifIconTile({ notif }: { notif: AppNotification }) {
  const { colors } = useTheme();
  const { glyph, tone } = notificationVisual(notif);
  const pair = tone ? tonePair(tone, colors) : { bg: colors.fill.soft, fg: colors.text.tertiary };
  return (
    <View
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={{ width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: pair.bg }}
    >
      <Feather name={GLYPH_ICON[glyph]} size={18} color={pair.fg} />
    </View>
  );
});
