import type { TFunction } from "i18next";
import type { FamilyCandidateDto, FamilyOverviewDto, FamilyProfileColor } from "@tentacle-tv/shared";
import {
  INVITE_SHOWN_CANDIDATES,
  inviteCandidateOrder,
  manageCapacity,
  managedFamilyOf,
  manageRows,
  type ManageBlock,
  type ManageCapability,
  type KnownImageTag,
  type ManageRowModel,
  withKnownImageTags,
} from "@tentacle-tv/tv-core";
import type { InviteCandidateView, ManageRowView } from "../../redesign/screens/profiles/ManageProfilesView";
import { profileAvatarUri } from "./profilesModel";

/** Les comptes qu'une recherche montre au plus : la page tient sans défiler (tv-core). */
export const SHOWN_CANDIDATES = INVITE_SHOWN_CANDIDATES;

/** Qui gère : le profil de la session (le propriétaire, ou un membre avec SES droits). */
export interface ManageOwner {
  userId: string;
  name: string;
  color: FamilyProfileColor;
  /** Son portrait, tel que « Qui regarde ? » l'a donné à l'ouverture. */
  imageTag: string | null;
}

/** Le réglage d'une fiche en cours d'envoi (sa clé) : sa case montre déjà le nouvel état. */
export type PendingRight = { key: string; on: boolean } | null;

function formatDay(iso: string, language: string): string {
  const at = new Date(iso);
  return Number.isNaN(at.getTime()) ? "—" : at.toLocaleDateString(language, { day: "numeric", month: "long" });
}

/** Ce que la ligne dit du profil : son rôle (« Parent » compris, 1.30.0), qui a ajouté un invité, ou l'échéance d'une invitation. */
export function rowDetail(row: ManageRowModel, language: string, t: TFunction): string {
  if (row.kind === "invitation") return t("familyTv:manage.pending", { date: row.expiresAt ? formatDay(row.expiresAt, language) : "—" });
  if (row.kind === "guest" && row.createdByYou) return t("familyTv:manage.addedByYou");
  if (row.kind === "guest" && row.createdByName) return t("familyTv:manage.addedBy", { name: row.createdByName });
  if (row.kind === "member") return t(row.parent ? "family:kindParent" : "family:kindMember");
  return t(row.kind === "owner" ? "family:kindOwner" : "family:kindGuest");
}

function rowView(row: ManageRowModel, serverUrl: string | null, language: string, t: TFunction): ManageRowView {
  const invitation = row.kind === "invitation";
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    avatarUri: invitation ? undefined : profileAvatarUri(serverUrl, row.userId, row.imageTag),
    detail: rowDetail(row, language, t),
    invitation,
    // La liste ne garde qu'« Annuler » d'une invitation ; retirer et supprimer vivent dans la fiche.
    action: invitation && row.action ? { kind: row.action, hint: t("familyTv:manage.cancelHint", { name: row.name }) } : null,
    opens: !invitation && row.gestures.length > 0,
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
  capability: ManageCapability = {},
  known: readonly KnownImageTag[] = [],
) {
  const rows = withKnownImageTags(manageRows(overview, actor, capability), known);
  const capacity = manageCapacity(overview);
  const block = capacity.inviteBlock ?? capacity.guestBlock;
  // Le propriétaire de la FAMILLE (v2 : pas forcément la session) ; v1 : la session.
  const ownerName = managedFamilyOf(overview)?.ownerName ?? actor.name;
  return {
    rows,
    views: rows.map((row) => rowView(row, serverUrl, language, t)),
    capacity,
    subtitle: t("familyTv:manage.subtitle", { owner: ownerName, count: capacity.profiles, max: capacity.max }),
    blocked: block && (!capacity.canCreateGuest || !capacity.canInvite) ? t(BLOCK_KEYS[block]) : null,
  };
}

export function candidateViews(candidates: FamilyCandidateDto[], sent: ReadonlySet<string>, serverUrl: string | null): InviteCandidateView[] {
  // Les invitables d'abord (tv-core `inviteCandidateOrder`) : BAS depuis la recherche mène au premier.
  return inviteCandidateOrder(candidates).slice(0, SHOWN_CANDIDATES).map((candidate) => ({
    id: candidate.userId,
    name: candidate.name,
    avatarUri: profileAvatarUri(serverUrl, candidate.userId, candidate.imageTag),
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
