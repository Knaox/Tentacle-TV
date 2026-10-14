import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import { isPickerProfileLocked, type PickedProfileDto } from "@tentacle-tv/shared";
import { useActiveProfile } from "../../auth/profileSession";
import { dropAllSessions } from "../../auth/dropSessions";
import { useToast } from "../../contexts/ToastContext";
import { useWatchTogether } from "../../watchTogether/WatchTogetherProvider";
import { usePickerListing } from "../api/usePickerListing";
import { orderedProfiles, pickerProfileOf } from "../launch/pickerModel";
import { usePickFlow } from "../pick/usePickFlow";
import { commitPick, curtainOf } from "../switch/commitPick";
import { ProfileCurtain, type CurtainProfile } from "../switch/ProfileCurtain";
import { ProfileSwitcherSection } from "./ProfileSwitcherSection";
import { SwitchPinDialog } from "./SwitchPinDialog";

/** La page de la Famille, où « Gérer les profils » mène (session personnelle seulement). */
const FAMILY_SETTINGS_PATH = "/settings/family";

export interface ProfileSwitcher {
  /** La section du menu de l'avatar ; null : rien à changer (hors du bureau, serveur
   *  sans la capacité, famille d'un seul profil, liste pas encore lue). */
  section: ReactNode | null;
  /** Le pavé du code PIN et le rideau, hors du menu (ils lui survivent). */
  overlays: ReactNode;
}

/**
 * Le CHANGEMENT RAPIDE de profil (barre du haut du bureau) : la famille lue
 * par la session personnelle, le choix d'un profil (son code PIN dans un
 * dialogue s'il en a un), puis la bascule — PiP fermé, Watch Together quitté,
 * rideau au nom du profil, rechargement. Disponible dès deux profils, que
 * « Qui regarde ? » s'ouvre au lancement ou non.
 */
export function useProfileSwitcher(onMenuClose: () => void): ProfileSwitcher {
  const { t, i18n } = useTranslation("profilePicker");
  const client = useJellyfinClient();
  const queryClient = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const { isInGroup, actions } = useWatchTogether();
  const active = useActiveProfile();
  const { listing, enabled, accountId } = usePickerListing();
  const profiles = useMemo(() => listing.data?.profiles ?? [], [listing.data]);
  const [curtain, setCurtain] = useState<CurtainProfile | null>(null);

  const leaveGroup = useCallback(() => actions.leave(), [actions]);
  const onPicked = useCallback(async (picked: PickedProfileDto) => {
    const result = await commitPick(picked, {
      onCurtain: setCurtain,
      onCurtainLifted: () => setCurtain(null),
      leaveGroup: isInGroup ? leaveGroup : undefined,
      // Comme « Changer de profil » sur la TV : le choix « Ne plus proposer sur
      // cet appareil » valait pour UN profil, jamais pour le suivant.
      stayOnDevice: false,
    });
    if (result === "stay") setCurtain(null);
  }, [isInGroup, leaveGroup]);

  const { refetch } = listing;
  const flow = usePickFlow({
    profiles,
    deviceName: client.getDeviceName(),
    onPicked,
    onStale: useCallback(() => void refetch(), [refetch]),
    // La session personnelle refusée : elle est morte, et le profil qu'elle avait ouvert avec elle.
    onAccountLost: useCallback(() => dropAllSessions(client, queryClient), [client, queryClient]),
  });

  // Un refus du serveur (profil retiré, familles coupées, serveur muet) : le
  // rideau tombé d'avance se relève, un message le dit.
  const { notice } = flow;
  useEffect(() => {
    if (!notice) return;
    setCurtain(null);
    toast.show("error", notice);
  }, [notice, toast]);
  // Un code est finalement demandé (profil protégé entre-temps) : le pavé, pas le rideau.
  const pinOpen = flow.pin !== null;
  useEffect(() => {
    if (pinOpen) setCurtain(null);
  }, [pinOpen]);

  const activeId = active?.id ?? accountId ?? "";
  const { choose } = flow;
  const onSwitch = useCallback((profileId: string) => {
    onMenuClose();
    if (profileId === activeId) return;
    // Sans code à saisir, le rideau tombe tout de suite : la réponse du serveur se fait derrière.
    const profile = profiles.find((candidate) => candidate.userId === profileId);
    if (profile && !profile.hasPin && !isPickerProfileLocked(profile, Date.now())) setCurtain(curtainOf(profile));
    choose(profileId);
  }, [onMenuClose, activeId, choose, profiles]);
  const onManage = useCallback(() => {
    onMenuClose();
    navigate(FAMILY_SETTINGS_PATH);
  }, [onMenuClose, navigate]);

  const pickerProfiles = useMemo(
    () => orderedProfiles(profiles).map((profile) => pickerProfileOf(profile, Date.now(), i18n.language, t)),
    [profiles, i18n.language, t],
  );
  const offered = enabled && (listing.data?.pickerRequired ?? false) && pickerProfiles.length >= 2;

  const section = offered ? (
    <ProfileSwitcherSection
      profiles={pickerProfiles}
      activeId={activeId}
      canManage={active === null}
      busy={flow.opening !== null}
      onSwitch={onSwitch}
      onManage={onManage}
    />
  ) : null;

  const pinProfile = flow.pin ? pickerProfileOf(flow.pin.profile, Date.now(), i18n.language, t) : null;
  const overlays = (
    <>
      {flow.pin && pinProfile && (
        <SwitchPinDialog
          pad={{ profile: pinProfile, typed: flow.pin.entry.digits.length, phase: flow.pin.entry.phase, message: flow.pin.message }}
          onDigit={flow.digit}
          onErase={flow.erase}
          onClose={flow.back}
        />
      )}
      {curtain && createPortal(<ProfileCurtain profile={curtain} phase="entering" label={t("switcher.switching")} />, document.body)}
    </>
  );

  return { section, overlays };
}
