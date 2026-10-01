import type { WhatsNewRelease } from "../types";

/**
 * 1.25.2 — entrée VIDE, en connaissance de cause, comme la 1.25.1.
 *
 * Un correctif, et il ne se montre pas : sur macOS, la vidéo ne vibre plus en
 * plein écran sur un écran sans encoche (MacBook Air, Mac mini, iMac, écran
 * externe — `apps/desktop-electron/src/main/video/macosFrameConstraint.ts`).
 * Une scène qui le mettrait en scène montrerait une image immobile, c'est-à-dire
 * rien.
 */
export const RELEASE_1_25_2: WhatsNewRelease = {
  version: "1.25.2",
  features: [],
};
