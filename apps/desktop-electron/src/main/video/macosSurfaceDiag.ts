/**
 * L'état géométrique du montage à deux fenêtres, en une ligne.
 *
 * Une capture d'écran demande une autorisation système qu'on n'a pas toujours ;
 * ces nombres, eux, disent objectivement si la vidéo occupe la bonne surface,
 * si elle est bien fille de la nôtre, et laquelle des deux est devant. Chacun a
 * servi au moins une fois à trancher un symptôme dont la cause ne se devinait
 * pas — l'écart entre le cadre et le rectangle de contenu valait 32 points, et
 * c'est par là qu'on voyait le bureau.
 *
 * Séparé de `macosSurface.ts` pour tenir la limite de 300 lignes : décrire un
 * montage et le tenir sont deux métiers.
 */

import type { BrowserWindow } from "electron";
import { fmt, memeRect } from "./macosFrame";
import { cls, msg, type Rect } from "./objc";

export function decrireMontage(
  host: BrowserWindow,
  parent: unknown,
  mpvWindow: unknown,
  cible: Rect,
): string {
  const video: Rect = msg.rect(mpvWindow, "frame");
  const colle = memeRect(cible, video);
  const enfant = msg.get(mpvWindow, "parentWindow") !== null;
  const visible = msg.bool(mpvWindow, "isVisible");
  // La cible ET ce qu'Electron pense couvrir : quand les deux divergent, il
  // reste une bande de fenêtre que personne ne peint — on y voit le bureau à
  // travers, la surface de la page étant transparente. C'est le seul moyen de
  // distinguer ce liseré-là d'une bande noire de format scope, qui lui
  // ressemble à s'y méprendre.
  const b = host.getBounds();
  const c = host.getContentBounds();
  // Les NIVEAUX des deux fenêtres : c'est ce qui décide de l'empilement quand
  // la relation parent-enfant, elle, est intacte. Un niveau vidéo supérieur à
  // celui de la page veut dire que l'overlay est passé dessous.
  const niveaux = `${msg.entier(parent, "level")}/${msg.entier(mpvWindow, "level")}`;
  // Les deux formes de plein écran : le lecteur emprunte le SIMPLE sur macOS
  // (voir `fullscreen.ts`), que `isFullScreen()` ne rapporte pas.
  const pleinEcran = host.isFullScreen()
    ? "natif"
    : host.isSimpleFullScreen()
      ? "simple"
      : "non";
  return (
    `cible=${fmt(cible)} video=${fmt(video)} calee=${colle ? "oui" : "NON"} ` +
    `electron fenetre=${b.width}x${b.height} page=${c.width}x${c.height} ` +
    `enfant=${enfant ? "oui" : "NON"} visible=${visible ? "oui" : "NON"} ` +
    `niveaux=${niveaux} pleinEcran=${pleinEcran} ${ecran(parent)}`
  );
}

/**
 * L'écran qui porte la fenêtre : son cadre, et sa portion « visible ».
 *
 * ⚠️ Sans ces deux nombres, le plein écran ne se diagnostique pas. `visibleFrame`
 * est le plafond que mpv impose à toute fenêtre (`macosFrame.ts`), et sur un Mac
 * à encoche il s'arrête 33 points sous le haut de l'écran — que la barre de
 * menus soit masquée ou non. Un `cible` de 982 de haut pour un `visible` de 949
 * dit à lui seul pourquoi une bande de bureau apparaît.
 */
function ecran(parent: unknown): string {
  const e = msg.get(parent, "screen") ?? msg.get(cls("NSScreen"), "mainScreen");
  if (!e) return "ecran=?";
  return `ecran=${fmt(msg.rect(e, "frame"))} visibleEcran=${fmt(msg.rect(e, "visibleFrame"))}`;
}
