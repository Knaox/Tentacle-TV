import type { PlatformTraits } from "./platformTraits";

/**
 * Les traits de l'Apple TV (la base) ; `traits.android.ts`, son jumeau, sert
 * Android TV. La forme : `platformTraits.ts`.
 */
export const PLATFORM_TRAITS: PlatformTraits = {
  liquidGlass: true,
  // L'AVPlayer ne dit pas sa première image au lecteur : la règle d'avant.
  playerAnnouncesFirstFrame: false,
  renderTierSetting: false,
};
