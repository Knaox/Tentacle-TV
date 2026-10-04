import { fetchTvProfiles } from "@tentacle-tv/api-client";
import { coldStartProfile, planProfileLaunch, readProfileRecord } from "@tentacle-tv/tv-core";
import { sameUserId } from "@tentacle-tv/shared";
import { pairingCall } from "./profileOpening";
import { leaveSessionAtBoot } from "./profileSession";
import type { UnpairContext } from "./unpair";

/** Le temps laissé au serveur pour dire, au démarrage, si la TV a toujours un seul profil. */
const BOOT_CHECK_MS = 2_500;

/**
 * Au démarrage à froid, une session ouverte parce qu'elle était celle du SEUL
 * profil de la TV ne se reprend que s'il l'est toujours : la famille a pu
 * grandir pendant que l'app dormait (un invité créé ailleurs, une invitation
 * acceptée sur un téléphone). Sinon, « Qui regarde ? » — dès deux profils, la
 * règle du lancement. Serveur muet : la session se reprend, comme avant.
 */
export async function confirmSingleProfileAtBoot(storage: UnpairContext["storage"]): Promise<void> {
  if (coldStartProfile(storage) !== "resume") return;
  const record = readProfileRecord(storage);
  const call = pairingCall(storage);
  if (record?.launch !== "single" || !call) return;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), BOOT_CHECK_MS);
  try {
    const listing = await fetchTvProfiles({ ...call, signal: controller.signal });
    const plan = planProfileLaunch(listing, "launch", Date.now());
    if (plan.kind === "open" && sameUserId(plan.profileId, record.profileId)) return;
    leaveSessionAtBoot(storage);
  } catch {
    // Hors ligne, ou refus : la session reste ; les portes du serveur trancheront.
  } finally {
    clearTimeout(timer);
  }
}
