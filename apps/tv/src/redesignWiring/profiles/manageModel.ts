import type { TFunction } from "i18next";
import type { FamilyCandidateDto, FamilyOverviewDto, FamilyProfileColor } from "@tentacle-tv/shared";
import { INVITE_SHOWN_CANDIDATES, manageCapacity, managedFamilyOf, manageRows, type ManageBlock, type ManageRowModel } from "@tentacle-tv/tv-core";
import type { InviteCandidateView, ManageRowView } from "../../redesign/screens/profiles/ManageProfilesView";
import { profileAvatarUri } from "./profilesModel";

/** Les comptes qu'une recherche montre au plus : la page tient sans défiler (tv-core). */
export const SHOWN_CANDIDATES = INVITE_SHOWN_CANDIDATES;

/** Qui gère : le profil de la session (le propriétaire, ou un membre avec SES droits). */
export interface ManageOwner {
  userId: string;
  name: string;
  color: FamilyProfileColor;
}

/** Le droit d'un membre en cours d'envoi : sa case montre déjà le nouvel état. */
export type PendingRight = { id: string; on: boolean } | null;

function formatDay(iso: string, language: string): string {
  const at = new Date(iso);
  return Number.isNaN(at.getTime()) ? "—" : at.toLocaleDateString(language, { day: "numeric", month: "long" });
}

function rowView(row: ManageRowModel, serverUrl: string | null, language: string, t: TFunction, pending: PendingRight): ManageRowView {
  const detail =
    row.kind === "invitation"
      ? t("familyTv:manage.pending", { date: row.expiresAt ? formatDay(row.expiresAt, language) : "—" })
      : row.kind === "guest" && row.createdByName
        ? t("familyTv:manage.addedBy", { name: row.createdByName })
        : t(row.kind === "owner" ? "family:kindOwner" : row.kind === "member" ? "family:kindMember" : "family:kindGuest");
  const rightOn = pending?.id === row.id ? pending.on : row.memberRights?.createGuests === true;
  const rightLabel = t("familyTv:manage.canCreateGuests");
  const hintKey = row.action === "remove" ? "familyTv:manage.removeHint" : row.action === "delete" ? "familyTv:manage.deleteHint" : "familyTv:manage.cancelHint";
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    avatarUri: row.kind === "invitation" ? undefined : profileAvatarUri(serverUrl, row.userId, row.imageTag, 160),
    detail,
    invitation: row.kind === "invitation",
    action: row.action ? { kind: row.action, hint: t(hintKey, { name: row.name }) } : null,
    right: row.memberRights
      ? {
          label: rightLabel,
          on: rightOn,
          accessibilityLabel: `${row.name}, ${rightLabel} : ${t(rightOn ? "preferences:reglageActive" : "preferences:reglageDesactive")}`,
        }
      : null,
  };
}

const BLOCK_KEYS: Record<Exclude<ManageBlock, null>, string> = {
  full: "familyTv:manage.full",
  guestsFull: "familyTv:manage.guestsFull",
  guestsOff: "familyTv:manage.guestsOff",
  familiesOff: "familyTv:manage.familiesOff",
  noGuestRight: "familyTv:manage.noGuestRight",
};

export function manageListModel(
  overview: FamilyOverviewDto,
  actor: ManageOwner,
  serverUrl: string | null,
  language: string,
  t: TFunction,
  pending: PendingRight = null,
) {
  const rows = manageRows(overview, actor);
  const capacity = manageCapacity(overview);
  const block = capacity.inviteBlock ?? capacity.guestBlock;
  // Le propriétaire de la FAMILLE (v2 : pas forcément la session) ; v1 : la session.
  const ownerName = managedFamilyOf(overview)?.ownerName ?? actor.name;
  return {
    rows,
    views: rows.map((row) => rowView(row, serverUrl, language, t, pending)),
    capacity,
    subtitle: t("familyTv:manage.subtitle", { owner: ownerName, count: capacity.profiles, max: capacity.max }),
    blocked: block && (!capacity.canCreateGuest || !capacity.canInvite) ? t(BLOCK_KEYS[block]) : null,
  };
}

export function candidateViews(candidates: FamilyCandidateDto[], sent: ReadonlySet<string>, serverUrl: string | null): InviteCandidateView[] {
  return candidates.slice(0, SHOWN_CANDIDATES).map((candidate) => ({
    id: candidate.userId,
    name: candidate.name,
    avatarUri: profileAvatarUri(serverUrl, candidate.userId, candidate.imageTag, 160),
    sent: sent.has(candidate.userId),
    // Un serveur v1 ne dit pas le statut : tout candidat s'invitait.
    status: candidate.status ?? "available",
  }));
}

/** La couleur proposée à un nouvel invité : la première qu'aucun profil de la famille ne porte. */
export function freeColor(overview: FamilyOverviewDto | null | undefined, palette: readonly FamilyProfileColor[]): FamilyProfileColor {
  const family = overview ? managedFamilyOf(overview) : null;
  const taken = new Set(family?.profiles.map((profile) => profile.color) ?? []);
  return palette.find((color) => !taken.has(color)) ?? palette[0];
}
