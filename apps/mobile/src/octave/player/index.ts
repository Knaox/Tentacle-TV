/**
 * Octave (mobile) — le LECTEUR : ce que les autres axes importent. Le fournisseur (`OctavePlayerProvider`,
 * monté par la coquille), les crochets (`useOctavePlayer`… : la même API que le web), le mini-lecteur et le
 * lecteur plein écran (posés par la coquille), et l'ouverture du lecteur depuis un écran.
 *
 * Tout ici n'existe que DERRIÈRE la porte d'Octave (`OctaveGate` : serveur qui déclare Octave, compte qui y a
 * accès) — rien d'Octave sur un serveur d'avant. Droits (règle 15 du lot) : aucune action du lecteur ne relève
 * aujourd'hui d'un droit du serveur (lecture, file, position, aléatoire, répétition, transition douce de
 * l'appareil). Une action qui en relèverait — cœur, ajout à une playlist, garder hors ligne, partage — passe par
 * les crochets partagés qui lisent ces droits (`useTrackActions`, `fetchMusicRights`… d'api-client) et n'est PAS
 * affichée sans le droit ; jamais une règle recopiée ici.
 */
export { OctavePlayerProvider, useOctavePlayer, useOptionalOctavePlayer, usePlayerSelector, usePlayerPosition, useCurrentKey } from "./OctavePlayerContext";
export { MiniPlayer, type MiniPlayerProps } from "./MiniPlayer";
export { NowPlayingSheet } from "./NowPlayingSheet";
export { openNowPlaying, closeNowPlaying, useNowPlayingOpen } from "./nowPlayingStore";
export { CrossfadeChip, CrossfadePanel } from "./CrossfadeControl";
export { setOctaveKeptFileResolver, type KeptFileResolver, type KeptFileRequest } from "../audio/keptAudioPort";
export { useCrossfadeMs, setCrossfadeMs } from "../audio/crossfadeSetting";
