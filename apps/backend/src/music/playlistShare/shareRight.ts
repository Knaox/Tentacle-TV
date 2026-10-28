/**
 * Octave — QUI peut se servir des liens de partage de playlist (règle 15 : sans le droit, rien) : une vraie
 * session (jamais « voir en tant que »), jamais un invité de la Famille (il n'a aucun lien de partage, comme
 * pour Ma liste), et le droit « Partage public » du compte (`EnablePublicSharing` : la source du bureau, qui
 * garde TOUT lien public). Vaut pour CRÉER un lien et pour IMPORTER celui d'un autre serveur.
 */

import { isFamilyGuest } from "../../services/family/familyGuestMarkers";
import { mayShareInPublic } from "../../services/share/publicSharingRight";
import type { JellyfinUser } from "../../middleware/auth";

export async function mayUsePlaylistShares(user: Pick<JellyfinUser, "userId" | "session">): Promise<boolean> {
  if (user.session === "impersonation") return false;
  if (user.session === "tvProfile" && (await isFamilyGuest(user.userId).catch(() => true))) return false;
  return mayShareInPublic(user.userId);
}
