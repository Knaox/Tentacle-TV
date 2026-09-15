/**
 * Watch Together — protocole côté backend : constantes serveur et garde-fous.
 *
 * Le CONTRAT (DTOs, messages, causes) vit dans `protocolMessages.ts`, miroir
 * octet pour octet de `packages/shared/src/types/watchTogetherMessages.ts`
 * (le backend, CommonJS compilé depuis dist/, ne peut pas importer le package
 * shared à l'exécution) — tenu par `protocolMirror.test.ts`. La validation de
 * forme des messages entrants vit dans `protocolParse.ts`.
 */

export * from "./protocolMessages";

// ── Constantes ──

export const TICKS_PER_SECOND = 10_000_000;
export const TICKS_PER_MS = 10_000;
/** Grâce après déconnexion WS avant exclusion du groupe (un F5 ne kick pas). */
export const WT_GRACE_PERIOD_MS = 120_000;
/** Anti-spam : intervalle minimal entre deux seeks d'un même membre. */
export const WT_MIN_SEEK_INTERVAL_MS = 200;
/** Group-wait : au-delà, un membre encore attendu est déclaré en échec de
 *  lecture et le groupe reprend sans lui (anti-gel infini). */
export const WT_GROUP_WAIT_TIMEOUT_MS = 60_000;
/** Nombre max d'utilisateurs invitables en une requête. */
export const WT_MAX_INVITES_PER_REQUEST = 20;
/** Garde-fou : position max acceptée (~28 h) contre les payloads absurdes. */
export const WT_MAX_POSITION_TICKS = 1_000_000_000_000;
/** Chat : longueur max d'un message (caractères, tronqué au-delà). */
export const WT_CHAT_MAX_LENGTH = 500;
/** Chat : fil conservé en mémoire par room (renvoyé au join/resync). */
export const WT_CHAT_HISTORY_SIZE = 50;
/** Anti-spam : intervalle minimal entre deux messages / réactions d'un membre.
 *  Réactions volontairement permissives (~8/s) : le spam d'emojis est un usage voulu. */
export const WT_MIN_CHAT_INTERVAL_MS = 400;
export const WT_MIN_REACTION_INTERVAL_MS = 120;
/** Réaction : longueur max (un emoji composé ZWJ tient en ≤ 16 unités UTF-16). */
export const WT_REACTION_MAX_LENGTH = 16;
/** GIF : intervalle minimal entre deux envois d'un membre (plus lourd qu'un emoji). */
export const WT_MIN_GIF_INTERVAL_MS = 1_500;
/** GIF : longueur max de l'URL broadcastée (une URL tinygif Klipy reste courte). */
export const WT_GIF_URL_MAX_LENGTH = 512;

// ── Garde-fous ──

/** Clamp une position reçue du client (NaN/négatif/absurde → borné). */
export function clampTicks(n: unknown): number {
  const v = typeof n === "number" && Number.isFinite(n) ? Math.floor(n) : 0;
  return Math.min(Math.max(0, v), WT_MAX_POSITION_TICKS);
}
