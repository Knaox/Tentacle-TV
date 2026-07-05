import { useCallback, useEffect, type MutableRefObject } from "react";
import type { AudioTrack, SubtitleTrack } from "../components/VideoPlayer";
import { findMpvTrack, nativeSubUrl } from "../components/player/mpvTrackMapping";
import type { MpvState, MpvTrack } from "./useDesktopPlayer";

const DBG = "[DesktopPlayer]";

interface UseMpvTrackSyncOptions {
  state: MpvState;
  ready: boolean;
  fileLoaded: boolean;
  isDirectPlay: boolean;
  audioTracks: AudioTrack[];
  subtitleTracks: SubtitleTrack[];
  mpvAudio: MpvTrack[];
  mpvSubs: MpvTrack[];
  currentAudio: number;
  currentSubtitle: number | null;
  setAudioTrack: (id: number) => Promise<void>;
  setSubtitleTrack: (id: number) => Promise<void>;
  addSubtitle: (url: string, select?: boolean) => Promise<void>;
  onAudioChange: (index: number) => void;
  onSubtitleChange: (index: number | null) => void;
  loadedExternalSubs: MutableRefObject<Set<number>>;
}

/**
 * Synchronisation des pistes Jellyfin ↔ mpv : handlers de changement
 * audio/sous-titres + application des préférences (gated fileLoaded/ready).
 */
export function useMpvTrackSync({
  state, ready, fileLoaded, isDirectPlay,
  audioTracks, subtitleTracks, mpvAudio, mpvSubs,
  currentAudio, currentSubtitle,
  setAudioTrack, setSubtitleTrack, addSubtitle,
  onAudioChange, onSubtitleChange, loadedExternalSubs,
}: UseMpvTrackSyncOptions) {
  // ── Audio change handler ──
  const handleAudioChange = useCallback((jfIndex: number) => {
    const aPos = audioTracks.findIndex((t) => t.index === jfIndex);
    console.debug(DBG, "audio change", { jfIndex, aPos, mpvAudioCount: mpvAudio.length, isDirectPlay });
    // In transcode mode, audio switching is done by rebuilding the URL with the
    // new AudioStreamIndex — mpv reloads automatically. No need to set aid.
    if (isDirectPlay) {
      let mpvId: number | null = null;
      if (mpvAudio.length > 0) {
        mpvId = findMpvTrack(jfIndex, audioTracks, mpvAudio);
        if (mpvId == null && aPos >= 0 && aPos < mpvAudio.length) {
          mpvId = mpvAudio[aPos].id;
        }
      }
      if (mpvId == null && aPos >= 0) {
        mpvId = aPos + 1;
      }
      console.debug(DBG, "mapped audio", { jfIndex, mpvId });
      if (mpvId != null) setAudioTrack(mpvId);
    }
    onAudioChange(jfIndex);
  }, [audioTracks, mpvAudio, setAudioTrack, onAudioChange, isDirectPlay]);

  // ── Subtitle change handler ──
  const handleSubtitleChange = useCallback((jfIndex: number | null) => {
    console.debug(DBG, "subtitle change", { jfIndex, mpvSubsCount: mpvSubs.length });
    if (jfIndex == null) {
      setSubtitleTrack(0);
      onSubtitleChange(null);
      return;
    }
    const mpvId = findMpvTrack(jfIndex, subtitleTracks, mpvSubs);
    console.debug(DBG, "mapped subtitle", { jfIndex, mpvId });
    if (mpvId != null) {
      setSubtitleTrack(mpvId);
    } else {
      const subTrack = subtitleTracks.find((t) => t.index === jfIndex);
      if (subTrack?.url) {
        const url = nativeSubUrl(subTrack.url, subTrack.codec);
        console.debug(DBG, "loading external subtitle", { url: url.substring(0, 80), codec: subTrack.codec });
        addSubtitle(url, true);
      }
    }
    onSubtitleChange(jfIndex);
  }, [subtitleTracks, mpvSubs, setSubtitleTrack, addSubtitle, onSubtitleChange]);

  // ── Apply audio preference from parent ──
  // Wait for fileLoaded — mpv cannot accept aid/sid before a file is loaded.
  // Also re-triggers when mpvAudio changes (queryTrackList completes).
  useEffect(() => {
    if (!fileLoaded || !ready) return;
    // In transcode mode, Jellyfin outputs only the selected audio track via
    // AudioStreamIndex — HLS has exactly 1 audio track (aid=1). Force it here
    // because mpv's aid persists across loadfile: if the previous direct play file
    // had aid=3 (e.g. Japanese), the new HLS stream has no track 3 → no audio.
    if (!isDirectPlay) {
      setAudioTrack(1);
      return;
    }
    let mpvId: number | null = null;
    if (mpvAudio.length > 0) {
      mpvId = findMpvTrack(currentAudio, audioTracks, mpvAudio);
      // Positional fallback when language matching fails
      if (mpvId == null) {
        const aPos = audioTracks.findIndex((t) => t.index === currentAudio);
        if (aPos >= 0 && aPos < mpvAudio.length) mpvId = mpvAudio[aPos].id;
      }
    } else {
      // Positional fallback when queryTrackList hasn't returned (or failed)
      const aPos = audioTracks.findIndex((t) => t.index === currentAudio);
      if (aPos >= 0) mpvId = aPos + 1;
    }
    console.debug(DBG, "pref apply audio", { currentAudio, mpvId, currentMpv: state.audioTrack,
      hasMpvTracks: mpvAudio.length > 0, jfLangs: audioTracks.map(t => t.lang), mpvLangs: mpvAudio.map(t => t.lang) });
    if (mpvId != null) setAudioTrack(mpvId);
  }, [currentAudio, mpvAudio, fileLoaded, ready, isDirectPlay]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Apply subtitle preference from parent ──
  useEffect(() => {
    if (!fileLoaded || !ready) return;
    if (currentSubtitle == null) {
      console.debug(DBG, "pref apply subtitle: disable (null)");
      setSubtitleTrack(0);
      return;
    }

    // Try embedded subtitle matching first
    if (mpvSubs.length > 0) {
      const mpvId = findMpvTrack(currentSubtitle, subtitleTracks, mpvSubs);
      console.debug(DBG, "pref apply subtitle (embedded)", { currentSubtitle, mpvId, currentMpv: state.subtitleTrack,
        jfLangs: subtitleTracks.map(t => t.lang), mpvLangs: mpvSubs.map(t => t.lang), mpvIds: mpvSubs.map(t => t.id) });
      if (mpvId != null) {
        setSubtitleTrack(mpvId);
        return;
      }
    }

    // External subtitle fallback
    if (!loadedExternalSubs.current.has(currentSubtitle)) {
      const subTrack = subtitleTracks.find((t) => t.index === currentSubtitle);
      if (subTrack?.url) {
        const url = nativeSubUrl(subTrack.url, subTrack.codec);
        console.debug(DBG, "pref apply subtitle (external)", { currentSubtitle, url: url.substring(0, 80), codec: subTrack.codec });
        loadedExternalSubs.current.add(currentSubtitle);
        addSubtitle(url, true);
      }
    }
  }, [currentSubtitle, mpvSubs, fileLoaded, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  return { handleAudioChange, handleSubtitleChange };
}
