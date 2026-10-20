import { useEffect, useState } from "react";
import { useFamilyOverview, useUserId } from "@tentacle-tv/api-client";
import {
  FIRST_RUN_SEEN_KEY, firstRunPinDue, honorFirstRunPromptsReset, promptsResetPending, parseFirstRunSeen, sameUserId, shouldInviteToAvatars, type FirstRunInput,
} from "@tentacle-tv/shared";
import { useActiveProfile } from "../../auth/profileSession";
import { useHomeRowsEditorModel } from "../../components/settings/personalization/useHomeRowsEditorModel";
import { useFamilyAvailability } from "../../family/useFamilyAvailability";
import { useFamilyPinReminder } from "../../family/pinSuggest/useFamilyPinReminder";
import { useAvatarUpload } from "../../hooks/useAvatarUpload";
import { getBackendBase } from "../../lib/backendBase";
import { useConnectivity } from "../../offline/useConnectivity";
import { readInvitedSubjects } from "../../profiles/avatarGallery/inviteRule";
import { useGuestSessionPhoto } from "../../profiles/avatarGallery/useGuestSessionPhoto";

function readSeen(): string[] {
  try {
    return parseFirstRunSeen(localStorage.getItem(FIRST_RUN_SEEN_KEY));
  } catch {
    return [];
  }
}

/**
 * Ce que le premier lancement du web étroit lit — le jumeau de
 * `useFirstRunInputs` du mobile, sur les crochets du web : le sujet (le
 * compte, ou le profil de la session de profil), la Famille (code PIN
 * conseillé, règle partagée `familyPinReminder`), la préférence d'accueil du
 * compte, la photo (règle partagée `avatarInvite`) — et, AVANT toute
 * décision, « Reproposer » du serveur (`honorFirstRunPromptsReset`).
 *
 * Une session de profil ne pose pas son code ici (le serveur réserve
 * `setOwnPin` à la session personnelle) ; sa photo, si l'appareil peut
 * habiller ce profil (`useGuestSessionPhoto`).
 */
export function useWebFirstRunInputs(): FirstRunInput & { resetSettled: boolean } {
  const userId = useUserId();
  const held = useActiveProfile();
  const online = useConnectivity().state === "online";
  const family = useFamilyAvailability();
  const overview = useFamilyOverview({ enabled: family.available && !held });
  const reminder = useFamilyPinReminder();
  const home = useHomeRowsEditorModel();
  const { hasPhoto: accountHasPhoto } = useAvatarUpload();
  const guestTarget = useGuestSessionPhoto();
  // Le sujet dont « Reproposer » a été honoré pendant ce lancement : son code PIN revient, même passé hier.
  const [honored, setHonored] = useState<string | null>(null);

  const subjectId = held ? held.id : userId;
  const serverUrl = getBackendBase() || window.location.origin;
  // La demande « Reproposer » pour CE sujet : la Famille du compte en session personnelle ; un
  // profil choisi l'a honorée au choix (comme l'invitation aux avatars du bureau).
  const resetAt = held ? undefined : overview.data?.family?.profiles.find((p) => !!userId && sameUserId(p.userId, userId))?.promptsResetAt;
  const resetSettled = !!held || !family.available || overview.data !== undefined || overview.isError;

  useEffect(() => {
    if (resetSettled && honorFirstRunPromptsReset(localStorage, serverUrl, subjectId, resetAt)) setHonored(subjectId);
  }, [resetSettled, serverUrl, subjectId, resetAt]);

  // Relus à chaque rendu (quelques octets) : `honored` en provoque un après l'oubli.
  const hasPhoto = held ? held.imageTag !== null : accountHasPhoto;
  const pinDue = firstRunPinDue({
    profileSession: !!held, familyAvailable: family.available, reminder, resetHonored: !!subjectId && honored === subjectId,
  });
  const homeReady = home.ready ? true : home.failed ? false : null;
  const photoDue = hasPhoto === undefined
    ? null
    : shouldInviteToAvatars({
      eligible: true,
      subjectId,
      canChangePhoto: held ? guestTarget !== null : true,
      online,
      hasPhoto,
      busy: false,
      invited: readInvitedSubjects(),
    });

  // Une demande pas encore honorée : rien ne se décide avant (sinon sur les « Plus tard » d'avant).
  const resetHonoredHere = resetSettled && !promptsResetPending(localStorage, subjectId, resetAt);
  return { subjectId, serverUrl, online, seen: readSeen(), pinDue, homeReady, photoDue, resetSettled: resetHonoredHere };
}
