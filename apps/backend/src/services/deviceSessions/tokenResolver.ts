import { resolvePairedDeviceToken } from "../deviceTokenHealth";
import { verifyDeviceToken, verifyImpersonationToken } from "../jwt";
import { pairedIdentity, type DeviceAuth, type PairedLabels } from "./deviceAuth";

/**
 * Au nom de qui le canal parle pour une connexion `/api/ws`.
 *
 * - Le web (cookie) et le bureau (bearer) s'authentifient avec le jeton
 *   Jellyfin LUI-MÊME, obtenu par `/api/auth/login` : c'est lui, seul.
 * - Un appareil jumelé présente un JWT : son jeton Jellyfin est en base
 *   (`PairedDevice.jellyfinAccessToken`) s'il est de son compte, à défaut
 *   celui, valide, d'un autre appareil du même compte — la même règle que le
 *   proxy de lecture. Ce jeton étant emprunté, l'identité présentée est celle
 *   que le serveur dérive pour l'appareil (`deviceAuth.ts`).
 * - Une session « voir en tant que » n'a aucun jeton Jellyfin de l'usurpé :
 *   pas de canal, le lecteur garde ses reports HTTP.
 */
export async function resolveDeviceAuth(authToken: string, labels: PairedLabels = {}): Promise<DeviceAuth | null> {
  const device = await verifyDeviceToken(authToken);
  if (device) {
    // Le jeton de l'appareil s'il est de SON compte, sinon celui d'un frère du
    // même compte — jamais celui d'un autre (cf. `resolvePairedDeviceToken`).
    const { token } = await resolvePairedDeviceToken(authToken, device.userId);
    if (token === null) return null;
    return { token, identity: await pairedIdentity(authToken, labels) };
  }
  if (await verifyImpersonationToken(authToken)) return null;
  return { token: authToken };
}
