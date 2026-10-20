import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import type { NotificationFilter } from "@tentacle-tv/api-client";
import { PlainButton } from "@/components/ui/buttons";
import { typography, useTheme } from "@/theme";

/**
 * L'état vide du centre : celui du bureau (une cloche sur un aplat de
 * marque, deux lignes) quand il n'y a rien ; « Tout est lu » et « Tout
 * afficher » quand le filtre des non lues ne laisse rien.
 */
export function NotifEmptyState({ filter, onShowAll }: { filter: NotificationFilter; onShowAll: () => void }) {
  const { t } = useTranslation("notifications");
  const { colors } = useTheme();
  const unreadOnly = filter === "unread";
  return (
    <View style={{ alignItems: "center", marginTop: 48, paddingHorizontal: 32 }}>
      <View style={{ width: 64, height: 64, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.brand.soft, marginBottom: 18 }}>
        <Feather name={unreadOnly ? "check-circle" : "bell"} size={26} color={colors.brand.light} />
      </View>
      <Text style={{ ...typography.body, color: colors.text.primary, fontWeight: "700", textAlign: "center" }}>
        {unreadOnly ? t("emptyUnreadTitle") : t("emptyTitle")}
      </Text>
      <Text style={{ ...typography.caption, color: colors.text.tertiary, textAlign: "center", marginTop: 6, lineHeight: 18 }}>
        {unreadOnly ? t("emptyUnreadHint") : t("emptyHint")}
      </Text>
      {unreadOnly && (
        <View style={{ marginTop: 14 }}>
          <PlainButton size="sm" tone="accent" label={t("showAll")} onPress={onShowAll} />
        </View>
      )}
    </View>
  );
}
