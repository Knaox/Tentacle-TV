/**
 * La fenêtre de mpv en tant que FILLE de la nôtre : la poser, et la remettre
 * dans l'ordre.
 *
 * Séparé de `macosSurface.ts`, qui orchestre le cycle de vie : attacher une
 * fenêtre à une autre et suivre une lecture sont deux métiers, et le premier
 * tient en deux gestes.
 */

import { NSWindowBelow, cls, msg } from "./objc";

/** `NSWindowCollectionBehaviorFullScreenAuxiliary` — voir `attacherSousLaPage`. */
const NSWindowFullScreenAuxiliary = 1 << 8;

/**
 * Attache la fenêtre de mpv sous la nôtre, et la désarme.
 *
 * `NSWindowBelow` est le cœur du montage : sans lui la fenêtre passe DEVANT et
 * masque toute l'interface. `ignoresMouseEvents` est une ceinture de plus, et
 * l'ombre portée est retirée — superposée au pixel près, elle en dessinerait une
 * au ras du cadre.
 *
 * ⚠️ AUXILIAIRE DE PLEIN ÉCRAN. Sans ce comportement, une fenêtre qui n'est pas
 * elle-même en plein écran n'a pas sa place dans l'espace dédié où macOS emmène
 * la nôtre. C'est l'API prévue pour les fenêtres qui accompagnent une fenêtre
 * plein écran, et celle-ci n'est rien d'autre.
 *
 * ⚠️ OPAQUE, ET AVEC UN FOND NOIR. C'est elle qui doit garantir le noir sous la
 * page : celle-ci est transparente en permanence, et tout ce que la vidéo ne
 * couvre pas laisserait autrement voir le BUREAU. Le symptôme ne ressemble pas à
 * sa cause — un fond « pas tout à fait noir », des bordures étranges autour de
 * l'overlay et des dégradés qui semblent se composer avec autre chose que du
 * noir. C'est le cas : ils se composent avec ce qui se trouve derrière.
 */
export function attacherSousLaPage(parent: unknown, fenetre: unknown): void {
  msg.setFlag(fenetre, "setIgnoresMouseEvents:", true);
  msg.setFlag(fenetre, "setHasShadow:", false);
  msg.setComportement(
    fenetre,
    msg.count(fenetre, "collectionBehavior") | NSWindowFullScreenAuxiliary,
  );
  msg.setFlag(fenetre, "setOpaque:", true);
  const noir = msg.get(cls("NSColor"), "blackColor");
  if (noir) msg.setObjet(fenetre, "setBackgroundColor:", noir);
  msg.addChildWindow(parent, fenetre, NSWindowBelow);
}

/**
 * Réaffirme l'empilement : la vidéo sous la page, et rien d'autre entre.
 *
 * ⚠️ RETIRER D'ABORD. `addChildWindow:ordered:` appelé sur une fenêtre qui est
 * DÉJÀ fille du même parent ne réordonne rien — c'est mesuré : après un passage
 * en plein écran, la géométrie restait parfaite (`calee=oui enfant=oui
 * visible=oui`) et la vidéo passait pourtant DEVANT, emportant tout l'overlay.
 * La relation était intacte, seul l'ordre ne l'était plus, et le réaffirmer sans
 * rompre le lien ne le rétablissait pas.
 */
export function reordonnerSousLaPage(parent: unknown, fenetre: unknown): void {
  msg.removeChildWindow(parent, fenetre);
  msg.addChildWindow(parent, fenetre, NSWindowBelow);
}
