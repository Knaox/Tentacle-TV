import { getPrisma } from "../db";
import type { SetOwnPinBody } from "../../family/familyContract";
import { refuseReviewAccount } from "./familyConfig";
import { FamilyFailure } from "./familyErrors";
import { isFamilyGuest } from "./familyGuestMarkers";
import type { Actor } from "./familyInvitations";
import { familyUpdate, notifyFamily } from "./familyNotify";
import { changeOwnPin } from "./familyPins";
import { endProfileElsewhere, endProfileEverywhere } from "./familySessions";
import { familyOf } from "./familyStore";

/**
 * Son propre code PIN (`setOwnPin`, docs/FAMILLE.md) — en session personnelle
 * (web, bureau, mobile), ou depuis SA session de profil sur une TV. L'acteur
 * est toujours celui du jeton : on ne change jamais que le sien.
 *
 * - Jamais un invité : son PIN est celui que pose son propriétaire ou son
 *   créateur (`setGuestPin`). Jamais le compte de démonstration : un PIN
 *   posé par un relecteur fermerait le profil au suivant.
 * - Le PIN actuel d'abord, dès que le compte en a un — vérifié comme à
 *   l'ouverture d'un profil : même compteur par profil, même blocage.
 * - Ses sessions de profil tombent sur TOUTES les TV, et son « Ne plus
 *   proposer à l'ouverture » avec — sauf la session de TV qui agit, qui garde
 *   l'une et l'autre.
 */

export interface OwnPinCaller extends Actor {
  /** Le hachage du jeton de SA session de profil, si le geste vient d'une TV ;
   *  null en session personnelle. */
  tvSessionTokenHash: string | null;
}

/** La session de profil qui agit, et le jumelage de sa TV. */
async function actingSession(tokenHash: string): Promise<{ sessionId: string; pairingId: string }> {
  const session = await getPrisma().pairedDevice.findUnique({ where: { tokenHash }, select: { id: true, parentId: true } });
  if (!session?.parentId) throw new FamilyFailure("family.profile_unavailable", "Session de profil introuvable");
  return { sessionId: session.id, pairingId: session.parentId };
}

export async function setOwnPin(caller: OwnPinCaller, body: SetOwnPinBody, now: number): Promise<{ hasPin: boolean }> {
  if (await isFamilyGuest(caller.userId)) {
    throw new FamilyFailure("family.guest_account", "Le PIN d'un invité est posé par son propriétaire");
  }
  await refuseReviewAccount(caller.userId);
  const keep = caller.tvSessionTokenHash ? await actingSession(caller.tvSessionTokenHash) : null;
  await changeOwnPin({ pairingId: keep?.pairingId ?? null, userId: caller.userId, pin: body.currentPin, next: body.pin, now });
  if (keep) await endProfileElsewhere(caller.userId, keep, "pin_changed");
  else await endProfileEverywhere(caller.userId, "pin_changed");
  const mine = await familyOf(caller.userId);
  if (mine) await notifyFamily(mine.family.id);
  else familyUpdate([caller.userId], "family");
  console.log(`[family] PIN personnel ${body.pin === null ? "retiré" : "posé"} (${keep ? "depuis une TV" : "session personnelle"})`);
  return { hasPin: body.pin !== null };
}
