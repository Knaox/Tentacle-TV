/**
 * Les ombres portées des éléments posés SUR la vidéo.
 *
 * # Le défaut, mesuré
 *
 * ⚠️ Sur la coquille Electron macOS, la fenêtre est fabriquée `transparent:
 * true` — c'est la seule façon d'obtenir une surface avec canal alpha, donc de
 * laisser voir la fenêtre de mpv placée dessous, et c'est aussi ce dont dépend
 * toute la plage étendue. La page a donc un VRAI alpha par pixel.
 *
 * Une ombre portée large n'y survit pas : son dégradé sort quasi opaque sur
 * toute son étendue au lieu de s'estomper. À l'écran, un rectangle noir aux
 * coins très arrondis, nettement plus grand que l'élément, masque la vidéo — le
 * « contour bizarre » constaté autour de la vignette de survol et autour du
 * panneau de diagnostic. Capture d'écran à l'appui, sur les deux.
 *
 * # Pourquoi Windows n'a jamais rien montré
 *
 * La fenêtre n'y est PAS fabriquée transparente : Chromium peint dans une
 * surface sans alpha par pixel, et c'est le compositeur du système qui laisse
 * voir mpv. Ces ombres s'y fondent dans le noir du fond — elles ne se voient
 * tout simplement pas.
 *
 * # Ce qu'on fait, et pourquoi c'est la PARITÉ
 *
 * On sert le liseré seul là où la surface a un canal alpha. Le rendu obtenu est
 * exactement celui de Windows, où l'ombre n'était de toute façon pas visible —
 * ce n'est donc pas un appauvrissement du dessin, c'est le même dessin, enfin
 * obtenu des deux côtés.
 */

import { desktopPlatform, isElectronShell } from "../desktop/bridge";

/**
 * La surface de la page a-t-elle un canal alpha par pixel ?
 *
 * Figé au chargement : ni la coquille ni la plateforme ne changent en cours de
 * session, et cette fonction est appelée à chaque rendu de la vignette de
 * survol — laquelle suit le curseur.
 */
const SURFACE_ALPHA = isElectronShell() && desktopPlatform() === "macos";

export function surfaceAvecAlpha(): boolean {
  return SURFACE_ALPHA;
}

/**
 * L'ombre à poser, selon la surface.
 *
 * @param complete Ce qu'on veut là où l'ombre se compose correctement.
 * @param liseré Le seul contour, sans flou — voir l'en-tête pour le pourquoi.
 */
export function ombreSurVideo(complete: string, liseré: string): string {
  return SURFACE_ALPHA ? liseré : complete;
}

/**
 * Le liseré d'AppKit sur la fenêtre de mpv, couvert depuis la page.
 *
 * ⚠️ Contrepartie DIRECTE du retrait de l'ombre de la fenêtre principale
 * (`window.ts`, `setPlayerSurfaceTransparent`). Cette ombre dessinait le halo
 * autour du texte et de la barre, mais elle assombrissait aussi, par accident,
 * la bordure claire qu'AppKit peint sur le bord supérieur de la fenêtre de mpv
 * — laquelle garde son `styleMask` titré en fenêtré. Mesuré côté processus
 * principal : 14,6 avec l'ombre, 50 sans. Retirer l'une révèle l'autre.
 *
 * On la couvre donc ici, par un trait NET d'un pixel : sans flou, il ne peut pas
 * sortir en aplat comme le ferait une ombre portée sur cette surface (voir
 * l'en-tête). Un pixel de vidéo au ras du bord, contre un liseré gris sur toute
 * la largeur.
 *
 * Rien en plein écran : `cadreSansLisere` y passe la fenêtre de mpv en
 * `borderless`, la bordure n'existe plus.
 */
export function bordureVideo(pleinEcran: boolean): string {
  return SURFACE_ALPHA && !pleinEcran ? "inset 0 1px 0 #000" : "none";
}
