import { useState, useMemo, useRef, useCallback } from "react";
import { useJellyfinClient, useUserId } from "@tentacle-tv/api-client";
import type { MediaSource } from "@tentacle-tv/shared";
import type { DeviceProfile } from "@tentacle-tv/shared";
import {
  buildBrowserDeviceProfile, buildMacOSDeviceProfile, buildMpvDeviceProfile,
  type OptionsProfilWeb,
} from "../lib/deviceProfile";
import { isMacOS } from "./useDesktopPlayer";
import { isTauriShell } from "../desktop/bridge";

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
  });

  // ⚠️ `isTauri()` est en réalité `isDesktopApp()` : il répond OUI sous Electron
  // aussi. Sans `isTauriShell()`, la coquille Electron macOS réclamait donc à
  // Jellyfin un PlaybackInfo taillé pour AVFoundation — ce que la WKWebView de
  // Tauri sait lire — alors que c'est **mpv** qui lit. Le serveur renvoyait une
  // source inexploitable par le lecteur, `loadfile` n'était jamais appelé, et
  // l'écran de chargement tournait indéfiniment.
  //
  // Le défaut ne pouvait pas se voir sous Windows : `isMacOS()` y est faux, donc
  // c'est le profil navigateur — le bon pour mpv — qui servait déjà.
  const isMacOSTauri = isTauriShell() && isMacOS();

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
    /** Force server-side audio selection (Edge/Chrome: no native audioTracks API). */
    forceTranscode?: boolean;
  }) => {
    if (!userId) return;

    const currentFetch = ++fetchId.current;
    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      let profile = opts.maxStreamingBitrate != null
        ? construireProfil(lecteurNatif, isMacOSTauri, opts.maxStreamingBitrate, optionsProfil)
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
        const baseUrl = ds ? ds.mediaBaseUrl : client.getBaseUrl();
        // TranscodingUrl from proxy contains the admin API key (from token swap).
        // Replace it with the user's own Jellyfin token for direct streaming.
        let transcodingPath = ms.TranscodingUrl;
        if (ds) {
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

      setState({
        streamUrl: url,
        playSessionId: result.PlaySessionId,
        mediaSource: ms,
        isDirectPlay: directPlay,
        isDirectStream: directStream,
        streamOffset,
        isLoading: false,
      });

      // Synthetic log so users can see at a glance, in DevTools, whether
      // Direct Streaming is engaged and which decode path is used.
      const transport = ds && url.startsWith(ds.mediaBaseUrl) ? "direct" : "proxy";
      const mode = directPlay ? "DirectPlay" : directStream ? "DirectStream" : "Transcode";
      console.log("[Tentacle:Playback]", {
        mode,
        transport,
        directStreamingConfigured: !!ds,
        isHls: url.includes(".m3u8"),
        url: url.length > 80 ? `${url.slice(0, 80)}…` : url,
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
      isDirectPlay: false, isDirectStream: false, streamOffset: 0, isLoading: false,
    });
  }, []);

  return {
    ...state,
    mkvNonFiable, signalerMkvNonFiable,
    pgsClientIndisponible, signalerPgsClientIndisponible,
    fetchPlaybackInfo, reset,
  };
}
