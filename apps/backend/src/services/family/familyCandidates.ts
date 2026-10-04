import { getPrisma } from "../db";
import { getJellyfinUsers } from "../watchTogether/usersCache";
import type { FamilyCandidateDto } from "../../family/familyContract";
import { familyCandidates, type FamilyCandidateSource } from "../../family/familyRights";
import { isReviewAccount, requireFamilies } from "./familyConfig";
import { FamilyFailure } from "./familyErrors";
import { familyGuestOwners, isFamilyGuest } from "./familyGuestMarkers";
import type { Actor } from "./familyInvitations";
import { familyOf } from "./familyStore";

/**
 * Les comptes qu'un propriétaire peut chercher pour inviter (v2) : TOUS ceux
 * du serveur, cachés de l'écran de connexion de Jellyfin compris — la Famille
 * vit dans une instance —, affinés par la saisie. Jamais un compte désactivé,
 * soi-même, un invité d'une famille quelconque, ni le compte de démonstration.
 * Un compte déjà dans une famille (n'importe laquelle) est rendu marqué
 * `in_family`, sans dire laquelle ; une invitation de la famille l'attend :
 * `invited`. Un membre n'invite personne : `family.not_owner`.
 */

const LIMIT = 50;

export async function listCandidates(actor: Actor, query: string, now: number): Promise<FamilyCandidateDto[]> {
  requireFamilies();
  if (await isReviewAccount(actor.userId)) throw new FamilyFailure("family.review_account", "Compte de démonstration : aucune invitation");
  if (await isFamilyGuest(actor.userId)) throw new FamilyFailure("family.guest_account", "Un invité n'invite personne");
  const mine = await familyOf(actor.userId);
  if (mine?.role === "member") throw new FamilyFailure("family.not_owner", "Un membre n'invite personne : réservé au propriétaire");
  const users = await getJellyfinUsers();
  if (!users) throw new FamilyFailure("family.jellyfin_unavailable", "Comptes Jellyfin indisponibles");

  const prisma = getPrisma();
  const persons = await prisma.familyMember.findMany({ where: { kind: { in: ["owner", "member"] } }, select: { userId: true } });
  const invited = mine
    ? await prisma.familyInvitation.findMany({
        where: { familyId: mine.family.id, status: "pending", expiresAt: { gt: new Date(now) } },
        select: { inviteeUserId: true },
      })
    : [];
  // Les invités de TOUTES les familles (identifiants déjà pliés), et soi-même.
  const exclude = [actor.userId, ...(await familyGuestOwners()).keys()];
  const sources: FamilyCandidateSource[] = [];
  for (const user of users) {
    if (await isReviewAccount(user.id)) continue;
    sources.push({ id: user.id, name: user.name, isDisabled: user.isDisabled, imageTag: user.imageTag });
  }
  return familyCandidates(sources, {
    query,
    exclude,
    inFamily: persons.map((row) => row.userId),
    invited: invited.map((row) => row.inviteeUserId),
    limit: LIMIT,
  });
}
