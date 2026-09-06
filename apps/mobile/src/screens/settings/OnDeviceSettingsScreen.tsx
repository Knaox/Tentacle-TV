import { useCallback, useState } from "react";
import { Alert, Linking, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useUserId } from "@tentacle-tv/api-client";
import { BrandSwitch, SettingsRow, SettingsSection } from "@/components/settings";
import { useOfflineList } from "@/hooks/offline/useOfflineList";
import { removeOfflineEntry } from "@/offline/engineApi";
import { setNotifyReady, useNotifyReady } from "@/offline/deviceSettings";
import { OfflineSpaceBar } from "@/offline/manage/OfflineSpaceBar";
import { setWifiOnly, useWifiOnly } from "@/offline/settings";
import { SettingsScaffold } from "@/screens/settings/SettingsScaffold";
import { ensureNotificationPermission } from "@/services/pushNotifications";
import { spacing } from "@/theme";

/**
 * Réglages « Sur cet appareil » : l'espace (jauge — les titres vivent dans
 * l'espace de l'application, aucun dossier à choisir), les transferts
 * (Wi-Fi seulement, notification « prêt »), les titres (gérer, tout retirer).
 */
export function OnDeviceSettingsScreen() {
  const { t } = useTranslation("offline");
  const { t: tc } = useTranslation("common");
  const router = useRouter();
  const userId = useUserId();
  const wifiOnly = useWifiOnly();
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
    <SettingsScaffold title={t("settingsTitle")}>
      <SettingsSection title={t("sectionSpace")} caption={t("storageHint")}>
        <View style={styles.space}><OfflineSpaceBar /></View>
      </SettingsSection>

      <SettingsSection title={t("sectionTransfers")}>
        <SettingsRow
          icon="wifi"
          label={t("wifiOnly")}
          description={t("wifiOnlyDesc")}
          trailing={<BrandSwitch value={wifiOnly} onValueChange={setWifiOnly} accessibilityLabel={t("wifiOnly")} />}
        />
        <SettingsRow
          icon="bell"
          label={t("notifyReady")}
          description={denied ? t("notifyReadyDenied") : t("notifyReadyDesc")}
          onPress={denied ? () => void Linking.openSettings() : undefined}
          last
          trailing={<BrandSwitch value={notifyReady} onValueChange={(on) => void toggleNotify(on)} accessibilityLabel={t("notifyReady")} />}
        />
      </SettingsSection>

      <SettingsSection title={t("sectionTitles")}>
        <SettingsRow icon="smartphone" label={t("manageTitles")} chevron onPress={() => router.push("/on-device")} />
        <SettingsRow icon="trash-2" label={t("removeAll")} destructive last disabled={removing || count === 0} onPress={removeAll} />
      </SettingsSection>
    </SettingsScaffold>
  );
}

const styles = StyleSheet.create({
  space: { padding: spacing.md },
});
