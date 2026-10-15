import type { DeviceProfile } from "@tentacle-tv/shared";
import {
  buildBrowserDeviceProfile, buildMacOSDeviceProfile, buildMpvDeviceProfile,
  type WebProfileOptions,
} from "../lib/deviceProfile";

/**
 * Le profil décrit QUI LIT, et mpv ne lit pas comme un navigateur : lui envoyer
 * les capacités de Chromium faisait remuxer en HLS tout MKV — donc tout contenu
 * lourd — pour un lecteur qui l'aurait ouvert tel quel.
 *
 * Hors du hook : `fetchPlaybackInfo` est mémoïsé, et une fonction refermée sur
 * le rendu s'y serait figée.
 */
export function buildProfile(
  nativePlayer: boolean, isMacOSTauri: boolean, bitrate?: number, options?: WebProfileOptions,
): DeviceProfile {
  // mpv lit tout, y compris les sous-titres image : aucune capacité à lui
  // retirer, les drapeaux de repli ne concernent que les lecteurs web.
  if (nativePlayer) return buildMpvDeviceProfile(bitrate);
  if (isMacOSTauri) return buildMacOSDeviceProfile(bitrate, options);
  return buildBrowserDeviceProfile(bitrate, options);
}

/**
 * Les plages dynamiques que le profil ENVOYÉ déclare.
 *
 * Lues dans le profil, et non redemandées à une sonde. Les deux répondaient la
 * même chose tant qu'il n'y avait que des navigateurs : la sonde EST ce qui
 * construit le profil. Sur un téléviseur, le profil est substitué à la
 * compilation et interroge `deviceInfo` — la sonde, elle, continuait de décrire
 * Chromium. Le verdict jugeait donc le tone mapping sur des capacités qui
 * n'étaient pas celles qu'on avait annoncées au serveur, et le journal de
 * diagnostic mentait à l'endroit précis où on venait le consulter.
 */
export function profileRanges(profile: DeviceProfile): string[] {
  for (const codec of profile.CodecProfiles ?? []) {
    if (codec.Type !== "Video") continue;
    const condition = codec.Conditions.find((c) => c.Property === "VideoRangeType");
    if (condition) return condition.Value.split("|");
  }
  return [];
}
