/**
 * La fenêtre de mpv en tant que FILLE de la nôtre : la poser, et la remettre
 * dans l'ordre.
 *
 * Séparé de `macosSurface.ts`, qui orchestre le cycle de vie : attacher une
 * fenêtre à une autre et suivre une lecture sont deux métiers, et le premier
 * tient en deux gestes.
 */

import { trace } from "./native";
import { NSWindowBelow, cls, msg } from "./objc";

/**
 * Les trois bits de plein écran d'un `collectionBehavior` — voir `pleinEcranAuxiliaire`.
 *
 * ⚠️ Ils s'EXCLUENT. « You may specify only one of
 * NSWindowCollectionBehaviorFullScreenPrimary, …Auxiliary, or …None », dit la
 * documentation, et une fenêtre qui en porte deux se comporte de façon indéfinie.
 */
const PRIMARY = 1 << 7;
const AUXILIARY = 1 << 8;
const AUCUN = 1 << 9;

/**
 * `NSWindowCollectionBehaviorCanJoinAllSpaces` — la fenêtre est dans TOUS les
 * bureaux à la fois.
 *
 * ⚠️ C'est nous qui le faisons poser, par l'option `on-all-workspaces`, et
 * uniquement le temps que mpv affiche sa fenêtre sans que macOS lui ouvre un
 * bureau (voir `macosOptionsFenetre.ts`). Passé cet instant il n'a plus lieu
 * d'être, et le GARDER serait un défaut à lui seul : la vidéo suivrait
 * l'utilisateur d'un bureau à l'autre, seule, sans sa page.
 */
const TOUS_LES_BUREAUX = 1 << 0;

/**
 * Rend le comportement demandé : auxiliaire de plein écran, et lui seul.
 *
 * ⚠️ mpv déclare sa fenêtre `FullScreenPrimary` — il sait faire son propre plein
 * écran. Ajouter `Auxiliary` PAR-DESSUS laissait les deux bits posés, et macOS
 * ouvrait alors un SECOND espace de plein écran, noir, à côté du nôtre. Il faut
 * donc retirer les autres, pas seulement poser le sien.
 */
function pleinEcranAuxiliaire(courant: number): number {
  return (courant & ~PRIMARY & ~AUCUN & ~TOUS_LES_BUREAUX) | AUXILIARY;
}

/** `NSWindowStyleMaskBorderless` — aucun style, donc aucune décoration. */
const SANS_DECORATION = 0;

/** Le style que mpv a donné à sa fenêtre, pour le lui rendre en sortant. */
let styleDorigine = 0;

/**
 * Retire son cadre à la fenêtre de mpv EN PLEIN ÉCRAN, et le lui rend ensuite.
 *
 * # Le liseré, et d'où il vient
 *
 * `--border=no` ne suffit pas : côté mpv il se contente de MASQUER la barre de
 * titre (`didSet { if !border { common.titleBar?.hide() } }`), en laissant
 * `NSWindowStyleMaskTitled` posé — mesuré, `styleMask` = 32783. macOS dessine
 * alors sa bordure claire sur le bord supérieur, et notre page transparente la
 * laisse voir : un liseré gris neutre d'un point, à la frontière du
 * `visibleFrame`. C'est un défaut connu du côté d'Electron aussi, dont la
 * fenêtre est `titled` et non opaque (electron#17944, electron#15008, tous deux
 * sans correctif).
 *
 * # Pourquoi seulement en plein écran
 *
 * ⚠️ `borderless` supprime le liseré (mesuré : y=66 passe de (50,50,50) à
 * (0,0,0)) mais emporte deux choses avec lui — les coins ARRONDIS, qui laissent
 * dépasser un rectangle pendant la lecture, et le déplacement de la fenêtre à la
 * souris. Les deux ont été signalés quand on l'appliquait en permanence.
 *
 * Or aucun des deux n'a de sens en plein écran : l'écran est rectangulaire, et
 * une fenêtre en plein écran ne se déplace pas. On ne paie donc rien là où le
 * liseré gêne, et on ne touche à rien là où le cadre sert.
 *
 * ⚠️ Écartés, mesurés : `title-bar=no` côté mpv l'ATTÉNUE seulement (50 → 14,6)
 * sans le supprimer ; retirer l'ombre de la fenêtre principale l'AGGRAVE
 * (14,6 → 50).
 */
