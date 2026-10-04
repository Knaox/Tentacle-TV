import { getPrisma, hasPrisma } from "../db";
import { getJellyfinUsers, invalidateJellyfinUsers } from "../watchTogether/usersCache";
import { getFamilySwitches } from "./familyConfig";
import { expireDueInvitations } from "./familyInvitationAnswers";
import { forgetFamilyAccount } from "./familyMembers";
import { endProfileEverywhere, endSessions } from "./familySessions";
import { fold } from "./familyStore";
import { tvEntries } from "./familyTv";

/**
 * Le balayage de la Famille, toutes les dix minutes et au démarrage :
 * - les invitations échues sortent de la cloche ;
 * - un compte disparu de Jellyfin (supprimé depuis son tableau de bord, sans
 *   passer par Tentacle) emporte sa famille ou son adhésion, comme une
 *   suppression par Tentacle ;
 * - un compte désactivé dans Jellyfin perd ses sessions de profil ;
 * - une session de profil qu'aucune TV ne devrait plus montrer (familles
 *   fusionnées par la migration v2, profil sorti de la famille de la TV
 *   pendant que le serveur dormait) est coupée, son « Rester » oublié.
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

async function endStaleProfileSessions(): Promise<void> {
  const prisma = getPrisma();
  const switches = getFamilySwitches();
  const shown = new Map<string, Set<string>>();
  const visibleOn = async (account: string): Promise<Set<string>> => {
    if (!shown.has(account)) shown.set(account, new Set((await tvEntries(account, switches)).entries.map((entry) => fold(entry.userId))));
    return shown.get(account)!;
  };
  const sessions = await prisma.pairedDevice.findMany({ where: { parentId: { not: null } }, select: { id: true, parentId: true, jellyfinUserId: true } });
  const parentIds = [...new Set(sessions.map((row) => row.parentId ?? ""))].filter(Boolean);
  const parents = parentIds.length
    ? await prisma.pairedDevice.findMany({ where: { id: { in: parentIds } }, select: { id: true, jellyfinUserId: true } })
    : [];
  const accountOf = new Map(parents.map((row) => [row.id, row.jellyfinUserId]));
  const stale: Array<{ id: string }> = [];
  for (const session of sessions) {
    const account = accountOf.get(session.parentId ?? "");
    if (account && !(await visibleOn(account)).has(fold(session.jellyfinUserId))) stale.push({ id: session.id });
  }
  if (stale.length) console.log(`[family] ${await endSessions(stale, "family_changed")} session(s) de profil hors de la famille de leur TV coupée(s)`);
  const sticky = await prisma.pairedDevice.findMany({
    where: { parentId: null, stickyProfileId: { not: null } },
    select: { id: true, jellyfinUserId: true, stickyProfileId: true },
  });
  const cleared: string[] = [];
  for (const pairing of sticky) {
    if (!(await visibleOn(pairing.jellyfinUserId)).has(fold(pairing.stickyProfileId ?? ""))) cleared.push(pairing.id);
  }
  if (cleared.length) await prisma.pairedDevice.updateMany({ where: { id: { in: cleared } }, data: { stickyProfileId: null } });
}

export async function sweepFamily(now: number = Date.now()): Promise<void> {
  if (!hasPrisma()) return;
  try {
    const expired = await expireDueInvitations(now);
    if (expired > 0) console.log(`[family] ${expired} invitation(s) échue(s)`);
    await forgetVanishedAccounts(now);
    await endStaleProfileSessions();
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
