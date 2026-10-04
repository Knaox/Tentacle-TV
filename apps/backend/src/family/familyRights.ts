import type {
  FamilyCandidateDto,
  FamilyCandidateStatus,
  FamilyMemberRights,
  FamilyRights,
  FamilyRole,
  FamilySwitches,
} from "./familyContract";
import { normalizeSearch } from "../utils/textSearch";

/**
 * La Famille v2 — les DROITS et les CANDIDATS : règles pures, appliquées par
 * le serveur et lisibles par les clients (aucune n'y est jamais décidée à la
 * place du serveur).
 *
 * MIROIR : `apps/backend/src/family/familyRights.ts`, octet pour octet (voir
 * l'en-tête de `familyContract.ts`).
 */

function fold(id: string): string {
  return id.replace(/-/g, "").toLowerCase();
}

// ── Droits ──────────────────────────────────────────────────────────────────

/**
 * Ce que peut un compte dans sa famille. Le propriétaire gère les membres et
 * tous les invités ; un membre, les invités qu'il a créés — et en crée s'il en
 * a le droit. Créer exige la Famille et les invités allumés ; gérer ce qui
 * existe, non (on peut toujours retirer, supprimer, dissoudre). Sans rôle :
 * rien.
 */
export function familyRightsOf(
  role: FamilyRole | null,
  memberRights: FamilyMemberRights | null,
  switches: FamilySwitches,
): FamilyRights {
  const creation = switches.families && switches.guests;
  if (role === "owner") return { manageMembers: true, createGuests: creation, manageGuests: "all" };
  if (role === "member") {
    return { manageMembers: false, createGuests: creation && memberRights?.createGuests === true, manageGuests: "own" };
  }
  return { manageMembers: false, createGuests: false, manageGuests: "none" };
}

/** Supprimer cet invité et poser son PIN : le propriétaire, tout invité de sa
 *  famille ; un membre, ceux qu'il a créés (`createdBy`). */
export function canManageGuest(rights: FamilyRights, createdBy: string | null, actorUserId: string): boolean {
  if (rights.manageGuests === "all") return true;
  return rights.manageGuests === "own" && createdBy !== null && fold(createdBy) === fold(actorUserId);
}

// ── Candidats ───────────────────────────────────────────────────────────────

export interface FamilyCandidateSource {
  id: string;
  name: string;
  isDisabled: boolean;
  imageTag: string | null;
}

export interface FamilyCandidateOptions {
  query: string;
  /** Jamais rendus : soi-même, les invités de toutes les familles, le compte de démonstration. */
  exclude: string[];
  /** Déjà dans une famille, n'importe laquelle (propriétaires et membres). */
  inFamily: string[];
  /** Une invitation de VOTRE famille les attend. */
  invited: string[];
  limit: number;
}

/**
 * Les comptes qu'un propriétaire peut chercher pour inviter : TOUS ceux du
 * serveur, cachés de l'écran de connexion de Jellyfin compris (la Famille vit
 * dans UNE instance), affinés par la saisie — quelques lettres suffisent,
 * accents et casse indifférents. Jamais un compte désactivé ni un identifiant
 * d'`exclude`. Un compte déjà dans une famille, ou qu'une invitation attend,
 * est rendu MARQUÉ : il ne s'invite pas. Les invitables d'abord, puis par nom.
 */
export function familyCandidates(users: FamilyCandidateSource[], options: FamilyCandidateOptions): FamilyCandidateDto[] {
  const excluded = new Set(options.exclude.map(fold));
  const inFamily = new Set(options.inFamily.map(fold));
  const invited = new Set(options.invited.map(fold));
  const query = normalizeSearch(options.query);
  const statusOf = (id: string): FamilyCandidateStatus =>
    inFamily.has(fold(id)) ? "in_family" : invited.has(fold(id)) ? "invited" : "available";
  return users
    .filter((user) => !user.isDisabled && !excluded.has(fold(user.id)))
    .filter((user) => query.length === 0 || normalizeSearch(user.name).includes(query))
    .map((user): FamilyCandidateDto => ({ userId: user.id, name: user.name, imageTag: user.imageTag, status: statusOf(user.id) }))
    .sort((a, b) => Number(a.status !== "available") - Number(b.status !== "available") || a.name.localeCompare(b.name))
    .slice(0, options.limit);
}
