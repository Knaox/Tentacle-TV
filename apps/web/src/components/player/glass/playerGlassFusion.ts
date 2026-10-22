/**
 * La fusion des verres du lecteur — l'équivalent NATIF de `<GlassFusion
 * spacing={8}>` (décision du lot) : `GlassFusion` dessine ses formes dans la
 * page, qui ne voit pas la vidéo ; ici ce sont les régions d'un même groupe qui
 * partagent un NSGlassEffectContainerView, et AppKit les fond à moins de
 * `spacing` points.
 *
 * Au repos, les capsules du lecteur sont SÉPARÉES (écarts de 10 px, au-delà de
 * la distance de fusion) : de petites formes qui flottent, jamais une dalle. Elles
 * ne se fondent qu'en mouvement — repliées vers leur pivot quand les contrôles
 * paraissent ou s'effacent (`collapse`), ou quand un panneau NAÎT de son bouton
 * (`glassMorphProps`, lg-physique) et traverse sa capsule avant de s'en détacher.
 */

/** Le groupe des capsules et de leurs panneaux. */
export const PLAYER_GLASS_GROUP = "player";

/** Distance de fusion du groupe, en px CSS (décision du lot : 8). */
export const PLAYER_FUSION_SPACING = 8;

/** Les identifiants de métamorphose bouton → panneau (`glassMorphProps`). */
export const PLAYER_MORPH = {
  tracks: "player-tracks",
  episodes: "player-episodes",
  speed: "player-speed",
} as const;

export type PlayerMorphId = (typeof PLAYER_MORPH)[keyof typeof PLAYER_MORPH];
