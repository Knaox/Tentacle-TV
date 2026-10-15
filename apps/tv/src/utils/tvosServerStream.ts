import type { JellyfinClient } from "@tentacle-tv/api-client";
import { buildTvosDeviceProfile } from "../lib/tvosDeviceProfile";
import { getHdrCapabilities } from "../lib/hdrCapabilities";
import { randomSessionId } from "./playerHelpers";
import { plog } from "./playerDiag";
import {
  AVPLAYER_ENGINE, SAFE_FALLBACK_ENGINE, builtUrlRefusal, servedReasons, withHdr,
  type PlaybackRefusal, type PlaybackRights,
} from "@tentacle-tv/shared";

export interface ServerStream {
  url: string;
  playSessionId?: string;
  isDirectPlay: boolean;
  /** Les droits de lecture du compte refusent l'URL à demander : elle ne part pas. */
  refusal?: PlaybackRefusal;
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
 *
 * Droits de lecture (docs/DROITS-UTILISATEURS.md § 9.2) : sans le droit de
 * réencoder l'image, le repli ne demande qu'une COPIE (changement de conteneur)
 * au lieu du HLS 8 Mb/s réencodé ; l'URL finale est jugée par la règle
 * partagée (`builtUrlRefusal`) avant de partir.
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
  rights?: PlaybackRights;
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
    // nouvelle tentative de ce qui vient peut-être d'échouer. Sans le droit de
    // réencoder l'image : sa copie seule, dans un conteneur qu'AVPlayer ouvre.
    const copyOnly = a.rights ? !a.rights.videoTranscoding : false;
    url = client.getStreamUrl(itemId, {
      directPlay: false, maxBitrate: copyOnly ? undefined : 8_000_000,
      audioIndex, subtitleStreamIndex: sub, burnInSubtitle: burnInIndex >= 0, playSessionId, mediaSourceId,
      transcodeReasons: reasons,
      engine: a.forceTranscode && burnInIndex < 0 && !copyOnly ? SAFE_FALLBACK_ENGINE : engine, sourceAudio,
    });
  }
  const refusal = a.rights ? builtUrlRefusal(a.rights, url, ms) : null;
  if (refusal) {
    plog("stream", `PlaybackInfo → refusé par les droits du compte (${refusal})`);
    return { url: "", isDirectPlay: false, refusal };
  }
  plog("stream", `PlaybackInfo → ${directPlay ? "direct play serveur" : "transcode HLS"} (audio=${audioIndex})`);
  return { url, playSessionId, isDirectPlay: directPlay };
}
