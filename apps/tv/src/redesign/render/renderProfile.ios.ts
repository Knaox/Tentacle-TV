import { RENDER_PROFILES, type RenderProfile, type RenderTier } from "@tentacle-tv/tv-core";

/** Le niveau de rendu de l'Apple TV : toujours `normal`. */
export const DEVICE_TIER: RenderTier = "normal";

/** Le profil de rendu de l'Apple TV — voir `renderProfile.ts`. */
export const RENDER: Readonly<RenderProfile> = RENDER_PROFILES.tvos;
