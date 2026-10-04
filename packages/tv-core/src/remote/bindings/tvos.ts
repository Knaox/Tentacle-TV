import type { RemoteSignal, SignalPhase } from "../signals";
import { BASE_REMOTE_HINTS } from "./hints";
import type { RemoteBindings } from "./types";

/**
 * La Siri Remote, traduite — TOUT ce que la télécommande d'Apple TV émet
 * aujourd'hui dans l'app, relevé dans react-native-tvos 0.80
 * (`React/Base/RCTTVRemoteHandler.m`, `RCTTVRemoteSelectHandler.m`,
 * `React/Views/RCTTVView.m`) et dans les sources propres à l'app.
 *
 * D'où viennent les signaux :
 * - `TVEventHandler` : les appuis (flèches = bords cliquables du pavé, ou
 *   flèches du clavier au simulateur), OK, Lecture/Pause, Page, leurs
 *   maintiens, les glissers rapides, et le glisser continu (`pan`) tant qu'un
 *   écran le tient (`TVEventControl.enableTVPanGesture`) ;
 * - `MenuPressInterceptor` (vue native de l'app) : Menu, quand la portée du
 *   Retour le prend — l'adaptateur le rend sous le nom `menu`. `TVEventHandler`
 *   n'émet jamais `menu` ici : l'app n'active pas `enableTVMenuKey` ;
 * - `Modal.onRequestClose` : Menu dans une modale (son propre contrôleur) ;
 * - le `Pressable` de l'élément focalisé : OK (`onPress`) et OK maintenu
 *   (`onLongPress`, `LONG_PRESS_THRESHOLD_MS` = 550 ms après l'enfoncement).
 *   C'est l'élément qui l'applique ; le même appui passe AUSSI ici, en
 *   `select` / `longSelect`, pour qui l'observe.
 *
 * Phases, telles que tvOS les livre : un appui simple (reconnaisseur de tape)
 * n'arrive qu'au RELÂCHEMENT (`eventKeyAction` 1) ; un maintien
 * (`UILongPressGestureRecognizer`, 0,5 s) dit son début (0) et sa fin (1) —
 * annulé, il dit aussi 1 (correctif Tentacle de react-native-tvos) — et rien
 * (`eventKeyAction` absent) dans l'état « Changed ». OK ne passe en `select`
 * que s'il n'est pas devenu un maintien : le reconnaisseur long coupe le court.
 *
 * Données seulement : la lecture de l'événement natif (`readTvosEvent`) est
 * ici parce qu'elle est pure ; l'abonnement vit dans l'adaptateur
 * (`apps/tv/src/platform/tvos/`).
 */

/** `eventKeyAction` → phase. */
export const TVOS_KEY_ACTIONS: Readonly<Record<number, SignalPhase>> = { 0: "down", 1: "up" };

/** `body.state` d'un geste du pavé → phase. Un pan ANNULÉ n'émet rien du tout. */
export const TVOS_TOUCH_STATES: Readonly<Record<string, SignalPhase>> = { Began: "down", Changed: "change", Ended: "up" };

/** La forme de `HWEvent` (react-native-tvos), sans l'importer. */
export interface TvosNativeEvent {
  eventType: string;
  eventKeyAction?: number;
  body?: { state?: string; x?: number; y?: number; velocityX?: number; velocityY?: number };
}

/** L'événement natif, lu en signal ; `at` : son arrivée dans le JS. */
export function readTvosEvent(event: TvosNativeEvent, at: number): RemoteSignal {
  const body = event.body;
  if (body?.state !== undefined) {
    const phase = TVOS_TOUCH_STATES[body.state] ?? null;
    const { x, y, velocityX, velocityY } = body;
    const measured = x !== undefined && y !== undefined && velocityX !== undefined && velocityY !== undefined;
    return measured
      ? { name: event.eventType, phase, motion: { x, y, vx: velocityX, vy: velocityY }, at }
      : { name: event.eventType, phase, at };
  }
  const phase = event.eventKeyAction === undefined ? null : TVOS_KEY_ACTIONS[event.eventKeyAction] ?? null;
  return { name: event.eventType, phase, at };
}

