import { useEffect, useState } from "react";
import {
  useFamilyOverview, useHomeLayout, useLibraries, useTentacleConfig,
} from "@tentacle-tv/api-client";
import {
  FIRST_RUN_SEEN_KEY, firstRunPinDue, honorFirstRunPromptsReset, promptsResetPending, parseFirstRunSeen, sameUserId,
  shouldInviteToAvatars, type FirstRunInput,
} from "@tentacle-tv/shared";
import { readInvitedSubjects } from "@/avatars/invite/inviteGate";
import { useAvatarInviteSubject } from "@/avatars/invite/useAvatarInviteSubject";
import { useConnectivity } from "@/offline/useConnectivity";
import { useServerUrl } from "@/providers/ServerUrlContext";
import { useFamilyPinReminder } from "../pinSuggest/useFamilyPinReminder";
import { useFamilyAvailability } from "../useFamilyAvailability";
import { useActiveProfile } from "../profiles/profileSessionState";
import { usePickerListing } from "../profiles/usePickerListing";
import { firstRunCoveredPin } from "./firstRunCovered";

/**
 * Ce que le premier lancement lit, branché sur le mobile : le profil actif, la
 * Famille (le code PIN conseillé : la règle partagée `familyPinReminder`), la
 * préférence d'accueil du compte, la photo (règle partagée `avatarInvite`) —
 * et, AVANT toute décision, la demande « Reproposer » du serveur
 * (`promptsResetAt`), honorée une fois (`honorFirstRunPromptsReset`).
 *
 * Une session de profil ne pose pas son code ici (le serveur réserve
 * `setOwnPin` à la session personnelle et aux TV) ; sa photo, si le serveur
 * sait l'écrire par l'appareil (`avatars.devicePhoto`) — dite par le serveur
 * (`useAvatarInviteSubject`), jamais par `/Users/Me`, muet pour un profil.
 */
export function useFirstRunInputs(): FirstRunInput & { resetSettled: boolean } {
  const { storage } = useTentacleConfig();
  const { serverUrl } = useServerUrl();
  const { subjectId, hasPhoto, canChangePhoto } = useAvatarInviteSubject();
  const held = useActiveProfile();
  const online = useConnectivity().state === "online";
  const family = useFamilyAvailability();
  const overview = useFamilyOverview({ enabled: family.available });
  const listing = usePickerListing();
  const reminder = useFamilyPinReminder();
  const layout = useHomeLayout();
  const libraries = useLibraries();
  // Le sujet dont « Reproposer » a été honoré pendant ce lancement : son code PIN revient, même passé hier.
  const [honored, setHonored] = useState<string | null>(null);

  // La demande du serveur pour CE profil : la liste de « Qui regarde ? » pendant une session
  // de profil, la Famille du compte sinon. `undefined` : pas encore su.
  const resetAt = held
    ? listing.data?.profiles.find((profile) => sameUserId(profile.userId, held.id))?.promptsResetAt
    : overview.data?.family?.profiles.find((profile) => !!subjectId && sameUserId(profile.userId, subjectId))?.promptsResetAt;
  const resetSettled = held
    ? !listing.enabled || listing.data !== undefined || listing.isError
    : !family.available || overview.data !== undefined || overview.isError;

  useEffect(() => {
    if (resetSettled && honorFirstRunPromptsReset(storage, serverUrl, subjectId, resetAt)) setHonored(subjectId);
  }, [resetSettled, storage, serverUrl, subjectId, resetAt]);

  // Relus à chaque rendu (une poignée d'octets préchargés) : `honored` en provoque un après l'oubli.
  const seen = parseFirstRunSeen(storage.getItem(FIRST_RUN_SEEN_KEY));
  const invited = readInvitedSubjects(storage);

  // Déjà proposé pendant ce lancement (« Bienvenue dans la famille ») : pas une seconde fois.
  const pinDue = firstRunPinDue({
    profileSession: !!held, familyAvailable: family.available, covered: firstRunCoveredPin(), reminder, resetHonored: !!subjectId && honored === subjectId,
  });
  const homeReady = layout.data && libraries.data ? true : layout.isError || libraries.isError ? false : null;
  const photoDue = hasPhoto === undefined
    ? null
    : shouldInviteToAvatars({ eligible: true, subjectId, canChangePhoto, online, hasPhoto, busy: false, invited });

  // Une demande pas encore honorée : rien ne se décide avant (sinon sur les « Plus tard » d'avant).
  const resetHonoredHere = resetSettled && !promptsResetPending(storage, subjectId, resetAt);
  return { subjectId, serverUrl, online, seen, pinDue, homeReady, photoDue, resetSettled: resetHonoredHere };
}
