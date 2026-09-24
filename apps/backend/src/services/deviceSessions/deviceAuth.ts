import { buildAuthHeader, deviceIdForOpaque } from "../jellyfinIdentity";
import { hashToken } from "../jwt";

/**
 * Au nom de qui le canal de session parle à Jellyfin.
 *
 * Web, bureau et mobile se sont authentifiés eux-mêmes : leur jeton est lié à
 * LEUR appareil, et un en-tête qui ne porte que le jeton laisse Jellyfin en
 * tirer Client et DeviceId — la session touchée est la leur.
 *
 * Un appareil JUMELÉ (TV native, LG) n'a jamais ouvert de session Jellyfin :
 * il porte la copie du jeton d'un autre appareil du compte. Au jeton seul, la
 * connexion du canal s'accrochait donc à la session de CET appareil-là (le
 * téléphone qui a confirmé le jumelage), et la TV restait, dans le tableau de
 * bord, une session sans télécommande. Il faut présenter l'identité de la TV.
 *
 * Mais Jellyfin range ses sessions par (Client, DeviceId) et réattribue une
 * session à quiconque annonce ce couple : un DeviceId choisi par le client
 * offrirait la session d'un autre. Celui d'un appareil jumelé est donc DÉRIVÉ
 * ici, du hachage de son jeton de jumelage par la clé secrète du serveur
 * (`deviceIdForOpaque`) ; la TV l'apprend par `/api/config/streaming` et
 * l'adopte pour ses propres requêtes — une seule session, la sienne. Client,
 * nom et version ne sont que des étiquettes : avec un identifiant unique et
 * non falsifiable, ils ne désignent aucune autre session.
 */

export interface DeviceIdentity {
  client: string;
  device: string;
  deviceId: string;
  version: string;
}

export interface DeviceAuth {
  token: string;
  /** Absent : le jeton est celui de l'appareil (web, bureau, mobile). */
  identity?: DeviceIdentity;
}

/** Ce qu'un appareil jumelé dit de lui dans son `session:hello`. */
export interface PairedLabels {
  client?: string;
  device?: string;
  appVersion?: string;
}

/** L'identifiant Jellyfin d'un appareil jumelé : stable le temps du jumelage,
 *  unique, et impossible à fabriquer sans la clé du serveur. */
export function pairedJellyfinDeviceId(pairingJwt: string): Promise<string> {
  return deviceIdForOpaque("paired", hashToken(pairingJwt));
}

export async function pairedIdentity(pairingJwt: string, labels: PairedLabels): Promise<DeviceIdentity> {
  return {
    client: labels.client ?? "Tentacle TV - TV",
    device: labels.device ?? "TV",
    deviceId: await pairedJellyfinDeviceId(pairingJwt),
    version: labels.appVersion ?? "1.0.0",
  };
}

export function tokenOnlyAuthHeader(token: string): string {
  return `MediaBrowser Token="${token.replace(/[^A-Za-z0-9._~-]/g, "")}"`;
}

export function deviceAuthHeader(auth: DeviceAuth): string {
  if (!auth.identity) return tokenOnlyAuthHeader(auth.token);
  return buildAuthHeader({
    client: auth.identity.client,
    device: auth.identity.device,
    deviceId: auth.identity.deviceId,
    version: auth.identity.version,
    token: auth.token.replace(/[^A-Za-z0-9._~-]/g, ""),
  });
}
