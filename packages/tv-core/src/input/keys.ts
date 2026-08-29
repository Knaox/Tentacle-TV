/**
 * Le vocabulaire d'entrée du salon.
 *
 * Ce que fait une télécommande — se déplacer, valider, revenir, piloter la
 * lecture — est le même sur les trois cibles. COMMENT chaque plateforme le dit
 * ne l'est pas du tout : la LG émet des `keyCode` numériques dont plusieurs lui
 * sont propres, Android TV émet des événements déjà nommés, et la Siri Remote
 * ajoute un trackpad qui n'a d'équivalent nulle part.
 *
 * Ce module porte donc le VOCABULAIRE, pas la traduction. Les tables de codes
 * restent chez chaque plateforme :
 *   - LG  : `apps/tv-webos/client/src/focus/touches.ts`
 *   - RN  : l'adaptateur `TVEventHandler` des cibles natives
 *
 * Module pur : ni DOM, ni React Native.
 */

export type Direction = "haut" | "bas" | "gauche" | "droite";

export type TransportCommand = "lecture" | "pause" | "arret" | "avance" | "retour";

export type Intent =
  | { type: "move"; direction: Direction }
  | { type: "select" }
  | { type: "retour" }
  | { type: "transport"; command: TransportCommand };

/**
 * OK/Entrée — la seule touche que ce module sache reconnaître lui-même.
 *
 * Elle y est parce que DEUX machines d'ici en dépendent (l'appui long et le
 * verrou de touche) et qu'elles doivent reconnaître exactement la même touche,
 * sans quoi un maintien s'arme sans jamais se désarmer.
 *
 * La forme est volontairement permissive — `{ keyCode?, key? }` plutôt qu'un
 * vrai `KeyboardEvent` — pour deux raisons. `keyCode` est déprécié et certaines
 * sources ne le renseignent pas : le banc d'essai émettait `keyCode: 0`, et
 * l'appui long y prenait chaque répétition d'Entrée pour un déplacement,
 * annulant le maintien qu'elle était censée prouver. Et côté React Native, il
 * n'y a pas de `KeyboardEvent` du tout : l'adaptateur y fabrique
 * `{ key: "Enter" }` pour un événement « select », et tout fonctionne.
 */
const SELECT_KEY_CODES = new Set([13]);
const SELECT_KEY_NAMES = new Set(["Enter"]);

export function isSelectKey(event: { keyCode?: number; key?: string }): boolean {
  if (event.keyCode !== undefined && SELECT_KEY_CODES.has(event.keyCode)) {
    return true;
  }
  return !!event.key && SELECT_KEY_NAMES.has(event.key);
}

/** Axe de déplacement d'une direction. */
export function isHorizontal(direction: Direction): boolean {
  return direction === "gauche" || direction === "droite";
}

/** Sens : +1 vers la droite ou le bas, -1 vers la gauche ou le haut. */
export function directionSign(direction: Direction): 1 | -1 {
  return direction === "droite" || direction === "bas" ? 1 : -1;
}
