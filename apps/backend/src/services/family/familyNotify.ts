import { getPrisma } from "../db";
import { loadPushLangs, type PushLang } from "../pushLang";
import { isPushPrefEnabled } from "../pushPreferences";
import { sendToUser as sendPush } from "../pushService";
import { sendToUser as sendSocket } from "../wsManager";
import type { FamilyNotificationType, FamilyUpdateScope } from "../../family/familyProtocol";

/**
 * Ce que la Famille dit aux comptes CONCERNÉS — et à eux seuls (SEC-F-25/26) :
 * le socket (`family:update` : relire), la cloche (des DONNÉES — le nom de
 * l'autre, l'invitation ou la famille —, jamais une phrase ni un jeton) et un
 * push pour la seule invitation reçue (préférence `family`, activée par
 * défaut). Rien de tout cela ne porte de secret.
 */

/** Relire la Famille, chez chacun de ces comptes (une fois par compte). */
export function familyUpdate(userIds: Iterable<string>, scope: FamilyUpdateScope): void {
  for (const userId of new Set(userIds)) sendSocket(userId, { type: "family:update", scope });
}

/** La famille PARTAGÉE a changé : son propriétaire et chacun de ses membres
 *  relisent (et `also` — un membre qui vient d'en sortir). */
export async function notifyFamily(familyId: string, also: Iterable<string> = []): Promise<void> {
  const rows = await getPrisma().familyMember.findMany({ where: { familyId }, select: { userId: true, kind: true } });
  const persons = rows.filter((row) => row.kind !== "guest").map((row) => row.userId);
  familyUpdate([...persons, ...also], "family");
}

/** Un nom tel qu'il entre dans la cloche ou un push : sans saut de ligne ni
 *  caractère de contrôle, borné (SEC-F-24). */
export function plainName(raw: string): string {
  const visible = Array.from(raw)
    .filter((char) => {
      const code = char.codePointAt(0) ?? 0;
      return code >= 0x20 && !(code >= 0x7f && code <= 0x9f) && !(code >= 0x2028 && code <= 0x202e);
    })
    .join("");
  return Array.from(visible.replace(/\s+/g, " ").trim()).slice(0, 64).join("");
}

export async function ringBell(userId: string, type: FamilyNotificationType, name: string, refId: string): Promise<void> {
  await getPrisma().notification.create({
    data: { jellyfinUserId: userId, type, title: plainName(name), body: null, refId },
  });
  sendSocket(userId, { type: "notifications:update", action: "refresh" });
}

/** Une invitation répondue, annulée ou expirée quitte la cloche de son destinataire. */
export async function clearInvitationBell(userId: string, invitationId: string): Promise<void> {
  const { count } = await getPrisma().notification.deleteMany({
    where: { jellyfinUserId: userId, type: "family_invite", refId: invitationId },
  });
  if (count > 0) sendSocket(userId, { type: "notifications:update", action: "refresh" });
}

const INVITE_TEXT: Record<PushLang, (owner: string) => { title: string; body: string }> = {
  fr: (owner) => ({ title: "Invitation à rejoindre une famille", body: `${owner} vous invite à rejoindre sa famille sur Tentacle TV.` }),
  en: (owner) => ({ title: "Family invitation", body: `${owner} invites you to join their family on Tentacle TV.` }),
};

/** Le push d'une invitation reçue : au destinataire seul, sans jeton, si sa
 *  préférence `family` le permet (ligne absente = oui). */
export async function pushInvitation(inviteeUserId: string, ownerName: string, invitationId: string): Promise<void> {
  const prisma = getPrisma();
  const pref = await prisma.notificationPreference.findUnique({ where: { jellyfinUserId: inviteeUserId } });
  if (!isPushPrefEnabled(pref, "family")) return;
  const lang = (await loadPushLangs([inviteeUserId])).get(inviteeUserId) ?? "fr";
  const text = INVITE_TEXT[lang](plainName(ownerName));
  const result = await sendPush(inviteeUserId, { ...text, data: { type: "family_invite", refId: invitationId } });
  console.log(`[family] push d'invitation : ${result.sent} appareil(s)${result.suppressed ? " (coupé en dev)" : ""}`);
}
