import { FULL_PLAYBACK_RIGHTS, type PlaybackRights } from "../../playback/playbackRights";
import { getAccountPlaybackPolicy } from "./accountPlaybackPolicy";
import { isLocalAddress } from "./localAddress";
import { jellyfinLocalSubnets, serverRemoteBitrateLimit } from "./serverNetwork";

/**
 * Les droits de lecture d'un compte, tels qu'ils valent pour UN client
 * (docs/DROITS-UTILISATEURS.md § 9.2) : la politique Jellyfin du compte, et le
 * plafond des clients distants jugé sur l'adresse RÉELLE du client
 * (`getRealClientIp`) — derrière le proxy, Jellyfin ne voit que Tentacle, une
 * adresse locale, et ne l'appliquerait jamais.
 *
 * Plafond : celui du compte, sinon celui du serveur (`GetMaxBitrate` de
 * Jellyfin) ; seulement pour un client que Jellyfin tiendrait pour distant.
 * Politique illisible : tous les droits, comme avant — Jellyfin décide.
 */
export async function playbackRightsFor(userId: string, clientIp: string): Promise<PlaybackRights> {
  const policy = await getAccountPlaybackPolicy(userId);
  if (!policy) return FULL_PLAYBACK_RIGHTS;
  const limit = policy.remoteClientBitrateLimit > 0 ? policy.remoteClientBitrateLimit : await serverRemoteBitrateLimit();
  const remote = limit > 0 && !isLocalAddress(clientIp, await jellyfinLocalSubnets());
  return {
    mediaPlayback: policy.enableMediaPlayback,
    videoTranscoding: policy.enableVideoPlaybackTranscoding,
    audioTranscoding: policy.enableAudioPlaybackTranscoding,
    remuxing: policy.enablePlaybackRemuxing,
    maxBitrate: remote ? limit : null,
  };
}

/** Rien à garder : la lecture et toutes les conversions permises, aucun plafond. */
export function isUnrestricted(rights: PlaybackRights): boolean {
  return rights.mediaPlayback && rights.videoTranscoding && rights.audioTranscoding && rights.remuxing && rights.maxBitrate === null;
}

export {
  forgetAccountPlaybackPolicy,
  getAccountPlaybackPolicy,
  playbackPolicyFromJellyfin,
  watchPlaybackPolicyWrites,
} from "./accountPlaybackPolicy";
export { isLocalAddress } from "./localAddress";
