import { TV_STAGE } from "@tentacle-tv/theme";
import { RENDER } from "../render/renderProfile";

/**
 * L'habit du focus des cartes, lu dans le profil de rendu : `lift` (la carte
 * grandit, se soulève, s'éclaire), ou `outline` (Lite : un liseré d'accent, à
 * sa taille). Tout ce qui SUIT l'agrandissement (une légende qui descend avec
 * l'image, la place gardée sous une rangée) lit `CARD_FOCUS_SCALE` : 1 en
 * Lite, la carte ne grandit pas — rien ne bouge pour rien.
 */
export const CARD_FOCUS_OUTLINE: boolean = RENDER.cardFocus === "outline";

/** L'agrandissement d'une carte focalisée (× 1,08 ; 1 en Lite). */
export const CARD_FOCUS_SCALE: number = CARD_FOCUS_OUTLINE ? 1 : TV_STAGE.focus.cardScale;
