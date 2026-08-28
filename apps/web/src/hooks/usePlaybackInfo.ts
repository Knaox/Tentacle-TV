import { useState, useMemo, useRef, useCallback } from "react";
import { useJellyfinClient, useUserId } from "@tentacle-tv/api-client";
import type { MediaSource } from "@tentacle-tv/shared";
import type { DeviceProfile } from "@tentacle-tv/shared";
import {
  buildBrowserDeviceProfile, buildMacOSDeviceProfile, buildMpvDeviceProfile,
  type OptionsProfilWeb,
} from "../lib/deviceProfile";
import { evaluerLecture, sourceEstHdr, type Verdict } from "./playbackVerdict";
import { desktopKind } from "../desktop/detect";
import { journaliserLecture } from "./journalPlayback";

const DBG = "[Tentacle:PlaybackInfo]";

/**
 * Le profil décrit QUI LIT, et mpv ne lit pas comme un navigateur : lui envoyer
 * les capacités de Chromium faisait remuxer en HLS tout MKV — donc tout contenu
 * lourd — pour un lecteur qui l'aurait ouvert tel quel.
 *
 * Hors du hook : `fetchPlaybackInfo` est mémoïsé, et une fonction refermée sur
 * le rendu s'y serait figée.
 */
function construireProfil(
  lecteurNatif: boolean, isMacOSTauri: boolean, bitrate?: number, options?: OptionsProfilWeb,
): DeviceProfile {
  // mpv lit tout, y compris les sous-titres image : aucune capacité à lui
  // retirer, les drapeaux de repli ne concernent que les lecteurs web.
  if (lecteurNatif) return buildMpvDeviceProfile(bitrate);
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
function plagesDuProfil(profil: DeviceProfile): string[] {
  for (const codec of profil.CodecProfiles ?? []) {
    if (codec.Type !== "Video") continue;
    const condition = codec.Conditions.find((c) => c.Property === "VideoRangeType");
    if (condition) return condition.Value.split("|");
  }
  return [];
}

export interface PlaybackInfoState {
  /** Full stream URL (direct play or TranscodingUrl from server) */
  streamUrl: string | null;
  /** Server-assigned play session ID */
  playSessionId: string | null;
  /** Server-selected media source */
  mediaSource: MediaSource | null;
  /** true = raw file, no transcode */
  isDirectPlay: boolean;
  /** true = remux (video copy, audio transcode) */
  isDirectStream: boolean;
  /** Offset in seconds when server starts transcode mid-stream */
  streamOffset: number;
  /** Whether a fetch is in progress */
  isLoading: boolean;
  /**
   * Ce que le serveur a réellement fait de l'image, et pourquoi.
   *
   * Les deux booléens ci-dessus décrivent ce que le fichier PERMET ; seul ce
   * verdict distingue un remux — image copiée — d'un ré-encodage. Il était
   * calculé puis jeté dans un `console.warn`, ce qui obligeait à ouvrir un
   * inspecteur distant pour savoir si un film 4K se faisait recompresser.
   * `null` tant qu'aucune lecture n'a été négociée.
   */
  verdict: Verdict | null;
}

/**
 * @param lecteurNatif Vrai quand c'est mpv qui lira, faux pour le lecteur web.
 *   La distinction ne peut pas se déduire de la plateforme : le repli web
 *   (`Watch.tsx`, `forceWeb`) tourne dans la même application de bureau, et lui
 *   servir un profil mpv le laisserait avec un MKV qu'il ne sait pas ouvrir.
 */
export function usePlaybackInfo(lecteurNatif = false) {
  const client = useJellyfinClient();
  const userId = useUserId();
  const fetchId = useRef(0);

  const [state, setState] = useState<PlaybackInfoState>({
    streamUrl: null,
    playSessionId: null,
    mediaSource: null,
    isDirectPlay: false,
    isDirectStream: false,
    streamOffset: 0,
    isLoading: false,
    verdict: null,
  });

  // Le profil AVFoundation servait la WKWebView de la coquille Tauri macOS. Il
  // n'y a plus de WKWebView : c'est **mpv** qui lit, sur les trois systèmes, et
  // c'est le profil navigateur qu'il faut lui demander.
  //
  // ⚠️ Le laisser derrière `isTauri()` aurait été un piège : ce nom ment, la
  // fonction répond en réalité `isDesktopApp()`. Le défaut a existé — Jellyfin
  // renvoyait une source qu'mpv ne savait pas ouvrir, `loadfile` n'était jamais
  // appelé, et l'écran de chargement tournait indéfiniment.
  const isMacOSTauri = false;

  // Hors de `state` : `reset()` le vide à chaque changement d'épisode, alors
  // que la disqualification du MKV vaut pour toute la session. Un moteur qui a
  // échoué une fois échouerait sur l'épisode suivant, et rien ne sert de lui
  // repayer trois secondes d'attente à chaque fois. En mémoire uniquement :
  // rien n'est écrit sur le disque, un rechargement de page remet à zéro.
  const [mkvNonFiable, setMkvNonFiable] = useState(false);
  const [pgsClientIndisponible, setPgsClientIndisponible] = useState(false);
  const signalerMkvNonFiable = useCallback(() => {
    console.warn(DBG, "lecture directe MKV muette — desactivee pour la session");
    setMkvNonFiable(true);
  }, []);
  const signalerPgsClientIndisponible = useCallback(() => {
    console.warn(DBG, "rendu PGS client en echec — incrustation serveur pour la session");
    setPgsClientIndisponible(true);
  }, []);
  const optionsProfil = useMemo<OptionsProfilWeb>(
    () => ({ mkvNonFiable, pgsClientIndisponible }),
    [mkvNonFiable, pgsClientIndisponible],
  );

  const deviceProfile = useMemo(
    () => construireProfil(lecteurNatif, isMacOSTauri, undefined, optionsProfil),
    [lecteurNatif, isMacOSTauri, optionsProfil],
  );
  const fetchPlaybackInfo = useCallback(async (opts: {
    itemId: string;
    mediaSourceId?: string;
    audioStreamIndex?: number;
    subtitleStreamIndex?: number;
    startTimeTicks?: number;
    maxStreamingBitrate?: number;
    /** Cap visuel du preset de qualité (Jellyfin MaxHeight). */
    maxHeight?: number;
    /** Force server-side audio selection (Edge/Chrome: no native audioTracks API). */
    forceTranscode?: boolean;
    /**
     * La source est en Dolby Vision — le profil du téléviseur en a besoin pour
     * choisir le conteneur d'un éventuel remux. Sans elle, le profil ne sait
     * rien de ce qu'on va lui demander de lire.
     */
    sourceDolbyVision?: boolean;
  }) => {
    if (!userId) return;

    const currentFetch = ++fetchId.current;
    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      // Le profil mémoïsé ne convient que si rien de propre à CETTE lecture ne
      // le change. Un débit imposé ou une source Dolby Vision le rebâtissent.
      const surMesure = opts.maxStreamingBitrate != null || opts.sourceDolbyVision === true;
      let profile = surMesure
        ? construireProfil(lecteurNatif, isMacOSTauri, opts.maxStreamingBitrate, {
          ...optionsProfil, sourceDolbyVision: opts.sourceDolbyVision,
        })
        : deviceProfile;
      // Edge/Chrome lack audioTracks API — strip DirectPlayProfiles so Jellyfin
      // returns a TranscodingUrl with the correct audio track selected server-side.
      if (opts.forceTranscode) {
        profile = { ...profile, DirectPlayProfiles: [] };
      }

      const result = await client.getPlaybackInfo(opts.itemId, {
        userId,
        deviceProfile: profile,
        mediaSourceId: opts.mediaSourceId,
        audioStreamIndex: opts.audioStreamIndex,
        subtitleStreamIndex: opts.subtitleStreamIndex,
        startTimeTicks: opts.startTimeTicks,
        maxStreamingBitrate: opts.maxStreamingBitrate,
        maxHeight: opts.maxHeight,
      });

      // Discard stale responses (newer fetch was started)
      if (fetchId.current !== currentFetch) return;

      const ms = result.MediaSources?.[0];
      if (!ms) {
        console.warn(DBG, "no media source returned");
        setState((prev) => ({ ...prev, isLoading: false }));
        return;
      }

      const directPlay = ms.SupportsDirectPlay && !ms.TranscodingUrl;
      const directStream = ms.SupportsDirectStream && !directPlay;

      let url: string;
      const ds = client.getDirectStreaming();
      if (directPlay) {
        const baseUrl = ds ? ds.mediaBaseUrl : client.getBaseUrl();
        const token = ds ? ds.jellyfinToken : client.getAccessToken();
        url = `${baseUrl}/Videos/${opts.itemId}/stream?Static=true&MediaSourceId=${ms.Id}&api_key=${token}`;
      } else if (ms.TranscodingUrl) {
        // Transcodage = HLS chargé par hls.js (XHR), donc soumis au CORS. Sur
        // la coquille Electron (origine applicative), le manifeste direct part
        // au mur : hls.js échouait, et l'auto-guérison COUPAIT le direct
        // streaming pour toute la session — URLs médias de mpv comprises
        // (mesuré le 28.08 : manifestLoadError puis « coupe pour la session »).
        // Le flux transcodé du LECTEUR WEB y naît donc sur le PROXY ; mpv
        // (hors moteur web) et le direct play (<video>, sans CORS) restent en
        // direct.
        const hlsSansCors = !lecteurNatif && desktopKind() === "electron";
        const baseUrl = ds && !hlsSansCors ? ds.mediaBaseUrl : client.getBaseUrl();
        // TranscodingUrl from proxy contains the admin API key (from token swap).
        // Replace it with the user's own Jellyfin token for direct streaming.
        let transcodingPath = ms.TranscodingUrl;
        if (ds && !hlsSansCors) {
          transcodingPath = transcodingPath.replace(
            /([?&])(api_key|ApiKey)=[^&]*/i,
            `$1ApiKey=${encodeURIComponent(ds.jellyfinToken)}`
          );
        }
        url = `${baseUrl}${transcodingPath}`;
      } else {
        console.warn(DBG, "no TranscodingUrl and not direct play");
        setState((prev) => ({ ...prev, isLoading: false }));
        return;
      }

      const offsetTicks = opts.startTimeTicks ?? 0;
      const streamOffset = !directPlay && offsetTicks > 0 ? offsetTicks / 10_000_000 : 0;

      // `mode` vient de `evaluerLecture` et non des deux booléens ci-dessus :
      // ceux-ci disent ce que le fichier PERMET, pas ce que le serveur a fait.
      // Seul le verdict distingue un remux — image copiée, son converti, ce
      // qu'on vise — d'un ré-encodage, ce qu'on traque. `reencodage` est le
      // critère d'acceptation du chantier : il doit rester faux.
      const transport = ds && url.startsWith(ds.mediaBaseUrl) ? "direct" : "proxy";
      const fluxVideo = ms.MediaStreams?.find((s) => s.Type === "Video");
      const plages = plagesDuProfil(profile);
      const verdict = evaluerLecture({
        supportsDirectPlay: ms.SupportsDirectPlay,
        supportsDirectStream: ms.SupportsDirectStream,
        transcodingUrl: ms.TranscodingUrl,
        transcodeReasons: ms.TranscodeReasons,
        codecVideoSource: fluxVideo?.Codec,
        sourceHdr: sourceEstHdr(fluxVideo),
        clientAccepteHdr: plages.length > 2, // au-delà de Unknown+SDR
      });

      setState({
        streamUrl: url,
        playSessionId: result.PlaySessionId,
        mediaSource: ms,
        isDirectPlay: directPlay,
        isDirectStream: directStream,
        streamOffset,
        isLoading: false,
        verdict,
      });

      // Relevé synthétique pour l'inspecteur d'une dalle (cf. journalPlayback).
      journaliserLecture({
        verdict, fluxVideo, plages, transport,
        directStreamingConfigured: !!ds, url, directPlay,
      });
    } catch (err) {
      if (fetchId.current !== currentFetch) return;
      console.error(DBG, "PlaybackInfo failed", err);
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, [client, userId, deviceProfile, optionsProfil]);

  const reset = useCallback(() => {
    ++fetchId.current; // Invalidate in-flight fetches
    setState({
      streamUrl: null, playSessionId: null, mediaSource: null,
      isDirectPlay: false, isDirectStream: false, streamOffset: 0, isLoading: false, verdict: null,
    });
  }, []);

  return {
    ...state,
    mkvNonFiable, signalerMkvNonFiable,
    pgsClientIndisponible, signalerPgsClientIndisponible,
    fetchPlaybackInfo, reset,
  };
}
