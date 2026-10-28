/**
 * Octave (mobile) — ce que l'axe `m2` branche dans la coquille : le lecteur (`OctavePlayerProvider` : moteur
 * natif `octave-audio` et file), le mini-lecteur et le lecteur plein écran en recouvrement.
 * Seul `m2` édite ce fichier.
 */

import { MiniPlayer, NowPlayingSheet, OctavePlayerProvider } from "../../player";
import type { OctaveAxisContribution } from "../octaveRegistryTypes";

export const m2Contribution: OctaveAxisContribution = {
  providers: [OctavePlayerProvider],
  miniPlayer: MiniPlayer,
  overlays: [NowPlayingSheet],
};