export function cadreSelonPleinEcran(fenetre: unknown, pleinEcran: boolean): void {
  if (!fenetre) return;
  const courant = msg.count(fenetre, "styleMask");
  if (pleinEcran) {
    if (courant === SANS_DECORATION) return;
    styleDorigine = courant;
    msg.setMasqueStyle(fenetre, SANS_DECORATION);
    return;
  }
  if (courant !== SANS_DECORATION || styleDorigine === 0) return;
  msg.setMasqueStyle(fenetre, styleDorigine);
}

/**
 * Attache la fenêtre de mpv sous la nôtre, et la désarme.
 *
 * `NSWindowBelow` est le cœur du montage : sans lui la fenêtre passe DEVANT et
 * masque toute l'interface. `ignoresMouseEvents` est une ceinture de plus, et
 * l'ombre portée est retirée — superposée au pixel près, elle en dessinerait une
 * au ras du cadre.
 *
 * ⚠️ AUXILIAIRE DE PLEIN ÉCRAN, ET RIEN D'AUTRE. Sans ce comportement, une
 * fenêtre qui n'est pas elle-même en plein écran n'a pas sa place dans l'espace
 * dédié où macOS emmène la nôtre. Mais mpv déclare la sienne `FullScreenPrimary`
 * — mesuré, `collectionBehavior` vaut 128 à la naissance — et les trois bits de
 * plein écran s'EXCLUENT : d'où `pleinEcranAuxiliaire`, qui remplace au lieu
 * d'ajouter, 128 → 256.
 *
 * ⚠️ Et le poser ICI ne suffit à rien tant que mpv a déjà affiché sa fenêtre :
 * AppKit ne consulte ce comportement qu'à l'AFFICHAGE INITIAL, et il vaut
 * encore 128 à cet instant-là. C'est pourquoi une lecture qui démarre en plein
 * écran demande à mpv de ne pas afficher du tout — voir `deminiaturiser` et
 * `macosOptionsFenetre.ts`. L'ordre des gestes de cette fonction n'est donc pas
 * indifférent : le comportement AVANT `addChildWindow:`, jamais après.
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
  const avant = msg.count(fenetre, "collectionBehavior");
  msg.setComportement(fenetre, pleinEcranAuxiliaire(avant));
  // Tracé : c'est le seul témoin si mpv change un jour ce qu'il déclare, et le
  // symptôme — un second bureau noir apparu à côté du nôtre — ne désigne rien.
  trace(`comportement fenetre video ${avant} → ${msg.count(fenetre, "collectionBehavior")}`);
  msg.setFlag(fenetre, "setOpaque:", true);
  const noir = msg.get(cls("NSColor"), "blackColor");
  if (noir) msg.setObjet(fenetre, "setBackgroundColor:", noir);
  msg.addChildWindow(parent, fenetre, NSWindowBelow);
  deminiaturiser(fenetre);
}

/**
 * Affiche la fenêtre que mpv n'a PAS affichée — c'est ici, et seulement ici,
 * que l'affichage initial a lieu.
 *
 * ⚠️ Une lecture qui démarre en plein écran passe `window-minimized=yes` à mpv
 * (`macosOptionsFenetre.ts`) : il crée sa fenêtre sans jamais appeler
 * `orderFront`. C'est alors `addChildWindow:`, juste au-dessus, qui l'affiche —
 * après `FullScreenAuxiliary`, donc avec le bon comportement sous les yeux
 * d'AppKit.
 *
 * En pratique cette fonction ne fait RIEN, et c'est la mesure qui le dit :
 * `miniaturisee=non` à la découverte. `performMiniaturize:` sur une fenêtre qui
 * n'a jamais été à l'écran ne prend pas effet — rien à ranger dans le Dock, pas
 * d'animation, pas d'icône. Seul le `if !minimized` qui garde `orderFront` a
 * compté.
 *
 * Elle reste comme FILET : le jour où une version de macOS miniaturiserait
 * vraiment, l'image manquerait entièrement, et rien d'autre ne le dirait.
 */
function deminiaturiser(fenetre: unknown): void {
  if (!msg.bool(fenetre, "isMiniaturized")) return;
  msg.avecNil(fenetre, "deminiaturize:");
  trace(`fenetre video sortie du Dock, miniaturisee=${msg.bool(fenetre, "isMiniaturized")}`);
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
