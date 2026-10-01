import { useEffect, useRef } from "react";
import { Platform, TVEventHandler, type HWEvent } from "react-native";

/**
 * La télécommande d'Apple TV, pour le branchement de la refonte : UN
 * abonnement aux événements natifs (`TVEventHandler`), partagé par tous les
 * écouteurs, et traduit en événements TYPÉS.
 *
 * Trois sortes :
 * - `press` : un bouton — flèche (bord cliquable du pavé ; flèches du clavier
 *   au simulateur), OK, Lecture/Pause, Menu, et leurs appuis longs. tvOS
 *   n'émet qu'UN événement par appui simple, au relâchement ; un appui long
 *   dit son début (`down`) et sa fin (`up`) ;
 * - `swipe` : un glisser rapide sur le pavé, émis à la fin du geste. Toujours
 *   actif : ses reconnaisseurs vivent sur la vue racine, à côté du moteur de
 *   focus ;
 * - `pan` : le doigt qui se déplace, en continu — seulement pendant que
 *   quelqu'un tient le pan (`lib/tvPanGesture.ts`). Un pan que tvOS annule
 *   n'émet pas de fin : un écouteur ne l'attend pas.
 *
 * Le moteur de focus suit déjà les glissers, avec élan : un écouteur n'ajoute
 * un geste que là où le focus ne va nulle part (un bord), ou là où il n'y a
 * rien à focaliser. Les vues de `redesign/` n'en savent rien — le lint y
 * refuse `TVEventHandler` : c'est le branchement qui écoute et décide.
 *
 * Apple TV seulement : ailleurs, s'abonner ne fait rien. Les événements
 * `focus` et `blur` ne passent pas ici : le magasin du focus les voit déjà,
 * clé par clé.
 */

export type RemoteDirection = "up" | "down" | "left" | "right";
export type RemoteButton = RemoteDirection | "select" | "playPause" | "menu" | "pageUp" | "pageDown";

export type RemoteEvent =
  | {
      kind: "press";
      button: RemoteButton;
      /** Un appui maintenu (`longSelect`, `longRight`…). */
      long: boolean;
      /** Début ou fin de l'appui ; `null` quand tvOS ne le dit pas. */
      phase: "down" | "up" | null;
      /** L'arrivée dans le JS (`Date.now()`). */
      at: number;
    }
  | { kind: "swipe"; direction: RemoteDirection; at: number }
  | {
      kind: "pan";
      phase: "began" | "changed" | "ended";
      /** La translation depuis le début du geste, en points du pavé. */
      x: number;
      y: number;
      velocityX: number;
      velocityY: number;
      at: number;
    };

export type RemoteListener = (event: RemoteEvent) => void;

const SWIPES = new Map<string, RemoteDirection>([
  ["swipeUp", "up"],
  ["swipeDown", "down"],
  ["swipeLeft", "left"],
  ["swipeRight", "right"],
]);
const BUTTONS = new Map<string, RemoteButton>(
  (["up", "down", "left", "right", "select", "playPause", "menu", "pageUp", "pageDown"] as const).map((b) => [b, b]),
);
const LONG_BUTTONS = new Map<string, RemoteButton>([
  ["longUp", "up"],
  ["longDown", "down"],
  ["longLeft", "left"],
  ["longRight", "right"],
  ["longSelect", "select"],
  ["longPlayPause", "playPause"],
]);
const PAN_PHASES = new Map<string, "began" | "changed" | "ended">([
  ["Began", "began"],
  ["Changed", "changed"],
  ["Ended", "ended"],
]);

/** L'événement natif, traduit ; `null` pour ce qui ne concerne pas un geste. */
export function toRemoteEvent(raw: HWEvent, at: number): RemoteEvent | null {
  const type = raw.eventType;
  const direction = SWIPES.get(type);
  if (direction) return { kind: "swipe", direction, at };
  if (type === "pan") {
    const body = raw.body;
    const phase = body ? PAN_PHASES.get(body.state) : undefined;
    if (!body || !phase) return null;
    return { kind: "pan", phase, x: body.x, y: body.y, velocityX: body.velocityX, velocityY: body.velocityY, at };
  }
  const long = LONG_BUTTONS.get(type);
  const button = long ?? BUTTONS.get(type);
  if (!button) return null;
  const phase = raw.eventKeyAction === 0 ? "down" : raw.eventKeyAction === 1 ? "up" : null;
  return { kind: "press", button, long: long !== undefined, phase, at };
}

const SUPPORTED = Platform.OS === "ios";
const listeners = new Set<RemoteListener>();
let native: { remove(): void } | null = null;

function dispatch(raw: HWEvent): void {
  const event = toRemoteEvent(raw, Date.now());
  if (!event) return;
  for (const listener of [...listeners]) listener(event);
}

/**
 * Écoute la télécommande ; rend le désabonnement. L'abonnement natif naît
 * avec le premier écouteur et part avec le dernier.
 */
export function subscribeRemote(listener: RemoteListener): () => void {
  if (!SUPPORTED) return () => {};
  listeners.add(listener);
  native ??= TVEventHandler.addListener(dispatch) ?? null;
  return () => {
    if (!listeners.delete(listener) || listeners.size > 0) return;
    native?.remove();
    native = null;
  };
}

/**
 * Écoute la télécommande tant que `enabled` est vrai (et l'appelant monté).
 * L'écouteur peut changer à chaque rendu : l'abonnement, lui, ne bouge pas.
 * Les écrans d'une pile restent montés : passer `enabled` à faux quand
 * l'écran n'est pas devant (`useIsFocused`).
 */
export function useRemoteEvents(listener: RemoteListener, enabled = true): void {
  const latest = useRef(listener);
  latest.current = listener;
  useEffect(() => (enabled ? subscribeRemote((event) => latest.current(event)) : undefined), [enabled]);
}
