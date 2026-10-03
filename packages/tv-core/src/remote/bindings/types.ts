import type { BackIntent, Direction, HoldKey, MoveIntent, PageIntent, PlayPauseIntent, SelectIntent, TransportIntent } from "../intents";
import type { SignalPhase } from "../signals";

/**
 * Le FORMAT d'une table de traduction de télécommande : des données, une table
 * par plateforme (`bindings/tvos.ts` aujourd'hui ; Android TV demain).
 *
 * Une table dit, pour chaque signal natif, l'intention qu'il porte — rien de
 * plus. Aucune règle de comportement n'y entre : que `select` ouvre une fiche
 * ou lance la lecture, que Retour ferme un panneau ou quitte, cela se décide
 * dans les dossiers de domaine de tv-core, pour toutes les plateformes.
 * Porter une nouvelle télécommande, c'est écrire une table et un petit
 * adaptateur qui lit ses signaux (`RemoteSignal`) — jamais recoder un
 * comportement.
 *
 * Cinq sortes d'entrées, selon ce que produit le signal :
 * - un APPUI : une intention fixe (`move`, `select`, `retour`…) ;
 * - un MAINTIEN : la touche maintenue, dont la phase du signal donne le
 *   cycle (enfoncé → `start`, prolongé → `update`, relâché → `end`) ;
 * - un GLISSER RAPIDE : une direction ;
 * - un GLISSER CONTINU : le doigt sur la surface (phase et mesures du signal) ;
 * - le BRUIT DÉCLARÉ : reçu, mais pas une intention (le focus qui bouge).
 *
 * Une table liste aussi ce que la télécommande a mais que l'app ne reçoit
 * JAMAIS (le système le garde), et les faits de la plateforme que les
 * comportements doivent connaître (`traits`) — au lieu d'un `Platform.OS`.
 *
 * Module pur : ni DOM, ni React Native.
 */

/** Les intentions qu'un appui peut porter, telles quelles. */
export type PressIntent = MoveIntent | SelectIntent | BackIntent | TransportIntent | PlayPauseIntent | PageIntent;

export interface PressBinding {
  signal: string;
  intent: PressIntent;
  /** Les phases qui la produisent ; absent : toutes. Une plateforme qui
   *  annonce l'enfoncement ET le relâchement en choisit une ici, sans quoi
   *  l'appui compterait deux fois. */
  on?: readonly SignalPhase[];
  /** Ce qui émet ce signal, et où l'adaptateur le lit (documentation). */
  source?: string;
}

export interface HoldBinding {
  signal: string;
  key: HoldKey;
  source?: string;
}

export interface SwipeBinding {
  signal: string;
  direction: Direction;
  source?: string;
}

export interface DragBinding {
  signal: string;
  source?: string;
}

/** Reçu de la plateforme, mais ce n'est pas une intention. */
export interface NoiseBinding {
  signal: string;
  /** Pourquoi, et qui s'en sert à la place. */
  reason: string;
}

/** Une commande de la télécommande dont l'app ne reçoit rien. */
export interface SystemControl {
  /** Le bouton ou le geste. */
  control: string;
  /** Ce que la plateforme en fait. */
  effect: string;
}

/**
 * Les faits de la plateforme que les comportements lisent, au lieu de
 * demander « sommes-nous sur Apple TV ? ».
 */
export interface RemoteTraits {
  /** Le moteur de focus natif a DÉJÀ déplacé le focus quand l'intention
   *  `move` (ou `swipe`) arrive : la décision d'un déplacement se pose
   *  d'avance (guides, voisins), jamais au geste. */
  focusMovesBeforeIntent: boolean;
  /** Un appui simple n'est annoncé qu'au RELÂCHEMENT. */
  pressOnRelease: boolean;
  /** Le maintien est ANNONCÉ (`hold` : `start` puis `end`), sans répétitions
   *  entre les deux. Faux : la plateforme répète l'appui (`repeat`). */
  announcedHolds: boolean;
  /** Le seuil natif d'un maintien, en millisecondes ; `null` : aucun. */
  holdThresholdMs: number | null;
  /** Retour est pris ou laissé à la plateforme dès l'ENFONCEMENT : savoir
   *  qui le prendra se décide d'avance (`RemoteContexts.resolve`). */
  backDecidedAhead: boolean;
  /** La télécommande a une surface tactile (`swipe`, `drag`). */
  touchSurface: boolean;
  /** Le glisser continu (`drag`) n'arrive que tant qu'un écran le demande. */
  dragOnDemand: boolean;
  /** L'unité des mesures d'un `drag`. */
  dragUnit: string | null;
}

export interface RemoteBindings {
  /** La plateforme : `tvos`, `androidtv`… */
  platform: string;
  /** La télécommande (et les autres sources) que la table décrit. */
  remote: string;
  presses: readonly PressBinding[];
  holds: readonly HoldBinding[];
  swipes: readonly SwipeBinding[];
  drags: readonly DragBinding[];
  noise: readonly NoiseBinding[];
  system: readonly SystemControl[];
  traits: RemoteTraits;
}

/** Tous les signaux que la table connaît, intentions et bruit déclaré. */
export function boundSignals(bindings: RemoteBindings): string[] {
  return [
    ...bindings.presses.map((b) => b.signal),
    ...bindings.holds.map((b) => b.signal),
    ...bindings.swipes.map((b) => b.signal),
    ...bindings.drags.map((b) => b.signal),
    ...bindings.noise.map((b) => b.signal),
  ];
}
