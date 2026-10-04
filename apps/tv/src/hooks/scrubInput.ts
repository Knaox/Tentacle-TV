import { scrubInputProfileOf } from "@tentacle-tv/tv-core";
import { REMOTE_BINDINGS } from "../platform/input";
import { REDESIGN_ACTIVE } from "../redesignWiring/redesignGate";
import type { ScrubInputProfile } from "./scrubGestureTypes";

/**
 * Les flèches du lecteur, telles que la télécommande les émet — lues dans les
 * traits de sa table (tv-core `scrubInputProfileOf`), jamais dans un nom de
 * plateforme. Apple TV et Android TV refondu reçoivent un maintien ANNONCÉ
 * (`longLeft` au seuil, puis au relâchement) : un appui saute, un maintien
 * défile dès son début et s'arrête à sa fin — les mêmes pas, la même
 * accélération.
 *
 * L'ancienne UI d'Android TV (tant que l'aiguillage la garde) lit encore les
 * key-down bruts de `useTVRemote` : son profil d'avant, à retirer avec elle.
 */
export const SCRUB_INPUT: ScrubInputProfile = scrubInputProfileOf(
  REDESIGN_ACTIVE ? REMOTE_BINDINGS.traits : { announcedHolds: false },
);
