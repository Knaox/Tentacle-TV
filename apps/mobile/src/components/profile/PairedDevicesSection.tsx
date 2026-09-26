import { Alert, Pressable, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useMyPairedDevices, useRevokeMyDevice } from "@tentacle-tv/api-client";
import { SettingsRow, SettingsSection } from "@/components/settings";
import { Skeleton } from "@/components/ui";
import { spacing, typography, FONT_FAMILY, useThemedStyles, type AppTheme } from "@/theme";

/**
 * Les appareils jumelés au compte : jumeler une TV en tête, puis une ligne
 * par appareil (nom, dernière activité) et sa révocation — confirmée, parce
 * qu'il faudrait refaire le jumelage devant la TV pour revenir en arrière.
 */
export function PairedDevicesSection() {
  const { t } = useTranslation("pairing");
  const { t: tp } = useTranslation("profile");
  const router = useRouter();
  const st = useThemedStyles(makeStyles);
  const { data: devices, isLoading, isError } = useMyPairedDevices();
  const revokeMut = useRevokeMyDevice();

  const confirmRevoke = (id: string, name: string) => {
    Alert.alert(name, t("revokeConfirm"), [
      { text: t("cancel"), style: "cancel" },
      { text: t("revoke"), style: "destructive", onPress: () => revokeMut.mutate(id) },
    ]);
  };

  return (
    <>
      <SettingsSection>
        <SettingsRow icon="cast" label={tp("pairTV")} accent chevron last onPress={() => router.push("/pair-tv")} />
      </SettingsSection>

      <SettingsSection title={t("pairedDevices")}>
        {isLoading ? (
          <Skeleton width="100%" height={104} radius={0} />
        ) : isError ? (
          <SettingsRow icon="alert-circle" label={t("devicesLoadError")} last />
        ) : !devices || devices.length === 0 ? (
          <SettingsRow icon="info" label={t("noPairedDevices")} last />
        ) : (
          devices.map((device, index) => (
            <SettingsRow
              key={device.id}
              icon="tv"
              label={device.name}
              description={t("lastActive", { date: new Date(device.lastSeen).toLocaleDateString() })}
              last={index === devices.length - 1}
              trailing={
                <Pressable
                  onPress={() => confirmRevoke(device.id, device.name)}
                  disabled={revokeMut.isPending}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`${t("revoke")} : ${device.name}`}
                  style={({ pressed }) => [st.revoke, (pressed || revokeMut.isPending) && st.revokeDim]}
                >
                  <Text style={st.revokeText}>{t("revoke")}</Text>
                </Pressable>
              }
            />
          ))
        )}
      </SettingsSection>
    </>
  );
}

const makeStyles = (t: AppTheme) => StyleSheet.create({
  revoke: { minHeight: 36, justifyContent: "center" as const, paddingHorizontal: spacing.sm },
  revokeDim: { opacity: 0.5 },
  revokeText: { ...typography.small, fontFamily: FONT_FAMILY.semibold, color: t.colors.status.error },
});
