/**
 * Les options mpv du montage Render API, dérivées de celles de la page.
 *
 * # Pourquoi le natif les réécrit
 *
 * La page décrit ce qu'elle veut voir — du décodage matériel, un cache — sans
 * savoir COMMENT la coquille l'obtient. Le choix du montage (`surface.ts`) vit
 * dans le processus principal, et lui seul sait qu'il faut alors une sortie
 * `libmpv` plutôt qu'une fenêtre Metal. Faire remonter ce détail jusqu'au
 * navigateur pour qu'il le renvoie aussitôt n'apprendrait rien à personne, et
 * donnerait deux endroits à tenir d'accord.
 *
 * # Ce que la Render API change
 *
 * Toutes les options qui parlent d'une FENÊTRE n'ont plus d'objet : il n'y en a
 * plus. Et le passthrough PQ non plus — `target-colorspace-hint` s'adresse au
 * backend Metal, qui négocie l'espace de sa couche avec le compositeur. Une
 * `NSOpenGLView` n'est pas gérée en couleur : on lui envoie des valeurs, elle
 * les affiche.
 *
 * # Une sortie en plage standard, comme pour n'importe quel écran SDR
 *
 * La vue est en RGBA 8 bits, sans plage étendue (`macosGlView.ts`). mpv doit
 * donc produire ce qu'il produit pour tout écran SDR : ses défauts —
 * `target-trc`, `target-prim` et `target-peak` à `auto` —, et un contenu HDR
 * est tone-mappé vers le SDR par mpv lui-même.
 *
 * ⚠️ Ce module imposait `target-trc=pq`, `target-prim=display-p3` et un
 * `target-peak` lu sur l'écran : l'expérience EDR, abandonnée. Du PQ écrit
 * dans une surface sRGB, c'est une image délavée sur tout écran sans plage
 * étendue — donc sur tous les Mac Intel. C'est le défaut que ce fichier ne
 * reproduit plus.
 *
 * ⚠️ Aucun import natif ici, et c'est voulu. `ipc/video.ts` charge ce module à
 * la demande pour épargner Windows ; son test n'a besoin d'aucun mock, et le
 * jour où il en réclamera un, c'est qu'une dépendance à `objc.ts` est revenue.
 */

import type { MpvValue } from "./mpvAllowlist";

/** Options qui n'ont de sens qu'avec une fenêtre à mpv. */
const NOT_APPLICABLE: ReadonlySet<string> = new Set([
  "gpu-api",
  "gpu-context",
  "border",
  "auto-window-resize",
  "force-window",
  // Le passthrough s'adresse au backend Metal ; sans lui, mpv attendrait une
  // négociation qui n'aura jamais lieu et retomberait en sRGB.
  "target-colorspace-hint",
  // La fenêtre n'existant pas, ces réglages d'entrée ne s'appliquent à rien.
  "input-cursor",
  "cursor-autohide",
]);

/**
 * Réécrit les options d'init pour le rendu par la Render API.
 *
 * `vo=libmpv` est imposé : c'est la sortie qui délègue le dessin à l'hôte. Le
 * reste passe tel quel — décodage, cache et réseau ne dépendent pas du montage.
 * Rend une copie : l'objet reçu appartient à l'appelant.
 */
export function adaptForRenderApi(
  options: Readonly<Record<string, MpvValue>>,
): Record<string, MpvValue> {
  const output: Record<string, MpvValue> = {};
  for (const [name, value] of Object.entries(options)) {
    if (!NOT_APPLICABLE.has(name)) output[name] = value;
  }
  output["vo"] = "libmpv";
  return output;
}
