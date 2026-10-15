import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { MonitorPlay } from "lucide-react";
import { SettingsRow, SettingsSection } from "@tentacle-tv/ui";
import {
  deviceProposes,
  launchAllowed,
  pickerStayOf,
  pickerStayState,
  withDeviceChoice,
  type PickerDeviceChoice,
  type PickerProfilesDto,
} from "@tentacle-tv/shared";
import { ToggleSwitch } from "../../components/settings/ToggleSwitch";
import { useActiveProfile } from "../../auth/profileSession";
import { getBackendBase } from "../../lib/backendBase";
import { pickerProfilesKey } from "../api/pickerGateway";
import { usePickerListing } from "../api/usePickerListing";
import { writeLaunchMirror } from "../launch/launchState";
import { askOnThisServer, readDeviceChoiceOnThisServer, readStayOnThisServer, writeStayOnThisServer } from "../launch/stayOnDevice";

/**
 * Réglages › Famille, sur le BUREAU : « Demander qui regarde à l'ouverture »
 * — le réglage de CET ORDINATEUR (gardé sur la machine, shared
 * `familyPickerDevice.ts`), jumeau de la case « Ne plus proposer à la
 * prochaine ouverture » de « Qui regarde ? » : cocher la case l'éteint, le
 * rallumer efface le profil retenu, l'éteindre retient le profil en cours.
 * Un autre ordinateur du compte garde le sien. Coupé par l'administration :
 * la ligne le dit, sans interrupteur.
 *
 * Absente hors du bureau, face à un serveur sans `family.desktopProfiles`,
 * sans famille d'au moins deux profils, et pendant la session d'un profil (la
 * page de la Famille n'y existe pas).
 */
export function AskAtLaunchSection() {
  const { t } = useTranslation("profilePicker");
  const queryClient = useQueryClient();
  const profileSession = useActiveProfile() !== null;
  const { listing, accountId } = usePickerListing();
  const [choice, setChoice] = useState<PickerDeviceChoice>(() => readDeviceChoiceOnThisServer(accountId));
  const [stay, setStay] = useState(() => readStayOnThisServer(accountId));
  const key = pickerProfilesKey(accountId);

  const apply = useCallback((next: PickerDeviceChoice, current: PickerProfilesDto) => {
    setChoice(next);
    setStay(readStayOnThisServer(accountId));
    const updated = withDeviceChoice(current, next);
    queryClient.setQueryData(key, updated);
    if (accountId) writeLaunchMirror({ server: getBackendBase(), accountId, capable: true, listing: updated });
  }, [queryClient, key, accountId]);

  const data = listing.data;
  if (profileSession || !data?.pickerRequired || !accountId) return null;
  const allowed = launchAllowed(data);
  const proposes = deviceProposes(data, choice);
  const stayProfile = choice === "stay" && stay && pickerStayState(data, stay, Date.now()) !== "stale"
    ? data.profiles.find((profile) => profile.userId === stay.profileId) ?? null
    : null;
  const toggle = (on: boolean) => {
    if (on) {
      askOnThisServer(accountId);
      apply("ask", data);
      return;
    }
    // Éteint : l'ordinateur retient le profil en cours (session personnelle ou session de profil).
    const current = data.profiles.find((profile) => profile.userId === data.currentProfileId);
    if (!current) return;
    writeStayOnThisServer(accountId, pickerStayOf(current));
    apply("stay", data);
  };
  const description = !allowed
    ? t("launchSetting.adminOff")
    : proposes
      ? t("launchSetting.on")
      : stayProfile
        ? t("launchSetting.stayHere", { name: stayProfile.name })
        : t("launchSetting.off");

  return (
    <SettingsSection title={t("launchSetting.title")} caption={t("launchSetting.caption")}>
      <SettingsRow
        icon={<MonitorPlay size={17} />}
        label={t("launchSetting.section")}
        description={description}
        trailing={allowed ? <ToggleSwitch checked={proposes} onChange={toggle} label={t("launchSetting.title")} /> : undefined}
        last
      />
    </SettingsSection>
  );
}
