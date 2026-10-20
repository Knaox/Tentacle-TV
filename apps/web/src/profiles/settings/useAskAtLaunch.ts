import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import {
  deviceProposes,
  launchAllowed,
  pickerStayOf,
  pickerStayState,
  withDeviceChoice,
  type PickerDeviceChoice,
  type PickerProfilesDto,
} from "@tentacle-tv/shared";
import { useActiveProfile } from "../../auth/profileSession";
import { getBackendBase } from "../../lib/backendBase";
import { pickerProfilesKey } from "../api/pickerGateway";
import { usePickerListing } from "../api/usePickerListing";
import { IN_BROWSER } from "../pickerPlatform";
import { writeLaunchMirror } from "../launch/launchState";
import { askOnThisServer, readDeviceChoiceOnThisServer, readStayOnThisServer, writeStayOnThisServer } from "../launch/stayOnDevice";

export interface AskAtLaunch {
  /** L'administration le permet (sinon : la phrase seule, sans interrupteur). */
  allowed: boolean;
  proposes: boolean;
  description: string;
  toggle: (on: boolean) => void;
}

/**
 * « Demander qui regarde à l'ouverture » — le réglage de CET ORDINATEUR (ou de
 * ce navigateur), gardé sur la machine (shared `familyPickerDevice.ts`) :
 * rallumé, le profil retenu s'efface ; éteint, le profil en cours est retenu.
 * Lu par la section de Réglages › Famille (`AskAtLaunchSection`) et par la
 * ligne du catalogue de la fenêtre étroite (`AskAtLaunchRow`). Null : rien à
 * régler (pas de famille d'au moins deux profils, session d'un profil).
 */
export function useAskAtLaunch(): AskAtLaunch | null {
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
      ? (IN_BROWSER ? t("launchSetting.onWeb") : t("launchSetting.on"))
      : stayProfile
        ? (IN_BROWSER ? t("launchSetting.stayHereWeb", { name: stayProfile.name }) : t("launchSetting.stayHere", { name: stayProfile.name }))
        : (IN_BROWSER ? t("launchSetting.offWeb") : t("launchSetting.off"));

  return { allowed, proposes, description, toggle };
}
