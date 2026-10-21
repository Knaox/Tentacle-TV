/**
 * Quel habillage pour le lecteur du bureau : le verre NATIF, ou celui d'avant.
 *
 * # Pourquoi le lecteur a sa propre porte
 *
 * Partout ailleurs, la page peut flouter ce qu'elle dessine. Pas sur le
 * lecteur : la vidéo n'est jamais dans la page. Sur Apple Silicon, mpv dessine
 * dans SA fenêtre Metal, placée SOUS notre fenêtre transparente — Chromium ne
 * voit pas l'image et ne peut pas la réfracter. Seules des vues de verre
 * natives (NSGlassEffectView), posées derrière la page, réfractent la vraie
 * image. D'où trois conditions, et aucune ne se devine :
 *
 *  - le réglage « Liquid Glass » est allumé (Réglages › Apparence) ;
 *  - la coquille sait poser du verre natif (macOS 26, module chargé) ;
 *  - la vidéo est SOUS la fenêtre (montage `fenetre`). Sur Intel, mpv dessine
 *    par OpenGL DANS notre fenêtre (`vo=libmpv`) : le verre natif n'y a rien
 *    à réfracter, le lecteur garde son habillage d'avant.
 *
 * Il n'y a PAS de repli « verre de la page » : sur la vidéo, un flou CSS ne
 * floute rien (cf. `SkipBadge`). C'est le verre natif, ou le rendu d'avant au
 * pixel près.
 *
 * `preview` n'existe qu'en développement : la mise en page du verre, peinte
 * par la page (aplats), pour la juger avant que le socle natif ne soit là.
 * Jamais dans un paquet livré.
 */

export type PlayerGlassMode = "native" | "preview" | "legacy";

export interface PlayerGlassInputs {
  /** Choix de l'utilisateur (`tentacle_liquid_glass`). */
  enabled: boolean;
  /** La coquille pose du verre natif sur CET appareil (OS, module). */
  nativeAvailable: boolean;
  /** La vidéo est dans une fenêtre sous la nôtre (montage macOS `fenetre`). */
  videoUnderWindow: boolean;
  /** Aperçu de développement demandé (jamais vrai dans un paquet livré). */
  devPreview: boolean;
}

export function decidePlayerGlassMode(inputs: PlayerGlassInputs): PlayerGlassMode {
  if (!inputs.enabled) return "legacy";
  if (inputs.nativeAvailable && inputs.videoUnderWindow) return "native";
  return inputs.devPreview ? "preview" : "legacy";
}

/** Le lecteur rend-il la mise en page du verre (natif ou aperçu) ? */
export function isGlassLayout(mode: PlayerGlassMode): boolean {
  return mode !== "legacy";
}
