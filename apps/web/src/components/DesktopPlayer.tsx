import { useEffect, useCallback, useRef, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AnimatePresence } from "framer-motion";
import { TrackSelector } from "./TrackSelector";
import { NextEpisodeOverlay } from "./NextEpisodeOverlay";
import { BackIcon, PlayIcon, PauseIcon, VolumeIcon, MuteIcon, GearIcon, FullscreenIcon, ExitFullscreenIcon, PrevEpIcon, NextEpIcon } from "./PlayerIcons";
import type { AudioTrack, SubtitleTrack } from "./VideoPlayer";
import { useDesktopPlayer } from "../hooks/useDesktopPlayer";
import type { MpvTrack } from "../hooks/useDesktopPlayer";
import type { SegmentTimestamps } from "@tentacle-tv/shared";

const DBG = "[DesktopPlayer]";

// Module-level invoke cache — available immediately in cleanup, no async import needed
let cachedInvoke: ((cmd: string) => Promise<unknown>) | null = null;
import("@tauri-apps/api/core").then(({ invoke }) => { cachedInvoke = invoke; }).catch(() => {});

interface DesktopPlayerProps {
  src: string; title: string; subtitle?: string;
  startPositionSeconds?: number; jellyfinDuration?: number;
  audioTracks?: AudioTrack[]; subtitleTracks?: SubtitleTrack[];
  currentAudio: number; currentSubtitle: number | null; currentQuality: number | null;
  onAudioChange: (index: number) => void; onSubtitleChange: (index: number | null) => void;
  onQualityChange: (bitrate: number | null) => void;
  onProgress?: (seconds: number, paused: boolean) => void; onStarted?: () => void;
  isDirectPlay?: boolean; streamOffset?: number; posterUrl?: string;
  introSegment?: SegmentTimestamps | null; creditsSegment?: SegmentTimestamps | null;
  hasNextEpisode?: boolean; hasPreviousEpisode?: boolean; nextEpisodeTitle?: string;
  nextEpisodeImageUrl?: string; nextEpisodeDescription?: string;
  autoplayCreditsSeconds?: number;
  itemId?: string;
  onNextEpisode?: () => void; onPreviousEpisode?: () => void; onFallbackToWeb?: () => void;
}

// ── Comprehensive language code normalization ──
// Handles ISO 639-1 (ja, fr), 639-2/B (fre, ger) and 639-2/T (fra, deu).
// All variants for each language map to the same canonical (639-2/T) code.
const LANG_NORM: Record<string, string> = {};
([
  ["ja", "jpn"], ["fr", "fre", "fra"], ["en", "eng"], ["de", "ger", "deu"],
  ["es", "spa"], ["it", "ita"], ["pt", "por"], ["ru", "rus"],
  ["zh", "chi", "zho"], ["ko", "kor"], ["ar", "ara"], ["nl", "dut", "nld"],
  ["pl", "pol"], ["cs", "cze", "ces"], ["hu", "hun"], ["ro", "rum", "ron"],
  ["el", "gre", "ell"], ["tr", "tur"], ["he", "heb"], ["th", "tha"],
  ["vi", "vie"], ["hi", "hin"], ["uk", "ukr"], ["sv", "swe"],
  ["no", "nor"], ["da", "dan"], ["fi", "fin"], ["hr", "hrv"],
  ["sk", "slo", "slk"], ["sr", "srp"], ["bg", "bul"], ["sl", "slv"],
  ["is", "ice", "isl"], ["cy", "wel", "cym"], ["eu", "baq", "eus"],
  ["sq", "alb", "sqi"], ["hy", "arm", "hye"], ["ka", "geo", "kat"],
  ["mk", "mac", "mkd"], ["ms", "may", "msa"], ["my", "bur", "mya"],
  ["fa", "per", "fas"], ["bo", "tib", "bod"], ["la", "lat"],
  ["nb", "nob"], ["nn", "nno"], ["ta", "tam"], ["te", "tel"],
] as string[][]).forEach(group => {
  const canon = group[group.length - 1];
  group.forEach(c => { LANG_NORM[c] = canon; });
});

