import { useCallback, useState } from "react";
import { Alert, Linking, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useUserId } from "@tentacle-tv/api-client";
import { BrandSwitch, SettingsRow, SettingsSection } from "@/components/settings";
import { useOfflineList } from "@/hooks/offline/useOfflineList";
import { removeOfflineEntry } from "@/offline/engineApi";
import { setNotifyReady, useNotifyReady } from "@/offline/deviceSettings";
import { OfflineSpaceBar } from "@/offline/manage/OfflineSpaceBar";
import { setBackgroundTransfers, setWifiOnly, useBackgroundTransfers, useWifiOnly } from "@/offline/settings";
import { ensureNotificationPermission } from "@/services/pushNotifications";
import { spacing } from "@/theme";

/**
 * Les réglages hors ligne, tous de CET appareil : l'espace (jauge — les titres
 * vivent dans l'espace de l'application, aucun dossier à choisir), les
 * transferts (Wi-Fi seulement, continuer en arrière-plan, notification
 * « prêt »), « Tout retirer ». Un bloc de la rubrique « Hors ligne », sous
 * « Mes titres hors ligne » (qui mène à leur gestion) : comportement d'avant.
 */
export function OnDeviceSettingsPane() {
  const { t } = useTranslation("offline");
  const { t: tc } = useTranslation("common");
  const userId = useUserId();
  const wifiOnly = useWifiOnly();
  const background = useBackgroundTransfers();
  const notifyReady = useNotifyReady();
  const [denied, setDenied] = useState(false);
  const [removing, setRemoving] = useState(false);
  const { data: entries } = useOfflineList(userId);
  const count = entries?.length ?? 0;

  // Activer la notification demande la permission ; refusée, le réglage
  // retombe et la ligne mène aux réglages du téléphone.
  const toggleNotify = useCallback(async (on: boolean) => {
    if (!on) {
      setNotifyReady(false);
      return;
    }
    const granted = await ensureNotificationPermission();
    setDenied(!granted);
    setNotifyReady(granted);
  }, []);

  const removeAll = useCallback(() => {
    if (userId === null || count === 0) return;
    Alert.alert(t("removeAllConfirmTitle"), t("removeAllConfirmMessage"), [
      { text: tc("cancel"), style: "cancel" },
      {
        text: t("removeAll"),
        style: "destructive",
        onPress: () => {
          setRemoving(true);
          void (async () => {
            for (const entry of entries ?? []) await removeOfflineEntry(userId, entry.id);
          })().finally(() => setRemoving(false));
        },
      },
    ]);
  }, [userId, count, entries, t, tc]);

  return (
    <>
      <SettingsSection title={t("sectionSpace")} caption={t("storageHint")}>
        <View style={styles.space}><OfflineSpaceBar /></View>
      </SettingsSection>

      <SettingsSection title={t("sectionTransfers")}>
        <SettingsRow
          icon="wifi"
          label={t("wifiOnly")}
          description={t("wifiOnlyDesc")}
          scope="device"
          trailing={<BrandSwitch value={wifiOnly} onValueChange={setWifiOnly} accessibilityLabel={t("wifiOnly")} />}
        />
        <SettingsRow
          icon="moon"
          label={t("backgroundTransfers")}
          description={t("backgroundTransfersDesc")}
          scope="device"
          trailing={<BrandSwitch value={background} onValueChange={setBackgroundTransfers} accessibilityLabel={t("backgroundTransfers")} />}
        />
        <SettingsRow
          icon="bell"
          label={t("notifyReady")}
          description={denied ? t("notifyReadyDenied") : t("notifyReadyDesc")}
          scope="device"
          onPress={denied ? () => void Linking.openSettings() : undefined}
          last
          trailing={<BrandSwitch value={notifyReady} onValueChange={(on) => void toggleNotify(on)} accessibilityLabel={t("notifyReady")} />}
        />
      </SettingsSection>

      <SettingsSection title={t("sectionTitles")}>
        <SettingsRow icon="trash-2" label={t("removeAll")} destructive last disabled={removing || count === 0} onPress={removeAll} />
      </SettingsSection>
    </>
  );
}

const styles = StyleSheet.create({
  space: { padding: spacing.md },
});