const HANDLER = "TVEventHandler";

export const TVOS_BINDINGS: RemoteBindings = {
  platform: "tvos",
  remote: "Siri Remote (2e et 3e génération) ; clavier du Mac au simulateur",
  presses: [
    { signal: "up", intent: { type: "move", direction: "haut" }, source: `${HANDLER} — bord haut du pavé, flèche` },
    { signal: "down", intent: { type: "move", direction: "bas" }, source: `${HANDLER} — bord bas du pavé, flèche` },
    { signal: "left", intent: { type: "move", direction: "gauche" }, source: `${HANDLER} — bord gauche du pavé, flèche` },
    { signal: "right", intent: { type: "move", direction: "droite" }, source: `${HANDLER} — bord droit du pavé, flèche` },
    { signal: "select", intent: { type: "select" }, source: `${HANDLER} (élément focalisé) ; l'élément le reçoit aussi (Pressable.onPress)` },
    { signal: "playPause", intent: { type: "playPause" }, source: HANDLER },
    { signal: "menu", intent: { type: "retour" }, source: "MenuPressInterceptor.onMenuPress, Modal.onRequestClose" },
    { signal: "pageUp", intent: { type: "page", direction: "haut" }, source: `${HANDLER} (tvOS 14.3+, clavier)` },
    { signal: "pageDown", intent: { type: "page", direction: "bas" }, source: `${HANDLER} (tvOS 14.3+, clavier)` },
  ],
  holds: [
    { signal: "longSelect", key: "select", source: `${HANDLER} (élément focalisé, 0,5 s) ; Pressable.onLongPress à 550 ms` },
    { signal: "longPlayPause", key: "playPause", source: HANDLER },
    { signal: "longUp", key: "haut", source: HANDLER },
    { signal: "longDown", key: "bas", source: HANDLER },
    { signal: "longLeft", key: "gauche", source: HANDLER },
    { signal: "longRight", key: "droite", source: HANDLER },
  ],
  swipes: [
    { signal: "swipeUp", direction: "haut", source: HANDLER },
    { signal: "swipeDown", direction: "bas", source: HANDLER },
    { signal: "swipeLeft", direction: "gauche", source: HANDLER },
    { signal: "swipeRight", direction: "droite", source: HANDLER },
  ],
  drags: [{ signal: "pan", source: `${HANDLER}, tant qu'un écran tient le pan (TVEventControl.enableTVPanGesture)` }],
  noise: [
    { signal: "focus", reason: "le focus arrive sur un élément : le magasin du focus le voit, clé par clé" },
    { signal: "blur", reason: "le focus quitte un élément : idem" },
  ],
  system: [
    { control: "TV (Centre de contrôle), appui", effect: "l'écran d'accueil de tvOS (ou l'app TV)" },
    { control: "TV (Centre de contrôle), maintien", effect: "le Centre de contrôle" },
    { control: "Menu / Retour, maintien", effect: "l'écran d'accueil de tvOS" },
    { control: "Siri", effect: "Siri, et la dictée système dans un champ de saisie" },
    { control: "Volume, sourdine, alimentation", effect: "le téléviseur (HDMI-CEC ou infrarouge)" },
    { control: "Anneau du pavé (3e génération), geste circulaire", effect: "réservé au lecteur système : react-native-tvos ne l'émet pas" },
  ],
  traits: {
    focusMovesBeforeIntent: true,
    pressOnRelease: true,
    announcedHolds: true,
    holdThresholdMs: 500,
    backDecidedAhead: true,
    touchSurface: true,
    dragOnDemand: true,
    dragUnit: "point de la vue racine (translation et vitesse par seconde, react-native-tvos)",
    playPauseKey: "always",
  },
  hints: BASE_REMOTE_HINTS,
};
