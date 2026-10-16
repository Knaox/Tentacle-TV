import { getPrisma, hasPrisma } from "../db";
import { isReviewAccount } from "../family/familyConfig";

/**
 * Une TV peut-elle poser la photo de SON compte (galerie des avatars,
 * capacité `avatars.devicePhoto`) ? Oui — sauf le compte de DÉMONSTRATION,
 * celui des relecteurs d'Apple : il est partagé, sa photo ne change pas
 * (décision du 16/10). Ni lui, ni une session de profil d'une TV qu'il a
 * jumelée (ses invités sont virtuels).
 *
 * La même réponse pour le proxy, qui refuse l'écriture
 * (`jellyfinProxy/devicePhotoGuard.ts`), et pour la TV, qui n'en montre rien
 * (`GET /api/avatars/device-photo`).
 */
export async function devicePhotoAllowed(subject: { userId: string; pairingId?: string }): Promise<boolean> {
  if (await isReviewAccount(subject.userId)) return false;
  const pairedBy = subject.pairingId ? await pairingOwner(subject.pairingId) : null;
  return pairedBy === null || !(await isReviewAccount(pairedBy));
}

/** Le compte qui a jumelé la TV d'une session de profil ; null s'il ne se lit pas. */
async function pairingOwner(pairingId: string): Promise<string | null> {
  if (!hasPrisma()) return null;
  try {
    const row = await getPrisma().pairedDevice.findUnique({ where: { id: pairingId }, select: { jellyfinUserId: true } });
    return row?.jellyfinUserId ?? null;
  } catch {
    return null;
  }
}
