import { useEffect, type MutableRefObject } from "react";
import type { AudioTrack, SubtitleTrack } from "../components/player/videoPlayer.types";

interface UseNativeMediaTracksOptions {
  videoRef: MutableRefObject<HTMLVideoElement | null>;
  src: string;
  subtitleTracks: SubtitleTrack[];
  currentSubtitle: number | null;
  audioTracks: AudioTrack[];
  currentAudio: number;
  isDirectPlay: boolean;
}

export function useNativeMediaTracks({
  videoRef, src, subtitleTracks, currentSubtitle, audioTracks, currentAudio, isDirectPlay,
}: UseNativeMediaTracksOptions): void {
  // Subtitle track visibility — re-apply after source change and when tracks load.
  // Uses "disabled" (fully off) for non-selected tracks to prevent hls.js interference
  // (hls.js can reset "hidden" tracks to "showing" — issue #4032).
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const apply = () => {
      const targetIdx = currentSubtitle != null
        ? subtitleTracks.findIndex((s) => s.index === currentSubtitle) : -1;
      for (let i = 0; i < v.textTracks.length; i++) {
        v.textTracks[i].mode = (i === targetIdx) ? "showing" : "disabled";
      }
    };
    apply();
    // Re-apply when browser finishes loading <track> elements after source change
    v.textTracks.addEventListener("addtrack", apply);
    return () => v.textTracks.removeEventListener("addtrack", apply);
  }, [currentSubtitle, subtitleTracks, src]);

  // jellyfin-web pattern (plugin.js:setAudioStreamIndex): In Direct Play, switch
  // audio tracks natively via HTML5 audioTracks API. This avoids URL rebuild and
  // stream interruption. Supported in Firefox/Safari; Chrome requires transcoding
  // fallback (handled by Watch.tsx rebuilding the URL when native switch unavailable).
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !isDirectPlay) return;
    // HTMLMediaElement.audioTracks is not in standard TS lib — access via type cast.
    const elemTracks = (v as HTMLVideoElement & {
      audioTracks?: { readonly length: number; [i: number]: { enabled: boolean } };
    }).audioTracks;
    if (!elemTracks || elemTracks.length < 2) return;
    // Map Jellyfin stream index to position in the <video> element's audioTracks list.
    // audioTracks prop contains only Audio-type streams, in file order — same order
    // as the browser's audioTracks on the <video> element.
    const targetPos = audioTracks.findIndex((t) => t.index === currentAudio);
    if (targetPos === -1 || targetPos >= elemTracks.length) return;
    for (let i = 0; i < elemTracks.length; i++) {
      elemTracks[i].enabled = (i === targetPos);
    }
  }, [currentAudio, isDirectPlay, audioTracks]);
}
