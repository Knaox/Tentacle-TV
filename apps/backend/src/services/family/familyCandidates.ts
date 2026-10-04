import { getPrisma } from "../db";
import { getJellyfinUsers } from "../watchTogether/usersCache";
import type { FamilyCandidateDto } from "../../family/familyContract";
import { selectCandidates } from "../../family/familyRules";
import { isReviewAccount, requireFamilies } from "./familyConfig";
import { FamilyFailure } from "./familyErrors";
import { familyGuestOwners, isFamilyGuest } from "./familyGuestMarkers";
import type { Actor } from "./familyInvitations";
import { familyProfiles, findOwnedFamily } from "./familyStore";

/**
 * Les comptes qu'un propriétaire peut inviter (SEC-F-22) : ceux de l'écran de
 * connexion de Jellyfin, filtrés par la saisie ; un compte CACHÉ par son nom
 * exact seulement — jamais par une liste ni un préfixe. Jamais un compte
 * désactivé, soi-même, un membre ou un invité de sa famille, une invitation
 * en attente, un invité d'une famille quelconque, le compte de démonstration.
 */

const LIMIT = 50;

export async function listCandidates(actor: Actor, query: string, now: number): Promise<FamilyCandidateDto[]> {
  requireFamilies();
  if (await isReviewAccount(actor.userId)) throw new FamilyFailure("family.review_account", "Compte de démonstration : aucune invitation");
  if (await isFamilyGuest(actor.userId)) throw new FamilyFailure("family.guest_account", "Un invité n'invite personne");
  const users = await getJellyfinUsers();
  if (!users) throw new FamilyFailure("family.jellyfin_unavailable", "Comptes Jellyfin indisponibles");

  const exclude = [actor.userId];
  const family = await findOwnedFamily(actor.userId);
  if (family) {
    exclude.push(...(await familyProfiles(family.id)).map((row) => row.userId));
    const pending = await getPrisma().familyInvitation.findMany({
      where: { familyId: family.id, status: "pending", expiresAt: { gt: new Date(now) } },
      select: { inviteeUserId: true },
    });
    exclude.push(...pending.map((row) => row.inviteeUserId));
  }
  // Les invités de TOUTES les familles (identifiants déjà pliés), et le compte de démonstration.
  exclude.push(...(await familyGuestOwners()).keys());
  const sources = [];
  for (const user of users) {
    if (await isReviewAccount(user.id)) continue;
    sources.push({ id: user.id, name: user.name, isHidden: user.isHidden, isDisabled: user.isDisabled, imageTag: user.imageTag });
  }
  return selectCandidates(sources, { query, exclude, limit: LIMIT });
}
