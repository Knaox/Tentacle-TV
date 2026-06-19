import { useEffect, useRef, useState } from "react";
import { useJellyfinClient, useUserId } from "@tentacle-tv/api-client";
import { BURN_IN_SUBTITLE_CODECS } from "@tentacle-tv/shared";
import type { MediaStream as JfStream } from "@tentacle-tv/shared";
import { randomSessionId } from "../utils/playerHelpers";
import { buildTvosDeviceProfile } from "../lib/tvosDeviceProfile";

/**
 * Variante tvOS de `useTVStreamUrl` (résolue par Metro sur iOS ; Android garde
 * `useTVStreamUrl.ts` intact). Pilotée par `POST PlaybackInfo` + DeviceProfile
 * AVPlayer : le SERVEUR décide DirectPlay / transcode (DirectStream remux,
 * re-encode…), ce qui maximise les formats lisibles par Apple TV et évite
 * l'écran noir des MKV.
 *
 * IMPORTANT : l'URL est construite via `client.getStreamUrl()` (et NON à la main)
 * afin de passer par `resolveMediaUrl` (réécriture proxy same-origin → host de
 * streaming) et l'auth — sinon AVPlayer est rejeté par le proxy (NSURL -1013).
 * Seule la DÉCISION direct/transcode vient de PlaybackInfo ; la fabrication de
 * l'URL est identique à Android.
 *
 * Timeline ABSOLUE (comme Android) : position de reprise via le fragment
 * `#tnt-start=` lu par `AVPlayerSurface` (seek client au onLoad).
 */
