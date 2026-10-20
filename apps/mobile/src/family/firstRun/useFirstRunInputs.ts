import { useEffect, useState } from "react";
import {
  useFamilyOverview, useHomeLayout, useLibraries, useServerCapability, useTentacleConfig, useUserId,
} from "@tentacle-tv/api-client";
import { AVATAR_INVITE_SEEN_KEY, parseInvitedSubjects, sameUserId, shouldInviteToAvatars } from "@tentacle-tv/shared";
import { useAccountHasPhoto } from "@/auth/useAccountHasPhoto";
import { useConnectivity } from "@/offline/useConnectivity";
import { useServerUrl } from "@/providers/ServerUrlContext";
import { useFamilyPinReminder } from "../pinSuggest/useFamilyPinReminder";
import { useFamilyAvailability } from "../useFamilyAvailability";
import { useActiveProfile } from "../profiles/profileSessionState";
import { usePickerListing } from "../profiles/usePickerListing";
import { FIRST_RUN_SEEN_KEY, parseFirstRunSeen, type FirstRunInput } from "./firstRunPlan";
import { honorMobilePromptsReset } from "./promptsReset";
import { firstRunCoveredPin } from "./firstRunCovered";

/**
 * Ce que le premier lancement lit, branché sur le mobile : le profil actif, la
 * Famille (le code PIN conseillé : la règle partagée `familyPinReminder`), la
 * préférence d'accueil du compte, la photo (règle partagée `avatarInvite`) —
 * et, AVANT toute décision, la demande « Reproposer » du serveur
 * (`promptsResetAt`), honorée une fois (`honorMobilePromptsReset`).
 *
 * Une session de profil ne pose pas son code ici (le serveur réserve
 * `setOwnPin` à la session personnelle et aux TV) ; sa photo, si le serveur
 * sait l'écrire par l'appareil (`avatars.devicePhoto`).
 */
export function useFirstRunInputs(): FirstRunInput & { resetSettled: boolean } {
  const { storage } = useTentacleConfig();
  const { serverUrl } = useServerUrl();
  const subjectId = useUserId();
  const held = useActiveProfile();
  const online = useConnectivity().state === "online";
  const family = useFamilyAvailability();
  const overview = useFamilyOverview({ enabled: family.available });
  const listing = usePickerListing();
  const reminder = useFamilyPinReminder();
  const layout = useHomeLayout();
  const libraries = useLibraries();
  const hasPhoto = useAccountHasPhoto();
  const devicePhoto = useServerCapability("avatars.devicePhoto");
  const [honored, setHonored] = useState(0);

  // La demande du serveur pour CE profil : la liste de « Qui regarde ? » pendant une session
  // de profil, la Famille du compte sinon. `undefined` : pas encore su.
  const resetAt = held
    ? listing.data?.profiles.find((profile) => sameUserId(profile.userId, held.id))?.promptsResetAt
    : overview.data?.family?.profiles.find((profile) => !!subjectId && sameUserId(profile.userId, subjectId))?.promptsResetAt;
  const resetSettled = held
    ? !listing.enabled || listing.data !== undefined || listing.isError
    : !family.available || overview.data !== undefined || overview.isError;

  useEffect(() => {
    if (resetSettled && honorMobilePromptsReset(storage, serverUrl, subjectId, resetAt)) setHonored((value) => value + 1);
  }, [resetSettled, storage, serverUrl, subjectId, resetAt]);

  // Relus à chaque rendu (une poignée d'octets préchargés) : `honored` en provoque un après l'oubli.
  void honored;
  const seen = parseFirstRunSeen(storage.getItem(FIRST_RUN_SEEN_KEY));
  const invited = parseInvitedSubjects(storage.getItem(AVATAR_INVITE_SEEN_KEY));

  // Déjà proposé pendant ce lancement (« Bienvenue dans la famille ») : pas une seconde fois.
  const pinDue = held || firstRunCoveredPin() ? false : !family.available ? false : reminder.settled ? reminder.startup : null;
  const homeReady = layout.data && libraries.data ? true : layout.isError || libraries.isError ? false : null;
  const canChangePhoto = !held || devicePhoto;
  const photoDue = hasPhoto === undefined
    ? null
    : shouldInviteToAvatars({ eligible: true, subjectId, canChangePhoto, online, hasPhoto, busy: false, invited });

  return { subjectId, serverUrl, online, seen, pinDue, homeReady, photoDue, resetSettled };
}
