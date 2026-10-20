import { useMemo } from "react";
import { useFamilyOverview, useServerCapabilities, useUserId } from "@tentacle-tv/api-client";
import { editedSummaryKinds, familySimpleEditing, type FamilyProfileDto } from "@tentacle-tv/shared";
import { useFamilyAvailability } from "@/family/useFamilyAvailability";
import { ProfileRightsSummary } from "../rightsSummary/ProfileRightsSummary";
import { AgeSection } from "./AgeSection";
import { LibrariesSection } from "./LibrariesSection";
import { RightSwitches } from "./RightSwitches";

/**
 * Les droits d'un profil dans son panneau — décision de Damien (20/10) : les
 * droits de la FAMILLE simples se règlent ici (interrupteurs, âge par paliers,
 * bibliothèques : `familySimpleEditing`, mêmes appelants et mêmes routes que le
 * bureau), le reste en lecture seule avec « Plus de réglages sur le bureau ou
 * le web ». Qui ne peut rien régler garde le résumé seul. Un réglage fait ici
 * s'applique partout aussitôt (Jellyfin, `family:update`, `rights:changed`).
 */
export function ProfileRightsEditor({ profile }: { profile: FamilyProfileDto }) {
  const overview = useFamilyOverview().data ?? null;
  const viewer = useUserId();
  const { capabilities } = useServerCapabilities();
  const guestRequests = useFamilyAvailability().capability?.guestRequests;
  const editing = useMemo(
    () => (overview ? familySimpleEditing(overview, profile, viewer, capabilities, { guestRequests }) : null),
    [overview, profile, viewer, capabilities, guestRequests],
  );
  if (!editing?.any) return <ProfileRightsSummary profile={profile} />;
  return (
    <>
      <RightSwitches profile={profile} editing={editing} />
      {editing.age ? <AgeSection profile={profile} /> : null}
      {editing.libraries ? <LibrariesSection profile={profile} /> : null}
      <ProfileRightsSummary profile={profile} omit={editedSummaryKinds(editing)} />
    </>
  );
}
