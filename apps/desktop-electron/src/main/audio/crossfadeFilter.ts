/**
 * La transition douce dans mpv : le GAIN de chaque instance (« deck », `crossfadeDecks.ts`) est un filtre
 * `volume` de libavfilter posé dans sa chaîne, dont l'expression suit le TEMPS DU FLUX (`t`, la position des
 * échantillons filtrés). Pur (`crossfadeFilter.test.ts`).
 *
 * - `asetnsamples=256` devant : le gain est réévalué toutes les 256 trames (5,3 ms à 48 kHz) au lieu d'une
 *   trame de décodeur (4 096 en FLAC, 93 ms) — d'un pas à l'autre, 0,2 % d'amplitude au plus sur 6 s.
 * - Le fondu suit le flux, pas une horloge : une pause, un tampon qui se vide, la latence de la sortie ne
 *   déforment jamais la courbe ; seule la mise en route du titre qui arrive se cale à l'horloge (`crossfadeDecks`).
 * - Le titre qui ARRIVE porte sa courbe dès sa naissance : l'expression est écrite dans la chaîne, posée sur
 *   l'instance AU REPOS (aucun son à déranger) — une chaîne n'existe qu'une fois le son décodé, et
 *   `af-command` ne la trouve pas avant (mesuré). Celui qui PART reçoit la sienne par `af-command` (sans
 *   reconstruire la chaîne : aucun trou).
 * - ⚠️ `af-command` vise l'étiquette SANS `@` et la cible `volume` (mesuré : `@xf` ou sans cible → refus).
 * - Jamais en mode exclusif : la sortie « bit pour bit » n'a ni filtre ni second flux.
 */

import type { AudioBridgeSource } from "./audioBridgeContract";
import { LEVEL_FILTER } from "./audioLevel";

/**
 * Une source servie par la transition douce : `fadeInS`, la courbe d'entrée du titre qui ARRIVE, posée en option
 * du FICHIER (`af`) — jamais sur l'instance : un saut reconstruit la chaîne depuis son texte (mesuré), la courbe
 * y reviendrait au titre suivant. Jamais reçue de la page (le schéma du pont l'ignore).
 */
export interface FadedSource extends AudioBridgeSource {
  fadeInS?: number;
}

export const XF_LABEL = "xf";

/** Ce que la transition douce lit d'une instance : position et durée dans le titre (s), source complète, son en cours. */
export interface DeckTimeline {
  positionS: number;
  /** Où la chronologie de l'entrée mpv (le `t` des filtres) commence dans le titre : une entrée EDL de bascule. */
  offsetS: number;
  durationS: number | null;
  complete: boolean;
  playing: boolean;
  /** Un fichier chargé (son départ fait, pause comprise), sans erreur. */
  loaded: boolean;
  /** Arrêtée sur la vraie fin de son dernier titre. */
  ended: boolean;
}

/** Un nombre pour une expression de libavfilter : décimal, sans exposant. */
const num = (x: number): string => Math.max(0, x).toFixed(6);

/** Une expression posée telle quelle dans une chaîne lavfi : « \\ » puis « , » échappés. */
export function lavfiEscape(expr: string): string {
  return expr.replace(/\\/g, "\\\\").replace(/,/g, "\\,");
}

/**
 * La chaîne `af` d'une instance : le gain du fondu (`expr`, gain plein par défaut), PUIS la mesure du niveau — la
 * houle suit ce qu'on entend de l'instance, et le banc y lit l'enveloppe de chacune pendant un fondu.
 */
export function deckChain(expr = "1"): string {
  // Dans une chaîne lavfi, la virgule sépare les filtres : celles de l'expression sont échappées — et la barre
  // oblique inverse d'abord, sinon elle échapperait ce qui la suit.
  return `@${XF_LABEL}:lavfi=[asetnsamples=n=256:p=0,volume=volume=${lavfiEscape(expr)}:eval=frame],${LEVEL_FILTER}`;
}

/** Le titre qui arrive : de 0 à plein, en `durationS`, sur sa propre chronologie (`t` = 0 à son début). */
export function fadeInExpr(durationS: number): string {
  return `if(lt(t,${num(durationS)}),sin(PI/2*max(t,0)/${num(durationS)}),1)`;
}

/** Le titre qui part : plein jusqu'à `startS` (sa chronologie), puis vers 0 en `durationS`, puis muet. */
export function fadeOutExpr(startS: number, durationS: number): string {
  const [s, d] = [num(startS), num(durationS)];
  return `if(lt(t,${s}),1,if(lt(t,${s}+${d}),cos(PI/2*(t-${s})/${d}),0))`;
}

/** La commande qui pose une expression sur la chaîne d'une instance qui joue. */
export function gainCommand(expr: string): string[] {
  return ["af-command", XF_LABEL, "volume", expr, "volume"];
}

/**
 * La sortie d'un titre quitté par un GESTE, la transition douce allumée : des gains constants envoyés tous les
 * `CUT_STEP_MS` (chacun prend effet à la trame filtrée suivante — l'instant du flux où il tombe n'est pas
 * connu d'avance, une expression en `t` ne pourrait pas le viser), en demi-cosinusoïde sur `ms`.
 */
export const CUT_STEP_MS = 10;
export function cutSteps(ms: number): number[] {
  const n = Math.max(1, Math.round(ms / CUT_STEP_MS));
  return Array.from({ length: n }, (_, i) => 0.5 + 0.5 * Math.cos((Math.PI * (i + 1)) / n));
}
