/**
 * La fusion des verres du lecteur — l'équivalent NATIF de `<GlassFusion
 * spacing={8}>` (décision du lot) : `GlassFusion` dessine ses formes dans la
 * page, qui ne voit pas la vidéo ; ici ce sont les régions d'un même groupe qui
 * partagent un NSGlassEffectContainerView, et AppKit les fond à moins de
 * `spacing` points.
 *
 * Les contrôles et les popovers ne s'en servent plus (lot lg8) : ils se
 * MATÉRIALISENT, chacun dans SON conteneur (`playerGlassMaterialize.ts`) — plus
 * de goutte. Le groupe reste celui des surfaces qui ne se matérialisent pas.
 */

/** Le groupe des capsules et de leurs panneaux. */
export const PLAYER_GLASS_GROUP = "player";

/** Distance de fusion du groupe, en px CSS (décision du lot : 8). */
export const PLAYER_FUSION_SPACING = 8;

/** Les boutons d'où naissent les popovers (`popoverAnchorProps`, `usePopoverOrigin`). */
export const PLAYER_MORPH = {
  tracks: "player-tracks",
  episodes: "player-episodes",
  speed: "player-speed",
} as const;

export type PlayerMorphId = (typeof PLAYER_MORPH)[keyof typeof PLAYER_MORPH];
