import { useCallback, useState } from "react";
import { Alert, Linking, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useUserId } from "@tentacle-tv/api-client";
import { useOfflineList } from "@/hooks/offline/useOfflineList";
import { removeOfflineEntry } from "@/offline/engineApi";
import { setNotifyReady, useNotifyReady } from "@/offline/deviceSettings";
import { OfflineSpaceBar } from "@/offline/manage/OfflineSpaceBar";
import { setBackgroundTransfers, setWifiOnly, useBackgroundTransfers, useWifiOnly } from "@/offline/settings";
import { useLiveTransfersSetting } from "@/screens/profile/offlineEntryHooks";
import { ensureNotificationPermission } from "@/services/pushNotifications";
import { spacing } from "@/theme";
import { BrandSwitch } from "../BrandSwitch";
import type { SettingScope } from "../ScopeBadge";
import { SettingsRow } from "../SettingsRow";
import { SettingsSection } from "../SettingsSection";
import { SwitchSettingRow } from "./SettingRowKit";

interface RowProps {
  scope: SettingScope | null;
  last?: boolean;
}

/**
 * Les réglages HORS LIGNE du mobile, tous de CET appareil, un composant par
 * entrée du catalogue (rubrique « Hors ligne ») — le comportement de l'ancien
 * écran « Réglages hors ligne », découpé.
 */

/** L'espace : la jauge (les titres vivent dans l'espace de l'application, aucun dossier à choisir). */
export function OfflineSpaceBlock() {
  const { t } = useTranslation("offline");
  return (
    <SettingsSection title={t("sectionSpace")} caption={t("storageHint")}>
      <View style={styles.space}><OfflineSpaceBar /></View>
    </SettingsSection>
  );
}

export function WifiOnlyRow({ scope, last }: RowProps) {
  const { t } = useTranslation("offline");
  const value = useWifiOnly();
  return <SwitchSettingRow icon="wifi" label={t("wifiOnly")} description={t("wifiOnlyDesc")} scope={scope} value={value} onChange={setWifiOnly} last={last} />;
}

export function BackgroundTransfersRow({ scope, last }: RowProps) {
  const { t } = useTranslation("offline");
  const value = useBackgroundTransfers();
  return (
    <SwitchSettingRow
      icon="moon" label={t("backgroundTransfers")} description={t("backgroundTransfersDesc")}
      scope={scope} value={value} onChange={setBackgroundTransfers} last={last}
    />
  );
}

/** « Me prévenir quand un titre est prêt » : l'allumer demande la permission ; refusée, la ligne mène aux réglages du téléphone. */
export function NotifyReadyRow({ scope, last }: RowProps) {
  const { t } = useTranslation("offline");
  const value = useNotifyReady();
  const [denied, setDenied] = useState(false);
  const toggle = useCallback(async (on: boolean) => {
    if (!on) {
      setNotifyReady(false);
      return;
    }
    const granted = await ensureNotificationPermission();
    setDenied(!granted);
    setNotifyReady(granted);
  }, []);
  return (
    <SettingsRow
      icon="bell"
      label={t("notifyReady")}
      description={denied ? t("notifyReadyDenied") : t("notifyReadyDesc")}
      scope={scope ?? undefined}
      onPress={denied ? () => void Linking.openSettings() : undefined}
      last={last}
      trailing={<BrandSwitch value={value} onValueChange={(on) => void toggle(on)} accessibilityLabel={t("notifyReady")} />}
    />
  );
}

/** « Suivi en direct » : le temps restant sur l'écran verrouillé pendant un transfert (adaptateur, branché à la fusion). */
export function LiveTransfersRow({ scope, last }: RowProps) {
  const { t } = useTranslation("settingsMobile");
  const { available, enabled, setEnabled } = useLiveTransfersSetting();
  if (!available) return null;
  return (
    <SwitchSettingRow
      icon="activity" label={t("offline.liveTransfers")} description={t("offline.liveTransfersHint")}
      scope={scope} value={enabled} onChange={setEnabled} last={last}
    />
  );
}

/** « Tout retirer de l'appareil », confirmé : les titres gardés partent, un par un. */
export function RemoveAllOfflineRow({ last }: { last?: boolean }) {
  const { t } = useTranslation(["offline", "common"]);
  const userId = useUserId();
  const { data: entries } = useOfflineList(userId);
  const [removing, setRemoving] = useState(false);
  const count = entries?.length ?? 0;
  const removeAll = useCallback(() => {
    if (userId === null || count === 0) return;
    Alert.alert(t("removeAllConfirmTitle"), t("removeAllConfirmMessage"), [
      { text: t("common:cancel"), style: "cancel" },
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
  }, [userId, count, entries, t]);
  return <SettingsRow icon="trash-2" label={t("removeAll")} destructive last={last} disabled={removing || count === 0} onPress={removeAll} />;
}

const styles = StyleSheet.create({
  space: { padding: spacing.md },
});
