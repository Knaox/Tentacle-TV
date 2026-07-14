import { View, Text, Pressable } from "react-native";
import { useTranslation } from "react-i18next";
import { useMyPairedDevices, useRevokeMyDevice } from "@tentacle-tv/api-client";
import { spacing, typography, useTheme } from "../../theme";
import { GlassCard } from "../ui";

export function PairedDevicesSection() {
  const { t } = useTranslation("pairing");
  const theme = useTheme();
  const { data: devices, isLoading } = useMyPairedDevices();
  const revokeMut = useRevokeMyDevice();

  // État vide explicite (écran dédié) : ne pas laisser un écran blanc quand
  // aucun appareil n'est jumelé. Le titre est fourni par l'écran parent.
  if (!isLoading && (!devices || devices.length === 0)) {
    return (
      <View style={{ marginBottom: spacing.xxl }}>
        <Text style={{ ...typography.body, color: theme.colors.text.tertiary, textAlign: "center", paddingVertical: spacing.xl }}>
          {t("noPairedDevices")}
        </Text>
      </View>
    );
  }

  if (!devices) return null;

  return (
    <View style={{ marginBottom: spacing.xxl }}>
      {devices.map((device) => (
        <GlassCard key={device.id} style={{ marginBottom: spacing.sm }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flex: 1 }}>
              <Text style={{ ...typography.bodyBold, color: theme.colors.text.primary }}>{device.name}</Text>
              <Text style={{ ...typography.small, color: theme.colors.text.tertiary, marginTop: spacing.xs }}>
                {t("lastActive", { date: new Date(device.lastSeen).toLocaleDateString() })}
              </Text>
            </View>
            <Pressable
              onPress={() => revokeMut.mutate(device.id)}
              disabled={revokeMut.isPending}
              style={{
                backgroundColor: theme.colors.danger.surface, borderRadius: spacing.buttonRadius,
                paddingVertical: 6, paddingHorizontal: spacing.md,
                opacity: revokeMut.isPending ? 0.4 : 1,
              }}
            >
              <Text style={{ color: theme.colors.status.error, ...typography.caption, fontWeight: "600" }}>
                {t("revoke")}
              </Text>
            </Pressable>
          </View>
        </GlassCard>
      ))}
    </View>
  );
}
