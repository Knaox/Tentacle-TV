import { View, Text, Pressable } from "react-native";
import { useTranslation } from "react-i18next";
import { useMyPairedDevices, useRevokeMyDevice } from "@tentacle-tv/api-client";
import { colors, spacing, typography } from "../../theme";
import { GlassCard } from "../ui";

export function PairedDevicesSection() {
  const { t } = useTranslation("pairing");
  const { data: devices } = useMyPairedDevices();
  const revokeMut = useRevokeMyDevice();

  if (!devices || devices.length === 0) return null;

  return (
    <View style={{ marginBottom: spacing.xxl }}>
      <Text style={{ ...typography.subtitle, color: colors.textPrimary, marginBottom: spacing.md }}>
        {t("pairedDevices")}
      </Text>
      {devices.map((device) => (
        <GlassCard key={device.id} style={{ marginBottom: spacing.sm }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flex: 1 }}>
              <Text style={{ ...typography.bodyBold, color: colors.textPrimary }}>{device.name}</Text>
              <Text style={{ ...typography.small, color: colors.textMuted, marginTop: spacing.xs }}>
                {t("lastActive", { date: new Date(device.lastSeen).toLocaleDateString() })}
              </Text>
            </View>
            <Pressable
              onPress={() => revokeMut.mutate(device.id)}
              disabled={revokeMut.isPending}
              style={{
                backgroundColor: colors.dangerSurface, borderRadius: spacing.buttonRadius,
                paddingVertical: 6, paddingHorizontal: spacing.md,
                opacity: revokeMut.isPending ? 0.4 : 1,
              }}
            >
              <Text style={{ color: colors.danger, ...typography.caption, fontWeight: "600" }}>
                {t("revoke")}
              </Text>
            </Pressable>
          </View>
        </GlassCard>
      ))}
    </View>
  );
}
