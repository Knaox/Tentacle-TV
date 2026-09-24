import { resolvePairedDeviceToken } from "../deviceTokenHealth";
import { verifyDeviceToken, verifyImpersonationToken } from "../jwt";

/**
 * Le jeton Jellyfin au nom duquel le canal parle pour une connexion `/api/ws`.
 *
 * - Le web (cookie) et le bureau (bearer) s'authentifient avec le jeton
 *   Jellyfin LUI-MÊME, obtenu par `/api/auth/login` : c'est lui.
 * - Un appareil jumelé présente un JWT : son jeton Jellyfin est en base
 *   (`PairedDevice.jellyfinAccessToken`) s'il est de son compte, à défaut
 *   celui, valide, d'un autre appareil du même compte — la même règle que le
 *   proxy de lecture.
 * - Une session « voir en tant que » n'a aucun jeton Jellyfin de l'usurpé :
 *   pas de canal, le lecteur garde ses reports HTTP.
 */
export async function resolveJellyfinToken(authToken: string): Promise<string | null> {
  const device = await verifyDeviceToken(authToken);
  if (device) {
    // Le jeton de l'appareil s'il est de SON compte, sinon celui d'un frère du
    // même compte — jamais celui d'un autre (cf. `resolvePairedDeviceToken`).
    const { token } = await resolvePairedDeviceToken(authToken, device.userId);
    return token;
  }
  if (await verifyImpersonationToken(authToken)) return null;
  return authToken;
}
