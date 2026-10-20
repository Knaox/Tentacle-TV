import { Alert } from "react-native";
import { useTranslation } from "react-i18next";
import { useMyPairedDevices, useRevokeMyDevice } from "@tentacle-tv/api-client";
import { SettingsRow, SettingsSection } from "@/components/settings";
import { Skeleton } from "@/components/ui";
import { PlainButton } from "@/components/ui/buttons";

/**
 * Les appareils jumelés au compte — le jumelage, lui, est au-dessus
 * (`PairTvSection`) : une ligne par appareil (nom, dernière activité) et sa
 * révocation, confirmée, parce qu'il faudrait refaire le jumelage devant la
 * TV pour revenir en arrière.
 */
export function PairedDevicesSection() {
  const { t } = useTranslation("pairing");
  const { data: devices, isLoading, isError } = useMyPairedDevices();
  const revokeMut = useRevokeMyDevice();

  const confirmRevoke = (id: string, name: string) => {
    Alert.alert(name, t("revokeConfirm"), [
      { text: t("cancel"), style: "cancel" },
      { text: t("revoke"), style: "destructive", onPress: () => revokeMut.mutate(id) },
    ]);
  };

  return (
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
              <PlainButton
                tone="destructive"
                size="sm"
                label={t("revoke")}
                accessibilityLabel={`${t("revoke")} : ${device.name}`}
                onPress={() => confirmRevoke(device.id, device.name)}
                disabled={revokeMut.isPending}
              />
            }
          />
        ))
      )}
    </SettingsSection>
  );
}
