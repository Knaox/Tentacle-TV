/**
 * Poser un cadre EXACT sur la fenêtre de mpv — malgré mpv.
 *
 * # Le problème, et il n'est pas dans notre code
 *
 * `NSWindow` fait passer tout `setFrame:display:` par
 * `constrainFrameRect:toScreen:`, et **mpv le redéfinit**
 * (`video/out/mac/window.swift`). Sa version CORRIGE le cadre demandé, et deux
 * de ses clauses nous frappent de plein fouet :
 *
 * ```swift
 * // 1. rien ne dépasse le `visibleFrame` par le haut
 * if nf.maxY > vf.maxY { nf.origin.y = vf.maxY - nf.height }
 * // 2. une fenêtre qui rapetisse est RECENTRÉE verticalement
 * if nf.height < vf.height && of.height > vf.height && !isInFullscreen {
 *     nf.origin.y = (vf.height - nf.height) / 2
 * }
 * ```
 *
 * La SECONDE est celle que ce module désarme. Mesurée sur ce poste — MacBook
 * Pro 14", écran 1512x982, `visibleFrame` 949 — au retour du plein écran :
 * `300,120 1280x800` demandé, `300,74 1280x800` obtenu. C'est le décalage de la
 * vidéo dans sa fenêtre, constaté à chaque sortie de plein écran.
 *
 * ⚠️ `setFrameOrigin:` ne contourne rien (mesuré : même cadre contraint), et
 * `setContentSize:` fait pire encore (`0,-65 1512x1014`).
 *
 * # La sortie, et c'est mpv qui la fournit
 *
 * La première ligne de sa redéfinition rend le cadre TEL QUEL pour une fenêtre
 * posée au niveau du bureau :
 *
 * ```swift
 * if … || level == NSWindow.Level(Int(CGWindowLevelForKey(.desktopWindow))) {
 *     return frameRect
 * }
 * ```
 *
 * On l'y pose donc le temps d'un appel, et on la rend à son niveau aussitôt.
 * Les deux messages encadrent le `setFrame:` dans le MÊME tour de boucle : rien
 * n'est composé entre-temps, et la fenêtre ne passe jamais visiblement derrière
 * le fond d'écran.
 *
 * ⚠️ Ce désarmement-là est PONCTUEL, et il ne suffit pas au plein écran : macOS
 * réapplique la contrainte de lui-même une fraction de seconde plus tard, et la
 * fenêtre se met à osciller. Le plein écran se règle ailleurs, en faisant cesser
 * la contrainte à la source — voir `macosFullscreen.ts`.
 */

import type { BrowserWindow } from "electron";
import { trace } from "./native";
import { msg, type Rect } from "./objc";

/** Un rectangle, en une chaîne courte. */
export function fmt(r: Rect): string {
  return `${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}`;
}

/**
 * Le rectangle que la vidéo doit occuper — et ce n'est PAS toujours le
 * rectangle de contenu.
 *
 * ⚠️ `transparent: true` retire la barre de titre de la fenêtre, et Chromium
 * peint alors sur la totalité du cadre. AppKit, lui, continue de la déduire :
 * `contentRectForFrameRect:` rend 32 points de moins. Caler la vidéo là-dessus
 * laissait donc une bande de 32 points en haut de la fenêtre que PERSONNE ne
 * peignait — ni la vidéo, qui s'arrêtait avant, ni la page, transparente. On y
 * voyait le bureau à travers : le liseré parasite constaté au bord de
 * l'overlay, et mesuré alors (`ecart=32`).
 *
 * On demande donc à Electron, seul à savoir ce que la webview couvre
 * réellement : quand sa zone de contenu fait la hauteur de la fenêtre, c'est le
 * cadre entier qu'il faut viser. Aucune supposition sur la décoration — une
 * fenêtre qui retrouverait sa barre de titre serait servie correctement sans
 * qu'une ligne change.
 */
export function cibleVideo(host: BrowserWindow, parent: unknown): Rect {
  const cadre: Rect = msg.rect(parent, "frame");
  const pageCouvreLeCadre = host.getBounds().height === host.getContentBounds().height;
  return pageCouvreLeCadre ? cadre : msg.contentRect(parent, cadre);
}

/**
 * `CGWindowLevelForKey(kCGDesktopWindowLevelKey)`, en dur.
 *
 * `INT32_MIN + 25`. La constante est fixée par CoreGraphics et c'est la valeur
 * que mpv compare ; la lire à l'exécution demanderait de charger CoreGraphics
 * pour un entier qui ne bouge pas depuis Mac OS X 10.0.
 */
export const NIVEAU_BUREAU = -2147483623;

/** Deux rectangles au point près — les cadres sont des flottants. */
export function memeRect(a: Rect, b: Rect): boolean {
  return (
    Math.abs(a.x - b.x) < 1 &&
    Math.abs(a.y - b.y) < 1 &&
    Math.abs(a.width - b.width) < 1 &&
    Math.abs(a.height - b.height) < 1
  );
}

/**
 * Cale la fenêtre sur `cible`, sans que mpv puisse y redire.
 *
 * `niveauNormal` est le niveau à rendre ensuite : celui du parent, que la
 * relation de filiation impose. Il est LU par l'appelant et non deviné —
 * `addChildWindow:` aligne le niveau d'une fille sur celui de son parent, et
 * mémoriser une valeur ici la rendrait fausse au premier changement.
 */
export function poserCadre(fenetre: unknown, cible: Rect, niveauNormal: number): void {
  if (!fenetre) return;
  if (memeRect(msg.rect(fenetre, "frame"), cible)) return;
  msg.setNiveau(fenetre, NIVEAU_BUREAU);
  try {
    msg.setFrame(fenetre, cible);
  } finally {
    // `finally` et non la ligne suivante : une fenêtre laissée au niveau du
    // bureau passe DERRIÈRE le fond d'écran — mesuré, la vidéo disparaissait
    // sous les icônes du bureau alors que la sonde la voyait toujours (elle
    // capture la fenêtre, pas l'écran). Le calage est un confort, sa panne ne
    // doit pas emporter l'image.
    msg.setNiveau(fenetre, niveauNormal);
  }
  // Tracé seulement quand l'échappatoire elle-même a échoué : ce serait le
  // signe que mpv a changé de code, et rien d'autre ne le dirait — le symptôme
  // à l'écran est une bande de bureau qu'on prendrait pour un défaut de la page.
  const obtenu = msg.rect(fenetre, "frame");
  if (!memeRect(obtenu, cible)) {
    trace(`cadre REFUSE — demande ${fmt(cible)}, obtenu ${fmt(obtenu)}`);
  }
}
