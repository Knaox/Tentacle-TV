import { RENDER_PROFILES, type RenderProfile } from "@tentacle-tv/tv-core";

/**
 * LE profil de rendu de l'appareil (`@tentacle-tv/tv-core`, `render/`) — le
 * seul aiguillage de plateforme du rendu de la refonte : ombres, verre,
 * mouvement, halos lisent ICI ce qu'ils dessinent. Choisi par le suffixe du
 * fichier, sans `Platform.OS` : celui-ci sert Android TV,
 * `renderProfile.ios.ts` l'Apple TV.
 */
export const RENDER: Readonly<RenderProfile> = RENDER_PROFILES.androidtv;
