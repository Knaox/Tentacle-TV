import type { JellyfinClient } from "@tentacle-tv/api-client";
import { buildTvosDeviceProfile } from "../lib/tvosDeviceProfile";
import { getHdrCapabilities } from "../lib/hdrCapabilities";
import { randomSessionId } from "./playerHelpers";
import { plog } from "./playerDiag";
import { AVPLAYER_ENGINE, SAFE_FALLBACK_ENGINE, servedReasons, withHdr } from "@tentacle-tv/shared";

export interface ServerStream {
  url: string;
  playSessionId?: string;
  isDirectPlay: boolean;
}

/**
 * Le chemin SERVEUR de tvOS, quand PrismCore ne s'applique pas ou refuse :
 * `POST PlaybackInfo` + DeviceProfile AVPlayer — le serveur décide lecture
 * directe ou transcodage. L'URL, elle, est fabriquée par `getStreamUrl` (et
 * non à la main) : réécriture proxy et authentification, la clé du correctif
 * -1013. Timeline absolue : la reprise passe par le fragment `#tnt-start`,
 * jamais par `StartTimeTicks`.
 *
 * `null` : le serveur n'a rendu aucune source. Lève sur une erreur réseau.
 */
export async function resolveServerStream(a: {
  client: JellyfinClient;
  userId: string;
  itemId: string;
  mediaSourceId?: string;
  audioIndex: number;
  /** Sous-titre IMAGE à incruster (PGS/VOBSUB/DVB), -1 sinon. */
  burnInIndex: number;
  forceTranscode: boolean;
  isTranscodingQuality: boolean;
  maxBitrate?: number;
  maxHeight?: number;
}): Promise<ServerStream | null> {
  const { client, itemId, mediaSourceId, audioIndex, burnInIndex, isTranscodingQuality, maxBitrate, maxHeight } = a;
  // Un preset de qualité OU un fallback codec force le transcode (DirectPlayProfiles vidés).
  const cap = isTranscodingQuality && maxBitrate ? maxBitrate : undefined;
  // burnInIndex >= 0 ⇒ sous-titre IMAGE sélectionné : profil sans livraison
  // texte → le serveur INCRUSTE ce sous-titre. Le texte (ASS inclus) n'incruste
  // plus jamais : l'overlay JS interprète le VTT (parser partagé).
  // Capacités de décodage HDR/DV de cette Apple TV (module natif, mis en
  // cache) → gate le VideoRangeType du profil pour préserver un vrai signal
  // HDR/Dolby Vision au lieu d'un tone-mapping serveur vers SDR.
  const hdr = await getHdrCapabilities();
  const profile = buildTvosDeviceProfile(cap, a.forceTranscode || isTranscodingQuality, burnInIndex >= 0, hdr);

  const info = await client.getPlaybackInfo(itemId, {
    userId: a.userId, deviceProfile: profile, mediaSourceId,
    audioStreamIndex: audioIndex,
    subtitleStreamIndex: burnInIndex >= 0 ? burnInIndex : undefined,
    startTimeTicks: 0, // timeline absolue (reprise via #tnt-start)
    maxStreamingBitrate: cap,
    maxHeight: isTranscodingQuality && maxHeight ? maxHeight : undefined,
  });
  const ms = info.MediaSources?.[0];
  if (!ms) return null;

  const directPlay = !!ms.SupportsDirectPlay && !ms.TranscodingUrl;
  // AVPlayer, avec ce que CETTE box décode (Dolby Vision selon le modèle) — la
  // règle partagée (`planStream`) en tire codec de sortie, segments fMP4 et son.
  const engine = withHdr(AVPLAYER_ENGINE, { hdr10: hdr.hdr10, hdr10Plus: hdr.hdr10, hlg: hdr.hlg, dolbyVision: hdr.dolbyVision });
  const sourceAudio = ms.MediaStreams?.find((s) => s.Type === "Audio" && s.Index === audioIndex) ?? null;
  const sub = burnInIndex >= 0 ? burnInIndex : undefined;
  // playSessionId stable en transcode (suivi), inutile en direct play.
  const playSessionId = directPlay ? undefined : (info.PlaySessionId ?? randomSessionId());

  let url: string;
  if (directPlay) {
    url = client.getStreamUrl(itemId, { directPlay: true, mediaSourceId });
  } else if (isTranscodingQuality && maxBitrate) {
    url = client.getStreamUrl(itemId, {
      directPlay: false, maxBitrate, maxHeight,
      audioIndex, subtitleStreamIndex: sub, burnInSubtitle: burnInIndex >= 0, playSessionId, mediaSourceId,
      engine, sourceAudio,
    });
  } else {
    // Fallback codec : HLS 8 Mbps (parité avec le fallback Android). La raison
    // part avec l'URL refabriquée : celle du repli, sinon celles que Jellyfin
    // vient de donner (codec hors profil…) — jamais un plafond inventé.
    const served = servedReasons(ms);
    const reasons = a.forceTranscode
      ? [burnInIndex >= 0 ? "SubtitleCodecNotSupported" : "DirectPlayError"]
      : served.length > 0 ? served : ["DirectPlayError"];
    // Après une erreur de lecture : le repli sûr (H.264 + AAC en TS), jamais une
    // nouvelle tentative de ce qui vient peut-être d'échouer.
    url = client.getStreamUrl(itemId, {
      directPlay: false, maxBitrate: 8_000_000,
      audioIndex, subtitleStreamIndex: sub, burnInSubtitle: burnInIndex >= 0, playSessionId, mediaSourceId,
      transcodeReasons: reasons,
      engine: a.forceTranscode && burnInIndex < 0 ? SAFE_FALLBACK_ENGINE : engine, sourceAudio,
    });
  }
  plog("stream", `PlaybackInfo → ${directPlay ? "direct play serveur" : "transcode HLS"} (audio=${audioIndex})`);
  return { url, playSessionId, isDirectPlay: directPlay };
}
