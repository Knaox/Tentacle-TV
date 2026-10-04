import { getPrisma, hasPrisma } from "../db";
import { getJellyfinUsers, invalidateJellyfinUsers } from "../watchTogether/usersCache";
import { expireDueInvitations } from "./familyInvitationAnswers";
import { forgetFamilyAccount } from "./familyMembers";
import { endProfileEverywhere } from "./familySessions";
import { fold } from "./familyStore";

/**
 * Le balayage de la Famille, toutes les dix minutes et au démarrage :
 * - les invitations échues sortent de la cloche ;
 * - un compte disparu de Jellyfin (supprimé depuis son tableau de bord, sans
 *   passer par Tentacle) emporte sa famille ou son adhésion, comme une
 *   suppression par Tentacle ;
 * - un compte désactivé dans Jellyfin perd ses sessions de profil.
 *
 * Prudence : Jellyfin muet ou liste vide → rien n'est conclu ; un profil né
 * après la lecture de la liste attend le passage suivant.
 */

const INTERVAL_MS = 10 * 60_000;
const FRESH_MARGIN_MS = 60_000;
let timer: ReturnType<typeof setInterval> | null = null;

async function forgetVanishedAccounts(now: number): Promise<void> {
  invalidateJellyfinUsers();
  const listedAt = Date.now();
  const users = await getJellyfinUsers();
  if (!users || users.length === 0) return;
  const known = new Set(users.map((user) => fold(user.id)));
  // Un compte DÉSACTIVÉ dans Jellyfin ne garde aucune session de profil : le
  // proxy, qui prête la clé admin aux appareils, la servirait encore.
  for (const user of users.filter((entry) => entry.isDisabled)) {
    const sessions = await getPrisma().pairedDevice.count({ where: { jellyfinUserId: user.id, parentId: { not: null } } });
    if (sessions > 0) await endProfileEverywhere(user.id, "removed");
  }
  const prisma = getPrisma();
  const owners = await prisma.family.findMany({ select: { ownerUserId: true } });
  const profiles = await prisma.familyMember.findMany({ select: { userId: true, createdAt: true } });
  const vanished = new Set<string>();
  for (const { ownerUserId } of owners) if (!known.has(fold(ownerUserId))) vanished.add(ownerUserId);
  for (const { userId, createdAt } of profiles) {
    if (createdAt.getTime() >= listedAt - FRESH_MARGIN_MS) continue;
    if (!known.has(fold(userId))) vanished.add(userId);
  }
  for (const userId of vanished) await forgetFamilyAccount(userId, now);
}

export async function sweepFamily(now: number = Date.now()): Promise<void> {
  if (!hasPrisma()) return;
  try {
    const expired = await expireDueInvitations(now);
    if (expired > 0) console.log(`[family] ${expired} invitation(s) échue(s)`);
    await forgetVanishedAccounts(now);
  } catch (error) {
    console.log(`[family] balayage interrompu : ${(error as Error)?.message ?? error}`);
  }
}

export function startFamilySweep(): void {
  if (timer) return;
  timer = setInterval(() => void sweepFamily(), INTERVAL_MS);
  void sweepFamily();
}

export function stopFamilySweep(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
