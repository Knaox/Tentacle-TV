import {
  familyErrorOf,
  familyPath,
  type CreateGuestBody,
  type FamilyCandidateDto,
  type FamilyErrorBody,
  type FamilyGuestRights,
  type FamilyMemberRights,
  type FamilyMembershipDto,
  type FamilyOverviewDto,
  type FamilyProfileDto,
  type IncomingInvitationDto,
  type OutgoingInvitationDto,
} from "@tentacle-tv/shared";
import { TentacleApiError, tentacleApiFetch } from "../hooks/usePreferences";

/**
 * Les appels de la Famille portés par la session COURANTE de l'application —
 * le web (cookie), le bureau et le mobile (jeton), et la session de profil du
 * propriétaire sur sa TV (« Gérer les profils », jeton posé par
 * `setPreferencesToken`). Les appels du jeton de JUMELAGE d'une TV vivent à
 * part (`familyTvApi.ts`) : ils ne portent jamais la session courante.
 * Contrat : `@tentacle-tv/shared` › `family/`.
 */

/** Le refus de la Famille porté par une erreur d'appel, ou null (réseau, autre refus). */
export function familyErrorFromApi(error: unknown): FamilyErrorBody | null {
  return error instanceof TentacleApiError ? familyErrorOf(error.message) : null;
}

function send<T>(path: string, method: "POST" | "PUT" | "DELETE", body?: unknown): Promise<T> {
  return tentacleApiFetch<T>(path, { method, ...(body !== undefined && { body: JSON.stringify(body) }) });
}

/** L'état de la Famille pour ce compte ; null face à un serveur d'avant la Famille (404). */
export async function fetchFamilyOverview(): Promise<FamilyOverviewDto | null> {
  try {
    return await tentacleApiFetch<FamilyOverviewDto>(familyPath("overview"));
  } catch (error) {
    if (error instanceof TentacleApiError && error.status === 404 && !familyErrorFromApi(error)) return null;
    throw error;
  }
}

export function fetchFamilyCandidates(query: string): Promise<FamilyCandidateDto[]> {
  const q = query.trim();
  return tentacleApiFetch<FamilyCandidateDto[]>(`${familyPath("candidates")}${q ? `?q=${encodeURIComponent(q)}` : ""}`);
}

export function createFamilyGuest(body: CreateGuestBody): Promise<FamilyProfileDto> {
  return send(familyPath("createGuest"), "POST", body);
}

export function deleteFamilyGuest(userId: string): Promise<{ deleted: true }> {
  return send(familyPath("deleteGuest", { userId }), "DELETE");
}

export function setFamilyGuestPin(input: { userId: string; pin: string | null }): Promise<{ hasPin: boolean }> {
  return send(familyPath("setGuestPin", { userId: input.userId }), "PUT", { pin: input.pin });
}

export function setOwnFamilyPin(pin: string | null): Promise<{ hasPin: boolean }> {
  return send(familyPath("setOwnPin"), "PUT", { pin });
}

export function removeFamilyMember(userId: string): Promise<{ removed: true }> {
  return send(familyPath("removeMember", { userId }), "DELETE");
}

/** Le propriétaire règle les droits d'un invité (v2) — « peut demander » : ses
 *  extensions, au nom du propriétaire. Seuls les champs donnés changent. */
export function setFamilyGuestRights(input: { userId: string; rights: Partial<FamilyGuestRights> }): Promise<FamilyGuestRights> {
  return send(familyPath("setGuestRights", { userId: input.userId }), "PUT", input.rights);
}

/** Le propriétaire règle les droits d'un membre (v2) : seuls les champs donnés changent. */
export function setFamilyMemberRights(input: { userId: string; rights: Partial<FamilyMemberRights> }): Promise<FamilyMemberRights> {
  return send(familyPath("setMemberRights", { userId: input.userId }), "PUT", input.rights);
}

export function sendFamilyInvitation(userId: string): Promise<OutgoingInvitationDto> {
  return send(familyPath("invite"), "POST", { userId });
}

// L'identifiant d'une invitation voyage dans le corps, jamais dans l'URL.
export function cancelFamilyInvitation(id: string): Promise<{ cancelled: true }> {
  return send(familyPath("cancelInvite"), "POST", { id });
}

export function acceptFamilyInvitation(id: string): Promise<FamilyMembershipDto> {
  return send(familyPath("acceptInvite"), "POST", { id });
}

export function declineFamilyInvitation(id: string): Promise<{ declined: true }> {
  return send(familyPath("declineInvite"), "POST", { id });
}

export function snoozeFamilyInvitation(id: string): Promise<IncomingInvitationDto> {
  return send(familyPath("snoozeInvite"), "POST", { id });
}

export function leaveFamily(familyId: string): Promise<{ left: true }> {
  return send(familyPath("leave", { familyId }), "POST");
}

/** Membres sortis, invités supprimés de Jellyfin : à confirmer explicitement côté client. */
export function dissolveFamily(): Promise<{ dissolved: true }> {
  return send(familyPath("dissolve"), "DELETE", { confirm: "dissolve" });
}
