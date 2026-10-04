import type { TFunction } from "i18next";
import type { FamilyCandidateDto, FamilyOverviewDto, FamilyProfileColor } from "@tentacle-tv/shared";
import { INVITE_SHOWN_CANDIDATES, manageCapacity, manageRows, type ManageBlock, type ManageRowModel } from "@tentacle-tv/tv-core";
import type { InviteCandidateView, ManageRowView } from "../../redesign/screens/profiles/ManageProfilesView";
import { profileAvatarUri } from "./profilesModel";

/** Les comptes qu'une recherche montre au plus : la page tient sans défiler (tv-core). */
export const SHOWN_CANDIDATES = INVITE_SHOWN_CANDIDATES;

export interface ManageOwner {
  userId: string;
  name: string;
  color: FamilyProfileColor;
}

function formatDay(iso: string, language: string): string {
  const at = new Date(iso);
  return Number.isNaN(at.getTime()) ? "—" : at.toLocaleDateString(language, { day: "numeric", month: "long" });
}

function rowView(row: ManageRowModel, serverUrl: string | null, language: string, t: TFunction): ManageRowView {
  const detail =
    row.kind === "invitation"
      ? t("familyTv:manage.pending", { date: row.expiresAt ? formatDay(row.expiresAt, language) : "—" })
      : t(row.kind === "owner" ? "family:kindOwner" : row.kind === "member" ? "family:kindMember" : "family:kindGuest");
  const hintKey = row.action === "remove" ? "familyTv:manage.removeHint" : row.action === "delete" ? "familyTv:manage.deleteHint" : "familyTv:manage.cancelHint";
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    avatarUri: row.kind === "invitation" ? undefined : profileAvatarUri(serverUrl, row.userId, row.imageTag, 160),
    detail,
    invitation: row.kind === "invitation",
    action: row.action ? { kind: row.action, hint: t(hintKey, { name: row.name }) } : null,
  };
}

const BLOCK_KEYS: Record<Exclude<ManageBlock, null>, string> = {
  full: "familyTv:manage.full",
  guestsFull: "familyTv:manage.guestsFull",
  guestsOff: "familyTv:manage.guestsOff",
  familiesOff: "familyTv:manage.familiesOff",
};

export function manageListModel(overview: FamilyOverviewDto, owner: ManageOwner, serverUrl: string | null, language: string, t: TFunction) {
  const rows = manageRows(overview, owner);
  const capacity = manageCapacity(overview);
  const block = capacity.inviteBlock ?? capacity.guestBlock;
  return {
    rows,
    views: rows.map((row) => rowView(row, serverUrl, language, t)),
    capacity,
    subtitle: t("familyTv:manage.subtitle", { owner: owner.name, count: capacity.profiles, max: capacity.max }),
    blocked: block && (!capacity.canCreateGuest || !capacity.canInvite) ? t(BLOCK_KEYS[block]) : null,
  };
}

export function candidateViews(candidates: FamilyCandidateDto[], sent: ReadonlySet<string>, serverUrl: string | null): InviteCandidateView[] {
  return candidates.slice(0, SHOWN_CANDIDATES).map((candidate) => ({
    id: candidate.userId,
    name: candidate.name,
    avatarUri: profileAvatarUri(serverUrl, candidate.userId, candidate.imageTag, 160),
    sent: sent.has(candidate.userId),
  }));
}

/** La couleur proposée à un nouvel invité : la première qu'aucun profil de la famille ne porte. */
export function freeColor(overview: FamilyOverviewDto | null | undefined, palette: readonly FamilyProfileColor[]): FamilyProfileColor {
  const taken = new Set(overview?.owned?.profiles.map((profile) => profile.color) ?? []);
  return palette.find((color) => !taken.has(color)) ?? palette[0];
}
