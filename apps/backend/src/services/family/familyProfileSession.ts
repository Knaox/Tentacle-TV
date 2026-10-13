import { getPrisma } from "../db";
import { provisionOwnJellyfinToken } from "../deviceJellyfinToken";
import { revokePairedDevice } from "../deviceRevocation";
import { hashToken, signProfileSessionToken } from "../jwt";
import type { FamilyProfileKind } from "../../family/familyContract";
import type { FamilyProfileEndReason } from "../../family/familyProtocol";

/**
 * Ouvrir une SESSION DE PROFIL sur un appareil — une TV (son jumelage) ou un
 * bureau (son hôte, `familyPickerHosts.ts`) : la même mécanique partout
 * (docs/FAMILLE.md). La session est une ligne ENFANT de l'appareil ; son jeton,
 * un jeton d'appareil au nom du profil (jamais administrateur), qui passe
 * toutes les portes comme un jumelage et cesse avec sa ligne.
 *
 * Une seule session de profil par appareil : la précédente se ferme
 * (`family:profile-ended` `replaced`) AVANT que la nouvelle ne naisse. Le
 * jeton Jellyfin PROPRE de la session (Quick Connect) est frappé en fond,
 * pour les reports de lecture et le canal de session — côté serveur ; un
 * bureau ne le reçoit jamais (`/api/config/streaming`).
 */

/** Ferme les sessions de profil d'un appareil (une au plus, en principe). */
export async function closeProfileSessions(parentId: string, reason: FamilyProfileEndReason): Promise<number> {
  const sessions = await getPrisma().pairedDevice.findMany({ where: { parentId }, select: { id: true } });
  let closed = 0;
  for (const session of sessions) {
    if (await revokePairedDevice({ id: session.id }, "family", { profileEnd: reason })) closed += 1;
  }
  return closed;
}

export async function startProfileSession(
  parent: { id: string; name: string; platform?: string | null },
  profile: { userId: string; name: string; kind: FamilyProfileKind },
): Promise<string> {
  await closeProfileSessions(parent.id, "replaced");
  const token = await signProfileSessionToken({
    userId: profile.userId,
    username: profile.name,
    pairingId: parent.id,
    // Un hôte hors TV (le bureau) : la plateforme est signée avec le jeton.
    ...(parent.platform && { platform: parent.platform }),
  });
  await getPrisma().pairedDevice.create({
    data: {
      name: parent.name,
      jellyfinUserId: profile.userId,
      username: profile.name,
      tokenHash: hashToken(token),
      parentId: parent.id,
      profileKind: profile.kind,
    },
  });
  // Son propre jeton Jellyfin (Quick Connect), sur l'identifiant de CETTE session.
  provisionOwnJellyfinToken(token, { jellyfinUserId: profile.userId, name: parent.name });
  return token;
}
