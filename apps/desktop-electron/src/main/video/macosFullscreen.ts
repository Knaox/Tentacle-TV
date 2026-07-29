/**
 * Le plein écran de mpv — qu'on lui demande pour UNE raison, et pas celle-là.
 *
 * # Ce qu'on cherche à obtenir
 *
 * Pas l'animation, pas la barre de menus : le DÉSARMEMENT de la contrainte que
 * mpv impose au cadre de sa fenêtre. Sa redéfinition de
 * `constrainFrameRect:toScreen:` commence par ceci :
 *
 * ```swift
 * if (isAnimating && !isInFullscreen) || (!isAnimating && isInFullscreen || …) {
 *     return frameRect   // le cadre demandé, tel quel
 * }
 * ```
 *
 * Tant que mpv se croit fenêtré, il rabat tout cadre sur le `visibleFrame` de
 * l'écran — qui, sur un Mac à encoche, s'arrête 32 points sous le haut de la
 * dalle, la barre de menus fût-elle masquée (mesuré : 949 puis 950, jamais
 * 982). Le plein écran laissait donc une bande de BUREAU en haut, et aucune
 * géométrie ne pouvait la combler : la contrainte épingle le sommet de la
 * fenêtre, elle ne la redimensionne pas.
 *
 * ⚠️ Le poser à la main ne suffit pas. Le cadre exact ÉTAIT posé — mesuré de
 * l'extérieur à 20 Hz, 0,0 1512x982 — et macOS le repoussait 110 ms plus tard
 * sans qu'aucun évènement ne parvienne à Electron. Une veille qui le reposait
 * faisait alors osciller la fenêtre entre les deux positions, dix fois par
 * seconde. La seule sortie est que mpv cesse de contraindre.
 *
 * # Pourquoi `native-fs=no`, sans exception
 *
 * Le plein écran natif d'AppKit déplace la fenêtre dans un ESPACE dédié, et
 * l'ordre d'empilement n'y survit pas : la vidéo repasse DEVANT et masque tout
 * l'overlay du lecteur (voir `fullscreen.ts`, qui l'évite pour cette raison).
 * `native-fs=no` fait passer mpv par `setToFullScreen()`, qui se contente de
 * poser sa fenêtre sur le cadre de l'écran — exactement ce que nous voulions.
 *
 * L'option est relue À CHAQUE bascule (`window.swift:143`), donc réaffirmée à
 * chaque fois plutôt que posée à l'initialisation : c'est une ligne, et elle ne
 * peut pas se désynchroniser.
 */

import { setProperty } from "./mpv";

/**
 * Passes de rattrapage après une bascule, en millisecondes.
 *
 * mpv repose SA géométrie juste après avoir basculé — `setToFullScreen()` et
 * `setToWindow()` finissent tous deux par un `setFrame:`, sur son propre
 * calendrier et sans nous prévenir. Mesuré au guet, la fenêtre repassait 50 ms
 * par un cadre de plein écran en revenant au fenêtré. La veille ordinaire
 * finissait par le corriger ; ces quelques passes l'effacent avant qu'on le
 * voie.
 */
const RATTRAPAGES_MS = [16, 50, 120, 300];

/**
 * Tient l'état de plein écran de mpv aligné sur celui de notre fenêtre.
 *
 * ⚠️ La propriété `fullscreen` est une BASCULE côté mpv : l'observateur
 * d'options appelle `toggleFullScreen(nil)` sur tout changement de valeur. La
 * mémoire locale n'est donc pas un confort — écrire deux fois « oui » ne fait
 * rien, mais écrire « oui » alors que mpv y est déjà le ferait SORTIR.
 */
export class PleinEcranMpv {
  private actif = false;

  /** @param recaler Ce qu'il faut rejouer une fois mpv retombé sur ses pieds. */
  constructor(private readonly recaler: () => void) {}

  synchroniser(veut: boolean): void {
    if (veut === this.actif) return;
    this.actif = veut;
    void setProperty("native-fs", "no").catch(() => null);
    void setProperty("fullscreen", veut ? "yes" : "no").catch(() => null);
    for (const delai of RATTRAPAGES_MS) setTimeout(this.recaler, delai);
  }

  /** À la fin d'une lecture : l'instance suivante repart de zéro. */
  oublier(): void {
    this.actif = false;
  }
}
