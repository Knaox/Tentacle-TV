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

/** Messages sent from the server to clients. */
export type WsServerMessage =
  | { type: "auth_ok" }
  | { type: "auth_error"; reason: string }
  | { type: "pong" }
  | { type: "home:update"; carousel: CarouselId; action: "refresh" }
  | { type: "notifications:update"; action: "refresh" };

/** Messages sent from clients to the server. */
export type WsClientMessage =
  | { type: "auth"; token: string }
  | { type: "ping" };
