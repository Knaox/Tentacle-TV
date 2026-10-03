import type { Direction, Intent, TransportCommand } from "../input/keys";

/**
 * Le vocabulaire ÉTENDU des intentions — ce que veut l'utilisateur, sans rien
 * de matériel.
 *
 * Il prolonge `input/keys.ts` sans le toucher. La LG importe `Intent`,
 * `Direction` et `TransportCommand` de là, et leurs VALEURS (« haut »,
 * « retour », « lecture »…) remplissent ses tables de touches : on les
 * réexporte telles quelles, et les intentions nouvelles s'AJOUTENT à côté.
 * Toute `Intent` d'origine est donc une `RemoteIntent` — le typage le
 * vérifie (`intents.test.ts`).
 *
 * Ce qui entre ici : un geste dit en termes d'INTENTION — aller vers,
 * valider, maintenir, revenir, lecture/pause, glisser. Ce qui n'y entre
 * jamais : un nom de bouton, un code de touche, la phase d'un reconnaisseur.
 * La table de traduction de chaque plateforme (`bindings/`) fait le lien, et
 * les comportements (les dossiers de domaine : `focus/`, `nav/`, `player/`…)
 * ne lisent que ce vocabulaire.
 *
 * Module pur : ni DOM, ni React Native.
 */

export type { Direction, Intent, TransportCommand } from "../input/keys";
export { directionSign, isHorizontal } from "../input/keys";

/** Les directions d'une page (Page précédente / Page suivante). */
export type PageDirection = Extract<Direction, "haut" | "bas">;

/** Ce qu'on peut maintenir : OK, Lecture/Pause, une direction. Des touches
 *  LOGIQUES — toutes les télécommandes de salon les ont. */
export type HoldKey = "select" | "playPause" | Direction;

export const HOLD_KEYS: readonly HoldKey[] = ["select", "playPause", "haut", "bas", "gauche", "droite"];

/**
 * Le cycle d'un maintien.
 *
 * - `start` : le seuil est atteint, la touche encore enfoncée — c'est là
 *   qu'une action longue part (cf. `input/longPress.ts`) ;
 * - `update` : la plateforme redit que l'appui dure, sans rien préciser
 *   (tvOS : l'état « Changed » du reconnaisseur) ;
 * - `end` : relâché — ou annulé par la plateforme, ce qui revient au même.
 */
export type HoldPhase = "start" | "update" | "end";

/** Le cycle d'un glisser sur une surface tactile : le doigt se pose (le
 *  simple TOUCHER), se déplace, se lève. */
export type DragPhase = "start" | "move" | "end";

/** Aller vers une direction, d'un pas. */
export interface MoveIntent {
  type: "move";
  direction: Direction;
  /** La plateforme RÉPÈTE l'appui d'une touche tenue (Android TV, LG). Jamais
   *  posé sur tvOS, qui ANNONCE le maintien (`hold`). */
  repeat?: boolean;
}

/** Valider : OK, au centre. */
export interface SelectIntent {
  type: "select";
  /** Comme pour `move` : la répétition d'une touche tenue, là où elle existe. */
  repeat?: boolean;
}

/** Revenir — Retour, Menu. La valeur est celle d'origine (`input/keys.ts`). */
export interface BackIntent {
  type: "retour";
}

/** Une touche de transport dédiée (LG, Android TV) : lecture, pause, arrêt,
 *  avance, retour rapide. La Siri Remote n'en a pas. */
export interface TransportIntent {
  type: "transport";
  command: TransportCommand;
}

/** La touche Lecture/Pause : une BASCULE, dont le sens dépend du contexte —
 *  lire ou suspendre dans le lecteur, demander dans la feuille des saisons. */
export interface PlayPauseIntent {
  type: "playPause";
}

/** Maintenir une touche. */
export interface HoldIntent {
  type: "hold";
  key: HoldKey;
  phase: HoldPhase;
}

/** Un glisser RAPIDE vers une direction, annoncé à sa fin. Le focus natif l'a
 *  souvent déjà suivi : c'est un geste « vers », comme `move`, mais ample. */
export interface SwipeIntent {
  type: "swipe";
  direction: Direction;
}

/**
 * Le doigt sur la surface tactile, en continu — de quoi glisser pour avancer
 * dans la vidéo. `x` et `y` : la translation depuis la pose, `vx` et `vy` :
 * la vitesse, dans l'unité de la surface que la table déclare
 * (`RemoteTraits.dragUnit`).
 */
export interface DragIntent {
  type: "drag";
  phase: DragPhase;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

/** Une page vers le haut ou vers le bas (clavier, télécommandes à touches de page). */
export interface PageIntent {
  type: "page";
  direction: PageDirection;
}

export type RemoteIntent =
  | MoveIntent
  | SelectIntent
  | BackIntent
  | TransportIntent
  | PlayPauseIntent
  | HoldIntent
  | SwipeIntent
  | DragIntent
  | PageIntent;

export type RemoteIntentType = RemoteIntent["type"];

/** Une intention d'un type donné — `IntentOf<"hold">` est `HoldIntent`. */
export type IntentOf<T extends RemoteIntentType> = Extract<RemoteIntent, { type: T }>;

/** Tous les types, dans l'ordre du vocabulaire (exhaustivité vérifiée par le typage). */
export const REMOTE_INTENT_TYPES = [
  "move", "select", "retour", "transport", "playPause", "hold", "swipe", "drag", "page",
] as const satisfies readonly RemoteIntentType[];

/** Vrai pour les quatre intentions d'origine — ce que la LG sait déjà lire. */
export function isBaseIntent(intent: RemoteIntent): intent is Intent {
  return intent.type === "move" || intent.type === "select" || intent.type === "retour" || intent.type === "transport";
}

/** La direction d'un GESTE vers un côté — un pas (`move`) ou un glisser
 *  rapide (`swipe`) ; `null` pour tout le reste, maintiens compris. */
export function directionOf(intent: RemoteIntent): Direction | null {
  return intent.type === "move" || intent.type === "swipe" ? intent.direction : null;
}

/** La direction d'une touche maintenue, ou `null` (OK, Lecture/Pause). */
export function holdDirection(key: HoldKey): Direction | null {
  return key === "select" || key === "playPause" ? null : key;
}