export function useTVStreamUrl(args: {
  itemId: string;
  mediaSourceId?: string;
  streams: JfStream[];
  audioIndex: number;
  subtitleIndex?: number;
  startTicks: number;
  startSeconds?: number;
  forceTranscode: boolean;
  isTranscodingQuality: boolean;
  maxBitrate?: number;
  maxHeight?: number;
  isDirectPlay: boolean;
  /** Compteur de reload explicite (transcode) : changement de piste audio non
   *  couplé à la position. Le bumper force un refetch PlaybackInfo. */
  reloadNonce?: number;
}) {
  const {
    itemId, mediaSourceId, streams, audioIndex, subtitleIndex, startTicks,
    startSeconds, forceTranscode, isTranscodingQuality, maxBitrate, maxHeight,
  } = args;
  const client = useJellyfinClient();
  const userId = useUserId();

  // On stocke l'URL de BASE (sans fragment de reprise). Le fragment `#tnt-start`
  // est ajouté en DÉRIVÉ à partir du `startSeconds` LIVE (cf. plus bas) : au cold
  // start, l'effet construit l'URL avant que `item.UserData` soit chargé
  // (startSeconds=0) ; lire la position via une ref figeait alors une URL SANS
  // reprise, jamais reconstruite → lecture à 0. En dérivant le fragment, il
  // reflète toujours la position courante au montage du player.
  const [result, setResult] = useState<{
    baseUrl: string | null;
    playSessionId?: string;
    isDirectPlay: boolean;
  }>({ baseUrl: null, isDirectPlay: true });

  // Lus au moment du fetch sans être des déclencheurs (le switch audio en direct
  // play est natif ; en transcode, c'est `startTicks` (captureReloadTicks) qui
  // déclenche le refetch et embarque l'audioIndex courant).
  const audioRef = useRef(audioIndex);
  audioRef.current = audioIndex;

  // Seul un sous-titre IMAGE (burn-in) reconstruit l'URL ; les sous-titres texte
  // passent par l'overlay JS (aucun refetch).
  const burnInIndex = subtitleIndex != null && subtitleIndex >= 0
    && BURN_IN_SUBTITLE_CODECS.test(
      streams.find((s) => s.Type === "Subtitle" && s.Index === subtitleIndex)?.Codec ?? "",
    )
    ? subtitleIndex
    : -1;

  const fetchIdRef = useRef(0);
  // Clé de CONTENU : ne change qu'au changement d'item/source (≠ changement de
  // piste/qualité). Permet de distinguer un reload « dur » (nouveau contenu →
  // écran de chargement) d'un reload « doux » (audio/qualité → on GARDE l'ancienne
  // URL pour ne pas démonter le player ; juste un re-buffer discret).
  const contentKeyRef = useRef("");

  useEffect(() => {
    if (!itemId || !userId) return;
    const fetchId = ++fetchIdRef.current;
    const contentKey = `${itemId}|${mediaSourceId ?? ""}`;
    const softReload = contentKeyRef.current === contentKey;
    contentKeyRef.current = contentKey;
    // Reload doux (même contenu) : conserver l'URL courante jusqu'à la nouvelle
    // (le player reste monté, dernière image visible). Reload dur : null →
    // écran de chargement plein écran (PlayerScreen).
    if (!softReload) setResult((r) => ({ ...r, baseUrl: null }));

    (async () => {
      try {
        // Un preset de qualité OU un fallback codec force le transcode (DirectPlayProfiles vidés).
        const cap = isTranscodingQuality && maxBitrate ? maxBitrate : undefined;
        const profile = buildTvosDeviceProfile(cap, forceTranscode || isTranscodingQuality);

        const info = await client.getPlaybackInfo(itemId, {
          userId, deviceProfile: profile, mediaSourceId,
          audioStreamIndex: audioRef.current,
          subtitleStreamIndex: burnInIndex >= 0 ? burnInIndex : undefined,
          startTimeTicks: 0, // timeline absolue (reprise via #tnt-start)
          maxStreamingBitrate: cap,
          maxHeight: isTranscodingQuality && maxHeight ? maxHeight : undefined,
        });
        if (fetchIdRef.current !== fetchId) return;

        const ms = info.MediaSources?.[0];
        if (!ms) { setResult({ baseUrl: null, isDirectPlay: false }); return; }

        const directPlay = !!ms.SupportsDirectPlay && !ms.TranscodingUrl;
        const sub = burnInIndex >= 0 ? burnInIndex : undefined;
        // playSessionId stable en transcode (suivi), inutile en direct play.
        const playSessionId = directPlay ? undefined : (info.PlaySessionId ?? randomSessionId());

        // URL via getStreamUrl → resolveMediaUrl + auth corrects (clé du fix -1013).
        let streamUrl: string;
        if (directPlay) {
          streamUrl = client.getStreamUrl(itemId, { directPlay: true, mediaSourceId });
        } else if (isTranscodingQuality && maxBitrate) {
          streamUrl = client.getStreamUrl(itemId, {
            directPlay: false, maxBitrate, maxHeight,
            audioIndex: audioRef.current, subtitleStreamIndex: sub, playSessionId, mediaSourceId,
          });
        } else {
          // Remux / fallback codec : HLS 8 Mbps (parité avec le fallback Android).
          streamUrl = client.getStreamUrl(itemId, {
            directPlay: false, maxBitrate: 8_000_000,
            audioIndex: audioRef.current, subtitleStreamIndex: sub, playSessionId, mediaSourceId,
          });
        }

        // Base SANS fragment : la reprise est ajoutée en dérivé (startSeconds live).
        setResult({ baseUrl: streamUrl, playSessionId, isDirectPlay: directPlay });
      } catch {
        if (fetchIdRef.current !== fetchId) return;
        setResult({ baseUrl: null, isDirectPlay: false });
      }
    })();
    // startTicks = déclencheur de reload (reprise/piste/qualité) ; audioIndex et
    // startSeconds sont lus via refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId, mediaSourceId, userId, forceTranscode, isTranscodingQuality, maxBitrate, maxHeight, startTicks, burnInIndex, args.reloadNonce]);

  // Fragment de reprise ajouté EN DÉRIVÉ depuis la position LIVE (≠ ref figée au
  // fetch) → toujours correct au montage du player, y compris au cold start où
  // l'URL de base a pu être construite avant que `item.UserData` soit chargé.
  const start = startSeconds ?? 0;
  const streamUrl = result.baseUrl != null
    ? result.baseUrl + (start > 1 ? `#tnt-start=${Math.floor(start)}` : "")
    : null;

  return { streamUrl, playSessionId: result.playSessionId, isDirectPlay: result.isDirectPlay };
}
