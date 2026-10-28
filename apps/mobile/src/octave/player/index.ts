/**
 * Octave (mobile) — le LECTEUR : ce que les autres axes importent. Le fournisseur (`OctavePlayerProvider`,
 * monté par la coquille), les crochets (`useOctavePlayer`… : la même API que le web), le mini-lecteur et le
 * lecteur plein écran (posés par la coquille), et l'ouverture du lecteur depuis un écran.
 */
export { OctavePlayerProvider, useOctavePlayer, useOptionalOctavePlayer, usePlayerSelector, usePlayerPosition, useCurrentKey } from "./OctavePlayerContext";
export { MiniPlayer, type MiniPlayerProps } from "./MiniPlayer";
export { NowPlayingSheet } from "./NowPlayingSheet";
export { openNowPlaying, closeNowPlaying, useNowPlayingOpen } from "./nowPlayingStore";
export { CrossfadeChip, CrossfadePanel } from "./CrossfadeControl";
export { setOctaveKeptFileResolver, type KeptFileResolver, type KeptFileRequest } from "../audio/keptAudioPort";
export { useCrossfadeMs, setCrossfadeMs } from "../audio/crossfadeSetting";