/** Compare two language codes — normalizes all ISO 639 variants. */
function langMatch(a?: string, b?: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  return (LANG_NORM[a] ?? a) === (LANG_NORM[b] ?? b);
}

/** Get the best subtitle delivery format for mpv based on codec. */
function nativeSubFormat(codec?: string): string {
  switch (codec?.toLowerCase()) {
    case "ass": case "ssa": return "ass";
    case "srt": case "subrip": return "srt";
    default: return "srt";
  }
}

/** Replace .vtt extension in a Jellyfin subtitle URL with the given format. */
function nativeSubUrl(url: string, codec?: string): string {
  return url.replace(/Stream\.vtt/, `Stream.${nativeSubFormat(codec)}`);
}

// ── Language-based mapping: Jellyfin index → MPV track ID ──

/** Find the MPV track that best matches a Jellyfin track by language, then position fallback. */
function findMpvTrack(
  jfIndex: number,
  jfTracks: { index: number; lang?: string }[],
  mpvTracks: MpvTrack[],
): number | null {
  const jfPos = jfTracks.findIndex((t) => t.index === jfIndex);
  if (jfPos < 0) return null;
  const jfLang = jfTracks[jfPos].lang;

  // 1. Try language match (handles all ISO 639 variants)
  if (jfLang) {
    const sameJfBefore = jfTracks.slice(0, jfPos).filter((t) => langMatch(t.lang, jfLang)).length;
    const langMatches = mpvTracks.filter((t) => langMatch(t.lang, jfLang));
    if (sameJfBefore < langMatches.length) return langMatches[sameJfBefore].id;
    if (langMatches.length > 0) return langMatches[0].id;
    // Language match failed — fall through to positional
  }

  // 2. Positional fallback: use when no language info OR when language matching failed
  if (jfPos < mpvTracks.length) return mpvTracks[jfPos].id;

  return null;
}

/** Reverse: MPV track ID → Jellyfin track index. */
function findJfIndex(
  mpvId: number,
  jfTracks: { index: number; lang?: string }[],
  mpvTracks: MpvTrack[],
): number | null {
  // Handle type mismatch: mpv might report aid/sid as different types
  const numId = typeof mpvId === "number" ? mpvId : Number(mpvId);
  if (Number.isNaN(numId)) return null;

  const mpvTrack = mpvTracks.find((t) => t.id === numId);
  if (!mpvTrack) {
    // Direct positional fallback using mpv track ID (1-based → 0-based)
    const pos = numId - 1;
    if (pos >= 0 && pos < jfTracks.length) return jfTracks[pos].index;
    return null;
  }

  if (mpvTrack.lang) {
    const mpvPos = mpvTracks.filter((t) => langMatch(t.lang, mpvTrack.lang)).indexOf(mpvTrack);
    const jfSameLang = jfTracks.filter((t) => langMatch(t.lang, mpvTrack.lang));
    if (mpvPos >= 0 && mpvPos < jfSameLang.length) return jfSameLang[mpvPos].index;
    if (jfSameLang.length > 0) return jfSameLang[0].index;
    // Language match failed — fall through to positional
  }

  const mpvPos = mpvTracks.indexOf(mpvTrack);
  if (mpvPos >= 0 && mpvPos < jfTracks.length) return jfTracks[mpvPos].index;
  return null;
}

