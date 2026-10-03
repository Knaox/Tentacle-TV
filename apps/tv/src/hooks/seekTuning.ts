/**
 * Les réglages du déplacement vivent dans tv-core (`player/seekTuning.ts`) :
 * ce relais ne sert plus que le banc UI (`harness/ui-bench`), le temps que
 * ses imports suivent.
 */
export { RESUME_COUNTDOWN_MS, SKIP_BACK_SECONDS, SKIP_FORWARD_SECONDS, jumpSecondsOf } from "@tentacle-tv/tv-core";
