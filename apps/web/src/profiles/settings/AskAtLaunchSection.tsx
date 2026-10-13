import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MonitorPlay } from "lucide-react";
import { SettingsRow, SettingsSection } from "@tentacle-tv/ui";
import type { PickerProfilesDto } from "@tentacle-tv/shared";
import { ToggleSwitch } from "../../components/settings/ToggleSwitch";
import { useActiveProfile } from "../../auth/profileSession";
import { getBackendBase } from "../../lib/backendBase";
import { pickerProfilesKey, savePickerPreference } from "../api/pickerGateway";
import { usePickerListing } from "../api/usePickerListing";
import { writeLaunchMirror } from "../launch/launchState";

/**
 * Réglages › Famille, sur le BUREAU : « Demander qui regarde à l'ouverture ».
 * Une préférence du COMPTE, par plateforme, lue et écrite par le serveur :
 * activée ici, elle vaut pour tous les ordinateurs du compte. Désactivée par
 * défaut. Absente hors du bureau, face à un serveur sans la capacité
 * `family.desktopProfiles`, sans famille d'au moins deux profils, et pendant
 * la session d'un profil (la page de la Famille n'y existe pas).
 *
 * L'interrupteur répond tout de suite (écriture optimiste), le serveur
 * confirme ; un refus le remet en place et le dit.
 */
export function AskAtLaunchSection() {
  const { t } = useTranslation("profilePicker");
  const queryClient = useQueryClient();
  const profileSession = useActiveProfile() !== null;
  const { listing, accountId } = usePickerListing();
  const [failed, setFailed] = useState(false);
  const key = pickerProfilesKey(accountId);

  const remember = useCallback((next: PickerProfilesDto) => {
    queryClient.setQueryData(key, next);
    if (accountId) writeLaunchMirror({ server: getBackendBase(), accountId, capable: true, listing: next });
  }, [queryClient, key, accountId]);

  const save = useMutation({
    mutationFn: (atLaunch: boolean) => savePickerPreference(atLaunch),
    onMutate: (atLaunch) => {
      setFailed(false);
      const previous = queryClient.getQueryData<PickerProfilesDto>(key);
      if (previous) remember({ ...previous, atLaunch });
      return { previous };
    },
    onSuccess: (preference) => {
      const current = queryClient.getQueryData<PickerProfilesDto>(key);
      if (current) remember({ ...current, atLaunch: preference.atLaunch.desktop === true });
    },
    onError: (_error, _atLaunch, context) => {
      if (context?.previous) remember(context.previous);
      setFailed(true);
    },
  });

  const data = listing.data;
  if (profileSession || !data?.pickerRequired) return null;

  return (
    <SettingsSection title={t("launchSetting.section")} caption={failed ? undefined : t("launchSetting.caption")}>
      <SettingsRow
        icon={<MonitorPlay size={17} />}
        label={t("launchSetting.title")}
        description={data.atLaunch ? t("launchSetting.on") : t("launchSetting.off")}
        trailing={
          <ToggleSwitch
            checked={data.atLaunch}
            onChange={(next) => save.mutate(next)}
            label={t("launchSetting.title")}
            disabled={save.isPending}
          />
        }
        last
      />
      {failed && (
        <p role="alert" className="border-t border-line-subtle px-4 py-3 text-xs text-status-error-fg">
          {t("launchSetting.failed")}
        </p>
      )}
    </SettingsSection>
  );
}
