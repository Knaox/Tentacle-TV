import { useCallback, useEffect, useRef, type MutableRefObject } from "react";
import { BURN_IN_SUBTITLE_CODECS } from "@tentacle-tv/shared";
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
  addSubtitle: (url: string, select?: boolean) => Promise<number | null>;
  onAudioChange: (index: number) => void;
  onSubtitleChange: (index: number | null) => void;
  loadedExternalSubs: MutableRefObject<Map<number, number>>;
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

  // ── Sélection d'une piste externe (sub-add du format natif ass/srt) ──
  // Mémorise le sid attribué (jfIndex → sid, purgé à chaque source) : une
  // re-sélection réutilise la piste au lieu de re-sub-add (mpv dupliquerait).
  // pendingExternal évite le double sub-add concurrent (handler + effet de préf).
  const pendingExternal = useRef<Set<number>>(new Set());
  const selectExternalSub = useCallback(async (jfIndex: number) => {
    const known = loadedExternalSubs.current.get(jfIndex);
    if (known != null) { await setSubtitleTrack(known); return; }
    if (pendingExternal.current.has(jfIndex)) return;
    const subTrack = subtitleTracks.find((t) => t.index === jfIndex);
    if (!subTrack?.url) return;
    pendingExternal.current.add(jfIndex);
    try {
      const url = nativeSubUrl(subTrack.url, subTrack.codec);
      console.debug(DBG, "loading external subtitle", { url: url.substring(0, 80), codec: subTrack.codec });
      const sid = await addSubtitle(url, true);
      if (sid != null) loadedExternalSubs.current.set(jfIndex, sid);
    } finally {
      pendingExternal.current.delete(jfIndex);
    }
  }, [subtitleTracks, addSubtitle, setSubtitleTrack, loadedExternalSubs]);

  /** Sous-titre bitmap (PGS…) ? → burn-in serveur, rien à faire côté mpv. */
  const isBitmapSub = useCallback((jfIndex: number) => {
    const codec = subtitleTracks.find((t) => t.index === jfIndex)?.codec;
    return BURN_IN_SUBTITLE_CODECS.test(codec ?? "");
  }, [subtitleTracks]);

  // ── Subtitle change handler ──
  const handleSubtitleChange = useCallback((jfIndex: number | null) => {
    console.debug(DBG, "subtitle change", { jfIndex, mpvSubsCount: mpvSubs.length, isDirectPlay });
    if (jfIndex == null) {
      setSubtitleTrack(0); // sid=no — désactive aussi une piste externe
      onSubtitleChange(null);
      return;
    }
    if (!isDirectPlay) {
      // Transcode : les renditions VTT du manifeste HLS (SubtitleMethod=Hls,
      // requis tvOS) ne sont pas rendues par mpv → TOUJOURS charger la piste
      // externe au format natif (ass/srt, mise en forme complète). Bitmap →
      // burn-in serveur déclenché par le parent (WatchDesktop), rien ici.
      if (!isBitmapSub(jfIndex)) void selectExternalSub(jfIndex);
      onSubtitleChange(jfIndex);
      return;
    }
    const mpvId = findMpvTrack(jfIndex, subtitleTracks, mpvSubs);
    console.debug(DBG, "mapped subtitle", { jfIndex, mpvId });
    if (mpvId != null) setSubtitleTrack(mpvId);
    else void selectExternalSub(jfIndex);
    onSubtitleChange(jfIndex);
  }, [subtitleTracks, mpvSubs, isDirectPlay, isBitmapSub, setSubtitleTrack, selectExternalSub, onSubtitleChange]);

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

    if (!isDirectPlay) {
      // Transcode : externe natif systématique (voir handleSubtitleChange).
      if (!isBitmapSub(currentSubtitle)) void selectExternalSub(currentSubtitle);
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

    // External subtitle fallback (dédupliqué par selectExternalSub)
    void selectExternalSub(currentSubtitle);
  }, [currentSubtitle, mpvSubs, fileLoaded, ready, isDirectPlay]); // eslint-disable-line react-hooks/exhaustive-deps

  return { handleAudioChange, handleSubtitleChange };
}
