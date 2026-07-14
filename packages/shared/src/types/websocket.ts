/** Carousel identifiers used in WebSocket home:update events. */
export type CarouselId =
  | "continue_watching"
  | "recently_added"
  | "next_up"
  | "trending"
  | "watchlist"
  | "watched"
  | "featured"
  | "notifications"
  | (string & {}); // extensible for plugins

import type { WtClientMessage, WtServerMessage } from "./watchTogether";

/** Messages sent from the server to clients.
 *  `pong` porte optionnellement `t` (echo du ping client) et `serverTime`
 *  (Date.now() serveur) — utilisés par Watch Together pour estimer l'offset
 *  d'horloge ; les clients qui envoient un ping nu reçoivent un pong nu. */
export type WsServerMessage =
  | { type: "auth_ok" }
  | { type: "auth_error"; reason: string }
  | { type: "pong"; t?: number; serverTime?: number }
  | { type: "home:update"; carousel: CarouselId; action: "refresh" }
  | { type: "notifications:update"; action: "refresh" }
  /** Le jumelage de cet appareil a été révoqué : se déconfigurer et revenir
   *  à l'écran de jumelage (poussé par le serveur à la suppression). */
  | { type: "session:revoked" }
  | WtServerMessage;

/** Messages sent from clients to the server. */
export type WsClientMessage =
  | { type: "auth"; token: string }
  | { type: "ping"; t?: number }
  | WtClientMessage;