export function DesktopPlayer({
  src, title, subtitle, startPositionSeconds, jellyfinDuration,
  audioTracks = [], subtitleTracks = [],
  currentAudio, currentSubtitle, currentQuality,
  onAudioChange, onSubtitleChange, onQualityChange,
  onProgress, onStarted,
  isDirectPlay = true, streamOffset = 0, posterUrl,
  introSegment, creditsSegment,
  hasNextEpisode, hasPreviousEpisode, nextEpisodeTitle,
  nextEpisodeImageUrl, nextEpisodeDescription,
  autoplayCreditsSeconds,
  itemId,
  onNextEpisode, onPreviousEpisode, onFallbackToWeb,
}: DesktopPlayerProps) {
  const { t } = useTranslation("player");
  const navigate = useNavigate();
  const { state, ready, fileLoaded, error, play, togglePause, seek, seekRelative,
    setAudioTrack, setSubtitleTrack, addSubtitle, setVolume, toggleMute, toggleFullscreen, stop } = useDesktopPlayer();
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const autoPlayTimerRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const [showControls, setShowControls] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [autoPlayCountdown, setAutoPlayCountdown] = useState<number | null>(null);
  const [sourceChanging, setSourceChanging] = useState(false);
  const hasStartedRef = useRef(false);
  // State (not ref!) — transitioning to true triggers preference effect re-runs
  const [initialLoaded, setInitialLoaded] = useState(false);
  const prevSrcRef = useRef("");
  const loadedExternalSubs = useRef<Set<number>>(new Set());
  // Absolute position ref — survives across direct play ↔ transcode transitions
  const lastAbsolutePosRef = useRef(0);
  // PTS detection: mpv may report absolute PTS (offset baked into HLS) or relative PTS.
  // effectiveMpvOffset is 0 when absolute (no correction needed), or streamOffset when relative.
  const effectiveMpvOffset = useRef(0);
  const offsetDetectedForSrc = useRef("");
  const fullscreenRef = useRef(state.fullscreen);
  fullscreenRef.current = state.fullscreen;

  // MPV tracks split by type
  const mpvAudio = useMemo(() => state.tracks.filter((t) => t.type === "audio"), [state.tracks]);
  const mpvSubs = useMemo(() => state.tracks.filter((t) => t.type === "sub"), [state.tracks]);

  // ── Always show Jellyfin tracks in selector (better labels, consistent) ──
  const displayAudio = audioTracks;
  const displaySubs = subtitleTracks;

  // ── Audio change handler ──
  const handleAudioChange = useCallback((jfIndex: number) => {
    const aPos = audioTracks.findIndex((t) => t.index === jfIndex);
    console.debug(DBG, "audio change", { jfIndex, aPos, mpvAudioCount: mpvAudio.length,
      jfLangs: audioTracks.map(t => t.lang), mpvLangs: mpvAudio.map(t => t.lang),
      mpvIds: mpvAudio.map(t => t.id) });
    let mpvId: number | null = null;
    if (mpvAudio.length > 0) {
      mpvId = findMpvTrack(jfIndex, audioTracks, mpvAudio);
      // Extra positional fallback if findMpvTrack failed
      if (mpvId == null && aPos >= 0 && aPos < mpvAudio.length) {
        mpvId = mpvAudio[aPos].id;
      }
    }
    // Final fallback: 1-based positional (mpv default numbering)
    if (mpvId == null && aPos >= 0) {
      mpvId = aPos + 1;
    }
    console.debug(DBG, "mapped audio", { jfIndex, mpvId });
    if (mpvId != null) setAudioTrack(mpvId);
    onAudioChange(jfIndex);
  }, [audioTracks, mpvAudio, setAudioTrack, onAudioChange]);

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
  }, [currentAudio, mpvAudio, fileLoaded, ready]); // eslint-disable-line react-hooks/exhaustive-deps

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

  useEffect(() => {
    const prev = document.body.style.background;
    document.body.style.background = "transparent";
    document.documentElement.style.background = "transparent";
    return () => { document.body.style.background = prev; document.documentElement.style.background = ""; };
  }, []);

  // Load media when ready
  useEffect(() => {
    if (!ready || !src) return;
    const isSourceChange = initialLoaded && prevSrcRef.current !== src;
    prevSrcRef.current = src;

    // Show loading overlay during source changes (quality/audio switch)
    if (isSourceChange) setSourceChanging(true);

    // Use lastAbsolutePosRef for source changes — survives direct play ↔ transcode transitions.
    // state.position is relative to the current stream, which is wrong when switching modes.
    const startPos = isSourceChange
      ? lastAbsolutePosRef.current
      : (isDirectPlay ? startPositionSeconds : undefined);

    console.debug(DBG, "play", { src: src.substring(0, 80), startPos, absolutePos: lastAbsolutePosRef.current,
      isDirectPlay, isSourceChange });
    // Don't pass audioTrack/subtitleTrack here — the preference effects handle
    // track selection AFTER file-loaded, avoiding races with pendingTracks.
    play({ url: src, startPosition: startPos });
    loadedExternalSubs.current.clear();
    // State transition triggers preference effects in the NEXT render
    if (!initialLoaded) setInitialLoaded(true);
  }, [ready, src]); // eslint-disable-line react-hooks/exhaustive-deps

  // Detect whether mpv reports absolute PTS (offset baked into HLS manifest) or
  // relative PTS (starting from 0).  Jellyfin HLS typically uses absolute PTS,
  // matching the web player behaviour (VideoPlayer.tsx effectiveOffset = 0).
  useEffect(() => {
    if (src === offsetDetectedForSrc.current) return;
    if (isDirectPlay || streamOffset === 0) {
      effectiveMpvOffset.current = 0;
      offsetDetectedForSrc.current = src;
      return;
    }
    // In transcode mode with streamOffset: wait for a meaningful position (> 5 s)
    if (state.position > 5) {
      offsetDetectedForSrc.current = src;
      if (state.position > streamOffset * 0.5) {
        // mpv reports absolute PTS — no additional offset needed
        effectiveMpvOffset.current = 0;
        console.debug(DBG, "PTS detection: absolute", { pos: state.position, streamOffset });
      } else {
        // mpv reports relative PTS — must add offset
        effectiveMpvOffset.current = streamOffset;
        console.debug(DBG, "PTS detection: relative", { pos: state.position, streamOffset });
      }
    }
  }, [state.position, src, isDirectPlay, streamOffset]);

  // Report progress + track absolute position
  useEffect(() => {
    if (!state.playing && !hasStartedRef.current) return;
    if (state.playing && !hasStartedRef.current) { hasStartedRef.current = true; onStarted?.(); }
    const absolutePos = state.position + effectiveMpvOffset.current;
    lastAbsolutePosRef.current = absolutePos;
    onProgress?.(absolutePos, state.paused);
  }, [state.position, state.paused, state.playing]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear sourceChanging when playback resumes after a source change
  useEffect(() => {
    if (state.playing && sourceChanging) setSourceChanging(false);
  }, [state.playing, sourceChanging]);

  // Navigate back with fullscreen exit — awaits exit_fullscreen before navigating
  const goBack = useCallback(async () => {
    if (fullscreenRef.current && cachedInvoke) {
      try {
        await cachedInvoke("exit_fullscreen");
        // Brief delay for OS window manager to process the transition
        await new Promise((r) => setTimeout(r, 50));
      } catch { /* proceed anyway */ }
    }
    navigate(-1);
  }, [navigate]);

  const startAutoPlayCountdown = useCallback(() => {
    if (!hasNextEpisode || !onNextEpisode) return;
    setAutoPlayCountdown(10);
    clearInterval(autoPlayTimerRef.current);
    autoPlayTimerRef.current = setInterval(() => {
      setAutoPlayCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(autoPlayTimerRef.current);
          onNextEpisode();
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  }, [hasNextEpisode, onNextEpisode]);

  const cancelAutoPlay = useCallback(() => {
    clearInterval(autoPlayTimerRef.current);
    setAutoPlayCountdown(null);
  }, []);

  // Navigate to detail page for movies — awaits exit_fullscreen before navigating
  const goToDetail = useCallback(async () => {
    if (fullscreenRef.current && cachedInvoke) {
      try {
        await cachedInvoke("exit_fullscreen");
        await new Promise((r) => setTimeout(r, 50));
      } catch { /* proceed anyway */ }
    }
    navigate(`/media/${itemId}`, { replace: true });
  }, [navigate, itemId]);

  // Show overlay when entering credits (or last 2 min fallback for episodes)
  const creditsAutoPlayTriggered = useRef(false);
  useEffect(() => {
    if (creditsAutoPlayTriggered.current || autoPlayCountdown !== null) return;
    if (!hasNextEpisode || !hasStartedRef.current) return;
    const pos = state.position + effectiveMpvOffset.current;
    const d = jellyfinDuration && jellyfinDuration > 0 ? jellyfinDuration : state.duration;
    // Use detected credits segment, or fallback to configured time before end for episodes > 5 min
    const fallbackSeconds = autoplayCreditsSeconds ?? 120;
    const triggerAt = creditsSegment ? creditsSegment.start
      : (fallbackSeconds > 0 && d > 300 ? d - fallbackSeconds : null);
    if (triggerAt != null && pos >= triggerAt) {
      console.debug(DBG, "auto-play trigger", { pos, triggerAt, hasCreditsSegment: !!creditsSegment });
      creditsAutoPlayTriggered.current = true;
      startAutoPlayCountdown();
    }
  }, [state.position, creditsSegment, hasNextEpisode, autoPlayCountdown, startAutoPlayCountdown, jellyfinDuration, state.duration]);

  // EOF fallback: no credits segment detected, or movie → detail page
  useEffect(() => {
    if (state.eof && hasStartedRef.current) {
      if (hasNextEpisode && autoPlayCountdown === null) startAutoPlayCountdown();
      else if (!hasNextEpisode && itemId) goToDetail();
      else if (!hasNextEpisode) goBack();
    }
  }, [state.eof, goBack, goToDetail, hasNextEpisode, startAutoPlayCountdown, itemId, autoPlayCountdown]);

  useEffect(() => {
    return () => {
      clearInterval(autoPlayTimerRef.current);
      // Fallback: fire-and-forget exit fullscreen via cached invoke
      cachedInvoke?.("exit_fullscreen")?.catch(() => {});
      stop();
    };
  }, [stop]);

  const scheduleHide = useCallback(() => {
    clearTimeout(hideTimer.current);
    setShowControls(true);
    hideTimer.current = setTimeout(() => {
      if (!state.paused) setShowControls(false);
    }, 3000);
  }, [state.paused]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") { e.preventDefault(); togglePause(); }
      if (e.code === "Escape") {
        if (fullscreenRef.current) toggleFullscreen();
        else goBack();
      }
      if (e.code === "ArrowRight") seekRelative(30);
      if (e.code === "ArrowLeft") seekRelative(-10);
      if (e.code === "KeyF") toggleFullscreen();
      if (e.code === "KeyN" && hasNextEpisode) onNextEpisode?.();
      if (e.code === "KeyP" && hasPreviousEpisode) onPreviousEpisode?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePause, goBack, seekRelative, toggleFullscreen, hasNextEpisode, hasPreviousEpisode, onNextEpisode, onPreviousEpisode]);

  const fmt = (s: number) => {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
    const mm = String(m).padStart(2, "0"), ss = String(sec).padStart(2, "0");
    return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
  };

  const dur = jellyfinDuration && jellyfinDuration > 0 ? jellyfinDuration : state.duration;
  const actualPos = state.position + effectiveMpvOffset.current;
  const progress = dur > 0 ? actualPos / dur : 0;
  const bufProg = dur > 0 ? Math.min((actualPos + state.buffered) / dur, 1) : 0;
  const hasSettings = displayAudio.length > 0 || displaySubs.length > 0 || !!onQualityChange;

  // Map MPV state back to Jellyfin indices for the selector highlight
  const curAudioMapped = mpvAudio.length > 0
    ? findJfIndex(state.audioTrack, audioTracks, mpvAudio) : null;
  const curAudio = curAudioMapped ?? currentAudio;
  const curSubMapped = state.subtitleTrack === 0
    ? null
    : mpvSubs.length > 0
      ? findJfIndex(state.subtitleTrack, subtitleTracks, mpvSubs) : null;
  const curSub = state.subtitleTrack === 0 ? null : (curSubMapped ?? currentSubtitle);

  // Debug track state periodically (only when tracks change)
  useEffect(() => {
    console.debug(DBG, "track display state", {
      mpvAid: state.audioTrack, mpvSid: state.subtitleTrack,
      curAudioMapped, curAudio, curSubMapped, curSub: state.subtitleTrack === 0 ? null : (curSubMapped ?? currentSubtitle),
      currentAudio, currentSubtitle,
      mpvAudioTracks: mpvAudio.map(t => ({ id: t.id, lang: t.lang })),
      mpvSubTracks: mpvSubs.map(t => ({ id: t.id, lang: t.lang })),
    });
  }, [state.audioTrack, state.subtitleTrack, mpvAudio.length, mpvSubs.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Skip intro / credits segments
  const showSkipIntro = introSegment && actualPos >= introSegment.start && actualPos < introSegment.end - 1;
  const showSkipCredits = creditsSegment && actualPos >= creditsSegment.start && actualPos < creditsSegment.end - 1;

  // Show loading overlay: initial load OR source change (quality/audio switch)
  const showLoadingOverlay = sourceChanging || (!state.playing && !hasStartedRef.current);

  if (error && onFallbackToWeb) { onFallbackToWeb(); return null; }
  if (error) return (
    <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-black">
      <p className="text-lg text-red-400">{t("player:mpvError", { error })}</p>
      <button onClick={() => goBack()} className="rounded-lg bg-tentacle-accent px-6 py-2 text-white hover:bg-tentacle-accent/80">{t("common:back")}</button>
    </div>
  );
  if (!ready) return (
    <div className="relative flex h-screen w-screen items-center justify-center bg-black">
      {posterUrl && <img src={posterUrl} className="absolute inset-0 h-full w-full object-cover" alt="" />}
      <div className="absolute inset-0 flex items-center justify-center bg-black/60">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-tentacle-accent border-t-transparent" />
      </div>
    </div>
  );

  return (
    <div onMouseMove={scheduleHide} className="relative flex h-screen w-screen items-center justify-center" style={{ background: "transparent" }}>
      {/* Click catcher — toggle pause / fullscreen on video area */}
      <div className="absolute inset-0" onClick={() => { togglePause(); setShowSettings(false); }} onDoubleClick={() => toggleFullscreen()} />

      {/* Loading overlay — initial load + source changes (quality/audio) */}
      {showLoadingOverlay && posterUrl && (
        <div className="pointer-events-none absolute inset-0 z-[5]">
          <img src={posterUrl} className="h-full w-full object-cover" alt="" />
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/30 border-t-white" />
          </div>
        </div>
      )}
      {/* Spinner without poster (no poster URL available) */}
      {showLoadingOverlay && !posterUrl && (
        <div className="pointer-events-none absolute inset-0 z-[5] flex items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/30 border-t-white" />
        </div>
      )}

      {/* Buffering spinner (during playback — seeking, network stall) */}
      {state.buffering && !showLoadingOverlay && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/30 border-t-white" />
        </div>
      )}

      {/* Skip intro / credits buttons */}
      {showSkipIntro && introSegment && (
        <button onClick={() => seek(isDirectPlay ? introSegment.end : Math.max(0, introSegment.end - effectiveMpvOffset.current))}
          className="absolute bottom-28 right-6 z-20 rounded-lg border border-white/20 bg-black/60 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur-md transition-all hover:bg-white/20">
          {t("player:skipIntro")}
        </button>
      )}
      {showSkipCredits && creditsSegment && !autoPlayCountdown && (
        <button onClick={() => { if (hasNextEpisode) onNextEpisode?.(); else seek(isDirectPlay ? creditsSegment.end : Math.max(0, creditsSegment.end - effectiveMpvOffset.current)); }}
          className="absolute bottom-28 right-6 z-20 rounded-lg border border-white/20 bg-black/60 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur-md transition-all hover:bg-white/20">
          {hasNextEpisode ? t("player:nextEpisodeLabel") : t("player:skipCredits")}
        </button>
      )}

      {/* Controls overlay — pointer-events only on top/bottom bars */}
      <div className={`pointer-events-none absolute inset-0 z-10 flex flex-col justify-between transition-opacity duration-300 ${showControls ? "opacity-100" : "opacity-0"}`}>
        {/* Top bar */}
        <div className="pointer-events-auto" onClick={(e) => e.stopPropagation()}>
          <div className="bg-gradient-to-b from-black/70 to-transparent px-6 pb-10 pt-5">
            <div className="flex items-center gap-4">
              <button onClick={() => goBack()} className="rounded-full p-2 hover:bg-white/10"><BackIcon /></button>
              <div>
                <h2 className="text-lg font-semibold text-white">{title}</h2>
                {subtitle && <p className="text-sm text-white/50">{subtitle}</p>}
              </div>
              {import.meta.env.DEV && (
                <div className="ml-auto flex items-center gap-2 rounded-full bg-purple-600/30 px-3 py-1">
                  <span className="h-2 w-2 rounded-full bg-purple-400" />
                  <span className="text-xs text-purple-200">mpv{isDirectPlay ? "" : " (transcode)"}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom controls */}
        <div className="pointer-events-auto" onClick={(e) => e.stopPropagation()}>
          <div className="relative bg-gradient-to-t from-black/70 to-transparent px-6 pb-5 pt-10">
            <AnimatePresence>
              {showSettings && hasSettings && (
                <TrackSelector
                  audioTracks={displayAudio} subtitleTracks={displaySubs}
                  currentAudio={curAudio} currentSubtitle={curSub}
                  currentQuality={currentQuality}
                  onAudioChange={handleAudioChange} onSubtitleChange={handleSubtitleChange}
                  onQualityChange={onQualityChange}
                  onClose={() => setShowSettings(false)}
                />
              )}
            </AnimatePresence>

            {/* Progress bar with buffer */}
            <div className="group/bar relative mb-3 flex h-1.5 cursor-pointer items-center rounded-full bg-white/20 transition-all hover:h-2.5"
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                const pct = (e.clientX - r.left) / r.width;
                const target = pct * dur;
                seek(isDirectPlay ? target : Math.max(0, target - effectiveMpvOffset.current));
              }}>
              {/* Buffer bar */}
              <div className="absolute h-full rounded-full bg-white/10" style={{ width: `${bufProg * 100}%` }} />
              {/* Progress bar */}
              <div className="relative h-full rounded-full bg-tentacle-accent" style={{ width: `${progress * 100}%` }}>
                <div className="absolute -right-1.5 -top-0.5 h-3.5 w-3.5 rounded-full bg-white opacity-0 shadow transition-opacity group-hover/bar:opacity-100" />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {hasPreviousEpisode && (
                  <button onClick={onPreviousEpisode} className="rounded-full p-2 hover:bg-white/10" title="(P)"><PrevEpIcon /></button>
                )}
                <button onClick={() => seekRelative(-10)} className="rounded-full p-1.5 hover:bg-white/10" title="-10s">
                  <span className="text-xs font-bold text-white/70">-10</span>
                </button>
                <button onClick={() => togglePause()} className="rounded-full p-2 hover:bg-white/10">
                  {state.paused ? <PlayIcon /> : <PauseIcon />}
                </button>
                <button onClick={() => seekRelative(30)} className="rounded-full p-1.5 hover:bg-white/10" title="+30s">
                  <span className="text-xs font-bold text-white/70">+30</span>
                </button>
                {hasNextEpisode && (
                  <button onClick={onNextEpisode} className="rounded-full p-2 hover:bg-white/10" title="(N)"><NextEpIcon /></button>
                )}
                <div className="group/vol flex items-center gap-2">
                  <button onClick={() => toggleMute()} className="rounded-full p-2 hover:bg-white/10">
                    {state.muted || state.volume === 0 ? <MuteIcon /> : <VolumeIcon />}
                  </button>
                  <input type="range" min={0} max={100} step={1} value={state.volume}
                    onChange={(e) => setVolume(Number(e.target.value))}
                    className="hidden w-20 accent-tentacle-accent group-hover/vol:block" />
                </div>
                <span className="text-sm text-white/60">{fmt(actualPos)} / {fmt(dur)}</span>
              </div>
              <div className="flex items-center gap-2">
                {hasSettings && (
                  <button onClick={() => setShowSettings((p) => !p)} className="rounded-full p-2 hover:bg-white/10"><GearIcon /></button>
                )}
                <button onClick={() => toggleFullscreen()} className="rounded-full p-2 hover:bg-white/10" title="(F)">
                  {state.fullscreen ? <ExitFullscreenIcon /> : <FullscreenIcon />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {autoPlayCountdown !== null && (
          <NextEpisodeOverlay countdown={autoPlayCountdown} episodeTitle={nextEpisodeTitle}
            episodeDescription={nextEpisodeDescription} episodeImageUrl={nextEpisodeImageUrl}
            onPlayNow={() => onNextEpisode?.()} onDismiss={cancelAutoPlay} />
        )}
      </AnimatePresence>
    </div>
  );
}
