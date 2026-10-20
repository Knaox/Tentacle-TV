import { useMemo } from "react";
import { useFamilyOverview, useServerCapabilities, useUserId } from "@tentacle-tv/api-client";
import { editedSummaryKinds, familySimpleEditing, type FamilyProfileDto } from "@tentacle-tv/shared";
import { useFamilyAvailability } from "../../useFamilyAvailability";
import { ProfileRightsSummary } from "../ProfileRightsSummary";
import { NarrowAgeSection } from "./NarrowAgeSection";
import { NarrowLibrariesSection } from "./NarrowLibrariesSection";

/**
 * Les droits d'un profil dans la fenêtre étroite (téléphone, iPad) —
 * `ProfileRightsEditor` du mobile, décision de Damien (20/10) : les droits de
 * la FAMILLE simples se règlent ici (`familySimpleEditing` : les interrupteurs
 * de la ligne, l'âge par paliers, les bibliothèques), le reste en lecture
 * seule avec « Plus de réglages sur le bureau ou le web ». Les interrupteurs
 * (demander, créer des invités, parent) restent ceux de `ProfileRow`, gardés
 * par les mêmes règles partagées.
 */
export function NarrowRightsEditor({ profile }: { profile: FamilyProfileDto }) {
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
      {editing.age && <NarrowAgeSection profile={profile} />}
      {editing.libraries && <NarrowLibrariesSection profile={profile} />}
      <ProfileRightsSummary profile={profile} omit={editedSummaryKinds(editing)} />
    </>
  );
}
