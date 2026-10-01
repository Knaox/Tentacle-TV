import { getPrisma, hasPrisma } from "./db";
import { pairedDeviceIdForHash } from "./deviceSessions/deviceAuth";
import { hashToken } from "./jwt";
import { cleanupJellyfinDevice, noteJellyfinDevice, settleJellyfinDevice } from "./jellyfinDeviceCleanup";
import { mintJellyfinToken } from "./jellyfinQuickConnect";

/**
 * Le jeton Jellyfin PROPRE d'une TV jumelée : frappé pour elle seule
 * (`jellyfinQuickConnect.ts`), sur l'identifiant que le serveur dérive pour
 * elle, et rangé avec cet identifiant (`paired_devices.jellyfinDeviceId`).
 *
 * Frappé au jumelage, ou au premier contact d'un jumelage d'avant — dont le
 * jeton, copié d'un autre appareil du compte, n'est plus jamais rendu.
 *
 * - Une frappe à la fois par jumelage : les reports de lecture et la
 *   configuration du direct arrivent ensemble, et deux frappes pour le même
 *   appareil se remplaceraient l'une l'autre chez Jellyfin.
 * - Journalisée AVANT (`jellyfinDeviceCleanup.ts`) : un plantage entre la
 *   frappe et l'enregistrement ne laisse pas d'appareil orphelin chez Jellyfin.
 * - Rangée seulement si le jumelage existe encore : révoqué pendant la frappe,
 *   l'appareil frappé est aussitôt supprimé de Jellyfin.
 * - Quick Connect coupé : on ne le redemande pas avant dix minutes ; la TV
 *   passe par le proxy, sans jeton Jellyfin.
 */

const DISABLED_BACKOFF_MS = 10 * 60_000;

let disabledUntil = 0;
const inflight = new Map<string, Promise<string | null>>();

export interface PairingOwner {
  jellyfinUserId: string;
  /** Le nom de la TV, montré par le tableau de bord de Jellyfin. */
  name: string;
}

export function ensureOwnJellyfinToken(tokenHash: string, owner: PairingOwner): Promise<string | null> {
  const running = inflight.get(tokenHash);
  if (running) return running;
  const task = mint(tokenHash, owner)
    .catch(() => null)
    .finally(() => inflight.delete(tokenHash));
  inflight.set(tokenHash, task);
  return task;
}

/** Au jumelage : la frappe part en tâche de fond. La TV qui demande sa
 *  configuration juste après rejoint la frappe en cours. */
export function provisionOwnJellyfinToken(deviceJwt: string, owner: PairingOwner): void {
  void ensureOwnJellyfinToken(hashToken(deviceJwt), owner);
}

async function mint(tokenHash: string, owner: PairingOwner): Promise<string | null> {
  if (!hasPrisma() || Date.now() < disabledUntil) return null;
  const jellyfinDeviceId = await pairedDeviceIdForHash(tokenHash);
  await noteJellyfinDevice(jellyfinDeviceId, tokenHash, "minting");

  const outcome = await mintJellyfinToken({ userId: owner.jellyfinUserId, deviceId: jellyfinDeviceId, deviceName: owner.name });
  if (!outcome.ok) {
    if (outcome.reason === "disabled") disabledUntil = Date.now() + DISABLED_BACKOFF_MS;
    // Rien de créé chez Jellyfin : rien à faire disparaître. Sinon, le balayeur s'en charge.
    if (!outcome.authorized) await settleJellyfinDevice(jellyfinDeviceId);
    return null;
  }

  const { count } = await getPrisma()
    .pairedDevice.updateMany({ where: { tokenHash }, data: { jellyfinAccessToken: outcome.accessToken, jellyfinDeviceId } })
    .catch(() => ({ count: 0 }));
  if (count === 0) {
    void cleanupJellyfinDevice(jellyfinDeviceId).catch(() => false);
    return null;
  }
  await settleJellyfinDevice(jellyfinDeviceId).catch(() => {});
  return outcome.accessToken;
}

/** Tests uniquement. */
export function resetOwnJellyfinTokenForTests(): void {
  disabledUntil = 0;
  inflight.clear();
}
