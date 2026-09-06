/**
 * Le cœur hors ligne, commun au bureau et au mobile.
 *
 * Tout ce qui est exporté d'ici est PORTABLE : ni Node, ni Electron, ni Expo.
 * Chaque plateforme fournit ses adaptateurs (`adapters.ts`) — les Nôtres pour
 * Node vivent sous `./node`, jamais ré-exportés d'ici.
 *
 * Le main Electron ne consomme pas ce paquet : il en garde une copie de
 * `src/core` et `src/node`, recopiée par `mirror.mjs` et verrouillée par un
 * test d'égalité.
 */

export * from "./core/adapters";
export * from "./core/utf8";
export * from "./core/json";
export { bit, flag, integer, integerOrNull, rowId, text, textOrNull } from "./core/rows";
export * from "./core/schema";
export * from "./core/db";
export * from "./core/paths";
export * from "./core/store";
export * from "./core/queue";
export * from "./core/enqueue";
export * from "./core/listing";
export * from "./core/purge";
export * from "./core/playback";
export * from "./core/meta";
export * from "./core/fetcher";
export * from "./core/transfer";
export * from "./core/transferNet";
export * from "./core/worker";
export * from "./core/engine";
export * as session from "./core/session";
export * as trickplay from "./core/trickplay";
export * as segments from "./core/segments";
export * as subs from "./core/subs";
export * as episodeNumbers from "./core/episodeNumbers";
export { heal } from "./core/heal";
export { snapshot } from "./core/snapshot";
