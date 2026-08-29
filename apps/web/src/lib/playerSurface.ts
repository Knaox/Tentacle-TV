/**
 * La surface de la page pendant la lecture : quand elle cesse de peindre son
 * fond, et ce que cela fait — ou ne fait PAS.
 *
 * # À quoi elle sert
 *
 * La fenêtre de mpv est placée SOUS la nôtre, et une page qui peint son fond la
 * masquerait. Hors lecture la page est opaque, et la fenêtre avec elle : une
 * fenêtre transparente en permanence sortait Windows du chemin de présentation
 * opaque et faisait scintiller chaque transition (cf. `mpv_window.rs`).
 *
 * # À quoi elle ne sert PAS, contrairement à ce qui était écrit ici
 *
 * ⚠️ Ce module portait l'affirmation suivante : « une couche en plage étendue
 * que rien ne laisse voir ne reçoit AUCUN headroom du compositeur — fond de page
 * opaque : EDR accordé 1,00 ; fond transparent : 16,00 ». **C'est faux**, et
 * l'avoir cru a fait chercher longtemps du mauvais côté.
 *
 * Mesuré, lecture HDR en cours, headroom relevé à chaque bascule :
 *
 *   page rendue opaque       headroom 5,51   (inchangé)
 *   page rendue transparente headroom 5,51   (inchangé)
 *
 * Et l'inverse aussi : la page entière mise en `display: none` ne fait pas
 * monter d'un centième un headroom bloqué à 1,00. Ce que la page peint n'entre
 * pas dans cet arbitrage.
 *
 * Ce qui le décide vraiment est l'espace colorimétrique de la couche Metal **à
 * sa naissance**, et cela se règle du côté de mpv — voir `force-window` dans
 * `mpvRuntime.ts`.
 */

import { invoke, isElectronShell } from "../desktop/bridge";

function apply(on: boolean): Promise<void> {
  return invoke("player_surface_transparent", { on })
    .then(() => undefined)
    .catch((e) => {
      console.warn("[mpv] surface transparente refusée", e);
    });
}

/**
 * La page cesse de peindre son fond, la vidéo apparaît.
 *
 * Appelée APRÈS `mpv_init` : tant qu'aucune image n'est prête, c'est l'écran de
 * chargement — opaque et plein cadre — qui tient la surface, et l'ordre inverse
 * laisserait voir le bureau le temps que mpv ouvre sa fenêtre.
 */
export async function setSurfaceTransparent(): Promise<void> {
  if (!isElectronShell()) return;
  await apply(true);
}

/** Fin de lecture : la page reprend son fond. */
export function setSurfaceOpaque(): void {
  if (!isElectronShell()) return;
  void apply(false);
}
