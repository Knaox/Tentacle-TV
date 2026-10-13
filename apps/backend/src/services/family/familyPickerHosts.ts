import crypto from "crypto";
import { getPrisma } from "../db";
import { revokePairedDevice } from "../deviceRevocation";
import { FAMILY_PICKER_DEVICE_NAME_MAX, type FamilyPickerPlatform } from "../../family/familyPickerContract";
import { isUniqueViolation } from "./familyStore";

/**
 * L'HÔTE de profils d'un appareil hors TV — le bureau (docs/FAMILLE.md,
 * « Le bureau »). Une ligne `paired_devices` SANS parent, marquée par sa
 * plateforme (`platform`), propre à UNE session personnelle de cet appareil :
 * son empreinte est DÉRIVÉE du jeton personnel, sous un préfixe de domaine —
 * jamais l'empreinte d'un jeton qu'une porte reconnaîtrait. Aucun jeton ne
 * l'ouvre donc : seul le porteur de la session personnelle l'atteint, par les
 * routes `picker*`.
 *
 * Ses sessions de profil sont ses lignes ENFANTS, et la révocation commune
 * (`deviceRevocation.ts`) les emporte avec elle : déconnexion du compte sur
 * cet appareil (`/api/auth/logout`), compte supprimé, époque de jumelage,
 * balayage d'un hôte abandonné. Les coupures de la Famille (`familySessions.ts`)
 * la traitent comme une TV du compte : un membre qui part y perd les autres
 * profils, son profil quitte celles des autres.
 */

const HOST_DOMAIN = "tentacle:family-picker-host:";
/** Un hôte que sa session personnelle n'a plus présenté depuis trente jours
 *  est abandonné (session du compte expirée, appareil disparu) : le balayage
 *  le révoque, ses sessions de profil avec. */
export const PICKER_HOST_IDLE_MS = 30 * 24 * 3_600_000;
const DEFAULT_DEVICE_NAME = "Desktop";

export interface PickerHost {
  id: string;
  name: string;
  jellyfinUserId: string;
  platform: string;
}

const HOST_FIELDS = { id: true, name: true, jellyfinUserId: true, platform: true, parentId: true } as const;

/** L'empreinte de l'hôte d'une session personnelle. */
export function pickerHostHash(personalToken: string): string {
  return crypto.createHash("sha256").update(HOST_DOMAIN + personalToken).digest("hex");
}

/** Le nom de l'appareil tel que Jellyfin le montrera : visible, resserré, borné. */
export function pickerDeviceName(raw: string | undefined): string {
  // Les blancs (retours à la ligne compris) deviennent des espaces ; les
  // caractères de contrôle et les marques invisibles disparaissent.
  const visible = Array.from((raw ?? "").replace(/\s+/g, " ")).filter((char) => {
    const code = char.codePointAt(0) ?? 0;
    return code >= 0x20 && !(code >= 0x7f && code <= 0x9f) && !(code >= 0x200b && code <= 0x206f) && code !== 0xfeff;
  });
  const name = visible.join("").replace(/ {2,}/g, " ").trim();
  return Array.from(name).slice(0, FAMILY_PICKER_DEVICE_NAME_MAX).join("").trim() || DEFAULT_DEVICE_NAME;
}

function asHost(row: { id: string; name: string; jellyfinUserId: string; platform: string | null; parentId: string | null } | null): PickerHost | null {
  if (!row || row.parentId || !row.platform) return null;
  return { id: row.id, name: row.name, jellyfinUserId: row.jellyfinUserId, platform: row.platform };
}

/** L'hôte de cette session personnelle, s'il existe. */
export async function findPickerHost(personalToken: string): Promise<PickerHost | null> {
  return asHost(await getPrisma().pairedDevice.findUnique({ where: { tokenHash: pickerHostHash(personalToken) }, select: HOST_FIELDS }));
}

/** L'hôte de cette session personnelle, créé au besoin (au premier profil
 *  ouvert sur l'appareil). Une course perdue relit celui du gagnant. */
export async function ensurePickerHost(
  personalToken: string,
  account: { userId: string; username: string },
  platform: FamilyPickerPlatform,
  deviceName: string | undefined,
  now: number,
): Promise<PickerHost> {
  const prisma = getPrisma();
  const tokenHash = pickerHostHash(personalToken);
  const name = pickerDeviceName(deviceName);
  const existing = await findPickerHost(personalToken);
  if (existing) {
    await prisma.pairedDevice.update({ where: { id: existing.id }, data: { name, lastSeen: new Date(now) } });
    return { ...existing, name };
  }
  try {
    const created = await prisma.pairedDevice.create({
      data: {
        name,
        jellyfinUserId: account.userId,
        username: account.username,
        tokenHash,
        platform,
        profilesSince: new Date(now),
        lastSeen: new Date(now),
      },
      select: HOST_FIELDS,
    });
    const host = asHost(created);
    if (host) return host;
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
  }
  const again = await findPickerHost(personalToken);
  if (!again) throw new Error("hôte de profils introuvable après sa création");
  return again;
}

/** La session personnelle s'est présentée : l'hôte n'est pas abandonné. */
export async function touchPickerHost(hostId: string, now: number): Promise<void> {
  await getPrisma().pairedDevice.updateMany({ where: { id: hostId }, data: { lastSeen: new Date(now) } });
}

/** La session de profil en cours sur cet hôte : le compte de son profil, ou null. */
export async function currentProfileOf(hostId: string): Promise<string | null> {
  const sessions = await getPrisma().pairedDevice.findMany({
    where: { parentId: hostId },
    select: { jellyfinUserId: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  return sessions[0]?.jellyfinUserId ?? null;
}

/** La déconnexion du compte sur cet appareil : son hôte et ses sessions de
 *  profil, avant la réponse. Faux : aucun hôte pour ce jeton. */
export async function endPickerHost(personalToken: string): Promise<boolean> {
  const host = await findPickerHost(personalToken);
  if (!host) return false;
  const revocation = await revokePairedDevice({ id: host.id }, "self", { profileEnd: "unpaired" });
  console.log(`[family] Hôte de profils ${host.id} fermé : déconnexion du compte`);
  return revocation !== null;
}

/** Cette session de profil vient-elle d'un hôte hors TV (un bureau) ? Base
 *  muette : l'appelant décide (lève). */
export async function isPickerProfileSession(pairingId: string | undefined): Promise<boolean> {
  if (!pairingId) return false;
  const parent = await getPrisma().pairedDevice.findUnique({ where: { id: pairingId }, select: { platform: true, parentId: true } });
  return !!parent && !parent.parentId && !!parent.platform;
}

/** Le balayage : les hôtes abandonnés depuis `PICKER_HOST_IDLE_MS`, révoqués
 *  avec leurs sessions de profil. Rend leur nombre. */
export async function sweepIdlePickerHosts(now: number): Promise<number> {
  const stale = await getPrisma().pairedDevice.findMany({
    where: { parentId: null, platform: { not: null }, lastSeen: { lt: new Date(now - PICKER_HOST_IDLE_MS) } },
    select: { id: true },
  });
  let count = 0;
  for (const host of stale) if (await revokePairedDevice({ id: host.id }, "self", { profileEnd: "unpaired" })) count += 1;
  return count;
}
