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
 * macOS ET Linux : les deux fabriquent leur fenêtre `transparent: true` à la
 * construction (linux/window.ts — mesuré, posé après coup la page peint du
 * noir sur la vidéo). Windows reste sans alpha, ses ombres se fondent dans le
 * fond. Oublier Linux ici, c'était redessiner les aplats opaques du défaut
 * macOS par-dessus mpv sur toute nouvelle surface.
 *
 * Figé au chargement : ni la coquille ni la plateforme ne changent en cours de
 * session, et cette fonction est appelée à chaque rendu de la vignette de
 * survol — laquelle suit le curseur.
 */
const SURFACE_ALPHA =
  isElectronShell() && (desktopPlatform() === "macos" || desktopPlatform() === "linux");

export function surfaceHasAlpha(): boolean {
  return SURFACE_ALPHA;
}

/**
 * L'ombre à poser, selon la surface.
 *
 * @param full Ce qu'on veut là où l'ombre se compose correctement.
 * @param hairline Le seul contour, sans flou — voir l'en-tête pour le pourquoi.
 */
export function videoShadow(full: string, hairline: string): string {
  return SURFACE_ALPHA ? hairline : full;
}

/**
 * Le contour du texte posé NU sur la vidéo — la seule aide qui ne se paie pas.
 *
 * Sur la surface à alpha, les barres du lecteur n'ont ni dégradé ni voile
 * (chaque tentative a été mesurée et payée — voir DesktopPlayerControls) : le
 * texte blanc restait sans aide, illisible sur une image claire. L'ombre de
 * texte FLOUE avait été essayée et rejetée : son halo sortait en contour
 * visible, avec un artefact à chaque apparition.
 *
 * ⚠️ La première version de ce contour (copies noires SEMI-transparentes,
 * 0,35 → 0,8) a livré la leçon complète, capture du 30.08 sur Linux à
 * l'appui : sur cette surface, l'alpha PARTIEL ne rend pas la couleur
 * demandée. Le blanc partiel se DÉLAVE vers le gris — la surface le lit comme
 * prémultiplié — et les copies noires partielles s'empilent en pâte quasi
 * opaque. Seul un pixel PLEINEMENT opaque est déterministe.
 *
 * D'où ce dessin, et pas un autre : remplissage blanc PUR (alpha 1 — jamais
 * `text-white/xx` ici) et contour noir PLEIN, quatre copies nettes d'un
 * pixel. C'est très exactement le dessin des sous-titres de mpv, impeccables
 * sur la même image.
 *
 * `undefined` hors surface alpha : Windows et le web gardent leurs dégradés,
 * au pixel près — leur texte n'a jamais manqué d'appui.
 */
export function videoTextGuard(): string | undefined {
  if (!SURFACE_ALPHA) return undefined;
  return "0 1px 0 #000, 0 -1px 0 #000, 1px 0 0 #000, -1px 0 0 #000";
}

/**
 * ⚠️ `videoBorder()` a existé ici, et n'a plus lieu d'être — ne pas la remettre.
 *
 * Elle couvrait, par un trait net d'un pixel en haut du lecteur, la bordure
 * claire qu'AppKit peint sur le bord supérieur de la fenêtre de mpv : le retrait
 * de l'ombre de la fenêtre principale l'avait révélée (mesuré côté processus
 * principal, 14,6 avec l'ombre, 50 sans).
 *
 * Le bandeau d'hôte s'en charge désormais, et mieux : la fenêtre de mpv passe
 * SOUS lui de quelques points (`macosTitleBar.RECOUVREMENT`), ce qui cache d'un
 * coup la bordure ET les coins arrondis. Garder le trait deviendrait un défaut à
 * son tour — la root du lecteur commence plus bas que la fenêtre vidéo, il se
 * poserait donc en travers de l'IMAGE au lieu de son bord.
 */
