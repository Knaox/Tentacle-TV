import { readProfileRecord, soloStillHolds, tvSessionMode } from "@tentacle-tv/tv-core";
import { loadProfiles } from "./profileOpening";
import { leaveProfile } from "./profileSession";
import { unpairDevice, type UnpairContext } from "./unpair";

/**
 * Une session `solo` (le compte de la TV, dans aucune famille et sans PIN,
 * ouvert d'office — tv-core `soloProfile`) se reprend au démarrage SANS
 * attendre le serveur : l'accueil s'ouvre aussitôt. Sa vérification vient
 * ensuite, en fond : la famille a pu naître pendant que l'app dormait (un
 * invité créé ailleurs, une invitation acceptée), ou un PIN se poser — la TV
 * repasse alors par « Qui regarde ? ». Serveur muet : la session reste, ses
 * portes trancheront.
 */
export async function confirmSoloSession(context: UnpairContext): Promise<void> {
  if (tvSessionMode(context.storage) !== "profile") return;
  const record = readProfileRecord(context.storage);
  if (record?.launch !== "solo") return;
  const loaded = await loadProfiles(context);
  // La session a pu changer pendant la lecture (« Changer de profil », déjumelage).
  if (readProfileRecord(context.storage)?.profileId !== record.profileId) return;
  if (!loaded.ok) {
    if (loaded.refusal.kind === "unpaired") unpairDevice(context, "revoked");
    return;
  }
  if (!soloStillHolds(loaded.listing, record.profileId)) leaveProfile(context, "launch");
}
