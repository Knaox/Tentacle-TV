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
/**
 * Reprise planifiée : l'instant de reprise est posé dans le futur, à
 * `now + lead`, pour que TOUS les lecteurs repartent au même instant serveur
 * — l'écart d'une reprise « à la réception » vaut la différence de latence
 * entre membres. Le délai suit le membre le plus lent (son aller-retour
 * déclaré + une marge), borné : sous 180 ms un message n'a pas le temps
 * d'arriver partout ; au-delà de 900 ms un client d'avant, qui repart à la
 * réception, resterait trop longtemps devant (sa boucle ne corrige qu'à
 * partir de 0,4 s et ne seeke dur qu'après 15 s).
 */
export const WT_SCHEDULE_MIN_MS = 180;
export const WT_SCHEDULE_MARGIN_MS = 100;
export const WT_SCHEDULE_MAX_MS = 900;
/** Aller-retour supposé d'un membre qui n'a encore rien déclaré (ms). */
export const WT_DEFAULT_RTT_MS = 250;
/**
 * Barrière de synchronisation (seek, saut, reprise) : au-delà, les
 * retardataires sont lâchés SANS être déclarés en échec — un far-seek HLS
 * (renégociation ffmpeg) coûte légitimement une dizaine de secondes — et la
 * salle repart ; ils se recaleront d'un seek dur. Les chargements de média
 * gardent leur propre délai (WT_GROUP_WAIT_TIMEOUT_MS).
 */
export const WT_BARRIER_TIMEOUT_MS = 20_000;
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
