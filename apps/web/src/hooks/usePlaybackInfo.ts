import { useState, useMemo, useRef, useCallback } from "react";
import { useJellyfinClient, useUserId } from "@tentacle-tv/api-client";
import type { MediaSource } from "@tentacle-tv/shared";
import { buildBrowserDeviceProfile } from "../lib/browserDeviceProfile";

const DBG = "[Tentacle:PlaybackInfo]";

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

export function usePlaybackInfo() {
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

  const deviceProfile = useMemo(() => buildBrowserDeviceProfile(), []);

  const fetchPlaybackInfo = useCallback(async (opts: {
    itemId: string;
    mediaSourceId?: string;
    audioStreamIndex?: number;
    subtitleStreamIndex?: number;
    startTimeTicks?: number;
    maxStreamingBitrate?: number;
  }) => {
    if (!userId) return;

    const currentFetch = ++fetchId.current;
    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      const bitrateProfile = opts.maxStreamingBitrate != null
        ? buildBrowserDeviceProfile(opts.maxStreamingBitrate)
        : deviceProfile;

      const result = await client.getPlaybackInfo(opts.itemId, {
        userId,
        deviceProfile: bitrateProfile,
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
      if (directPlay) {
        url = `${client.getBaseUrl()}/Videos/${opts.itemId}/stream?Static=true&MediaSourceId=${ms.Id}&api_key=${client.getAccessToken()}`;
      } else if (ms.TranscodingUrl) {
        url = `${client.getBaseUrl()}${ms.TranscodingUrl}`;
      } else {
        console.warn(DBG, "no TranscodingUrl and not direct play");
        setState((prev) => ({ ...prev, isLoading: false }));
        return;
      }

      const offsetTicks = opts.startTimeTicks ?? 0;
      const streamOffset = !directPlay && offsetTicks > 0 ? offsetTicks / 10_000_000 : 0;

      console.debug(DBG, "resolved", {
        directPlay, directStream, url: url.slice(0, 120),
        playSessionId: result.PlaySessionId,
      });

      setState({
        streamUrl: url,
        playSessionId: result.PlaySessionId,
        mediaSource: ms,
        isDirectPlay: directPlay,
        isDirectStream: directStream,
        streamOffset,
        isLoading: false,
      });
    } catch (err) {
      if (fetchId.current !== currentFetch) return;
      console.error(DBG, "PlaybackInfo failed", err);
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, [client, userId, deviceProfile]);

  const reset = useCallback(() => {
    ++fetchId.current; // Invalidate in-flight fetches
    setState({
      streamUrl: null, playSessionId: null, mediaSource: null,
      isDirectPlay: false, isDirectStream: false, streamOffset: 0, isLoading: false,
    });
  }, []);

  return { ...state, fetchPlaybackInfo, reset };
}
