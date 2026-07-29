/**
 * Le voile de lisibilité du lecteur — en UN seul morceau sur la surface à alpha.
 *
 * # Le défaut, tel qu'il a été vu et mesuré
 *
 * Sur la coquille Electron macOS, la page a un VRAI alpha par pixel (voir
 * `ombreSurVideo.ts`) et la vidéo vit dans une fenêtre placée DESSOUS. Les deux
 * dégradés qui assombrissent le haut et le bas de l'image y laissaient chacun un
 * TRAIT NOIR NET sur toute la largeur, à l'endroit où leur alpha s'éteint, plus
 * deux arêtes verticales aux bords de l'écran.
 *
 * Mesuré au pixel, sur une image de test uniforme (gris 110), plein écran :
 *
 *   … 111, 111, 116, 122, **20, 20**, 92, 115, 115 …
 *
 * Un dipôle — une survalorisation puis un creux quasi noir — soit 93 niveaux
 * d'écart avec le voisinage. Bien visible, et c'est le « contour bizarre »
 * signalé.
 *
 * # La cause, prouvée et non déduite
 *
 * Ce n'est ni le dégradé ni la page : le MÊME dégradé posé sur un fond opaque
 * dans la page ne montre rien (écart 0,0). C'est la COMPOSITION.
 *
 * Chromium découpe la page en `CALayer` et le lancer avec
 * `--show-mac-overlay-borders` — l'outil prévu pour cela, qui trace le contour
 * des couches et des dommages partiels — dessine un rectangle magenta qui tombe
 * EXACTEMENT sur le trait, arêtes gauche et droite comprises. La couche épouse
 * la zone peinte, et son bord se compose mal sur la fenêtre du dessous.
 *
 * Écartés, tous mesurés : la forme du dégradé (paliers durs, SVG, masque), son
 * alpha final, `translateZ(0)`, `will-change`, le retrait de toute animation
 * d'opacité, un repeint plein cadre, et les commutateurs
 * `--disable-gpu-rasterization`, `--disable-partial-raster`,
 * `--disable-gpu-compositing`, `--disable-mac-overlays`. Aucun n'y change quoi
 * que ce soit — l'écart reste à 93,2 au dixième près.
 *
 * # Ce qu'on fait, et pourquoi ça marche
 *
 * Si la couche épouse la zone peinte, il suffit que la zone peinte soit TOUTE la
 * fenêtre : son bord tombe alors sur celui de la fenêtre, où il ne se voit pas.
 * D'où un voile unique, plein cadre, dont l'alpha ne descend jamais à zéro.
 *
 * ⚠️ Le plancher n'est pas cosmétique. Mesuré : à 0,04 le trait est TOUJOURS là
 * (écart 92,7) — Chromium rogne la couche là où l'alpha devient négligeable. À
 * 0,08 il disparaît (écart −0,1 en haut, 0,6 en bas), confirmé deux fois en
 * alternance avec la référence.
 *
 * Le prix est un assombrissement de 8 % de l'image ENTIÈRE, et seulement pendant
 * que les contrôles sont affichés. Windows et le web ne sont pas concernés :
 * leur surface n'a pas d'alpha par pixel, et ils gardent les deux dégradés.
 */

import { surfaceAvecAlpha } from "./ombreSurVideo";

/** Le plancher d'alpha sous lequel Chromium rogne la couche — voir l'en-tête. */
const PLANCHER = 0.08;

/** L'assombrissement au ras des bords, haut et bas : celui d'aujourd'hui. */
const BORD = 0.7;

/**
 * Le voile plein cadre, ou `null` là où les deux dégradés suffisent.
 *
 * @param haut Hauteur de la barre du titre, en pixels CSS.
 * @param bas Hauteur de la barre de contrôles, en pixels CSS.
 */
export function videoScrim(haut: number, bas: number): string | null {
  if (!surfaceAvecAlpha()) return null;
  return (
    `linear-gradient(to bottom, rgba(0,0,0,${BORD}) 0px, rgba(0,0,0,${PLANCHER}) ${haut}px,` +
    ` rgba(0,0,0,${PLANCHER}) calc(100% - ${bas}px), rgba(0,0,0,${BORD}) 100%)`
  );
}
