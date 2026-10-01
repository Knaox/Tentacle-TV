import { resolvePairedDeviceToken } from "../deviceTokenHealth";
import { verifyDeviceToken, verifyImpersonationToken } from "../jwt";
import { pairedIdentity, type DeviceAuth, type PairedLabels } from "./deviceAuth";

/**
 * Au nom de qui le canal parle pour une connexion `/api/ws`.
 *
 * - Le web (cookie) et le bureau (bearer) s'authentifient avec le jeton
 *   Jellyfin LUI-MÊME, obtenu par `/api/auth/login` : c'est lui, seul.
 * - Un appareil jumelé présente un JWT : son jeton Jellyfin PROPRE, frappé
 *   pour lui sur l'identifiant que le serveur dérive (`deviceAuth.ts`) — la
 *   même règle que le proxy de lecture. Pas de jeton (Quick Connect coupé) :
 *   pas de canal, le lecteur garde ses reports HTTP.
 * - Une session « voir en tant que » n'a aucun jeton Jellyfin de l'usurpé :
 *   pas de canal, le lecteur garde ses reports HTTP.
 */
export async function resolveDeviceAuth(authToken: string, labels: PairedLabels = {}): Promise<DeviceAuth | null> {
  const device = await verifyDeviceToken(authToken);
  if (device) {
    // Son jeton propre — jamais celui d'un autre appareil (cf. `resolvePairedDeviceToken`).
    const token = await resolvePairedDeviceToken(authToken, device.userId);
    if (token === null) return null;
    return { token, identity: await pairedIdentity(authToken, labels) };
  }
  if (await verifyImpersonationToken(authToken)) return null;
  return { token: authToken };
}
