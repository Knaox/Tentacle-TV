import { TICKS_PER_SECOND } from "../constants";

/**
 * Watch Together — contrat partagé client ↔ backend.
 *
 * Le serveur est la source de vérité : il détient l'état canonique de chaque
 * groupe (room) et rebroadcast l'état COMPLET à chaque mutation (epoch + 1).
 * Il n'y a pas de heartbeat de position : la position vraie s'extrapole depuis
 * {positionTicks, stateAtServerTime, paused} + l'offset d'horloge client-serveur.
 */

// ── Constantes du protocole ──

export const TICKS_PER_MS = TICKS_PER_SECOND / 1000;

/** Grâce après déconnexion WS avant exclusion du groupe (un F5 ne kick pas). */
export const WT_GRACE_PERIOD_MS = 120_000;
/** |drift| en dessous duquel on ne corrige pas (secondes). */
export const WT_DRIFT_SOFT_S = 0.4;
/** |drift| au-dessus duquel on seek dur au lieu du rattrapage doux (secondes). */
export const WT_DRIFT_HARD_S = 4;
/** Écart max toléré à l'arrêt (room en pause) avant seek de réalignement. */
export const WT_DRIFT_PAUSED_S = 0.5;
/** Drift résorbé : on repasse le playbackRate à 1.0 sous ce seuil (secondes). */
export const WT_DRIFT_SETTLED_S = 0.1;
/** Vitesses de rattrapage doux (inaudibles, pitch préservé par défaut). */
export const WT_RATE_CATCHUP = 1.05;
export const WT_RATE_SLOWDOWN = 0.95;
/** Garde-fou : rattrapage doux non résorbé au bout de ce délai → seek dur. */
export const WT_SOFT_CORRECTION_TIMEOUT_MS = 15_000;
/** Lookahead ajouté à un seek dur pour compenser le temps de seek (secondes). */
export const WT_SEEK_LOOKAHEAD_S = 0.25;
/** Anti-spam serveur : intervalle minimal entre deux seeks d'un même membre. */
export const WT_MIN_SEEK_INTERVAL_MS = 200;
/** Nombre max d'utilisateurs invitables en une requête. */
export const WT_MAX_INVITES_PER_REQUEST = 20;
/** Période de la boucle de correction de drift côté client. */
export const WT_DRIFT_LOOP_MS = 1_000;
/** Rafale de pings à l'entrée en groupe pour estimer l'offset d'horloge. */
export const WT_CLOCK_BURST_COUNT = 5;
export const WT_CLOCK_BURST_SPACING_MS = 200;
/** Chat : longueur max d'un message (caractères, tronqué au-delà). */
export const WT_CHAT_MAX_LENGTH = 500;
/** Chat : fil conservé en mémoire par room (renvoyé au join/resync). */
export const WT_CHAT_HISTORY_SIZE = 50;
/** Anti-spam : intervalle minimal entre deux messages / réactions d'un membre. */
export const WT_MIN_CHAT_INTERVAL_MS = 400;
export const WT_MIN_REACTION_INTERVAL_MS = 250;
/** Réaction : longueur max (un emoji composé ZWJ tient en ≤ 16 unités UTF-16). */
export const WT_REACTION_MAX_LENGTH = 16;

// ── DTOs ──

export interface WtMemberDto {
  /** Id utilisateur Jellyfin (identité unique du projet). */
  userId: string;
  username: string;
  hasAvatar: boolean;
  /** Au moins une connexion WS active. */
  online: boolean;
  /** Player monté sur l'item courant du groupe. */
  inPlayback: boolean;
  buffering: boolean;
  /** Ne peut pas lire l'item courant (droits Jellyfin, média absent…). */
  playbackError: boolean;
  isHost: boolean;
  joinedAt: number;
}

export type WtPauseReason = "user" | "buffering" | null;

export interface WtRoomStateDto {
  groupId: string;
  hostUserId: string;
  /** Compteur monotone : +1 à chaque mutation. Les états stale sont ignorés. */
  epoch: number;
  /** Média courant du groupe (null = groupe créé sans lecture). */
  itemId: string | null;
  paused: boolean;
  /** Position au moment `stateAtServerTime` (extrapoler si !paused). */
  positionTicks: number;
  /** Date.now() serveur à la dernière mutation de lecture. */
  stateAtServerTime: number;
  pauseReason: WtPauseReason;
  /** Membres dont on attend la fin de mise en mémoire tampon (group-wait). */
  waitingForUserIds: string[];
  members: WtMemberDto[];
}

export interface WtInviteDto {
  inviteId: string;
  groupId: string;
  fromUserId: string;
  fromUsername: string;
  /** Item courant du groupe au moment de l'invitation (contexte UI). */
  itemId: string | null;
  itemName: string | null;
}

/** Projection minimale d'un utilisateur invitable (GET /watch-together/users). */
export interface WtInvitableUserDto {
  id: string;
  name: string;
  hasAvatar: boolean;
  isOnline: boolean;
}

/** Message du chat de groupe (fil éphémère, en mémoire room uniquement). */
export interface WtChatMessageDto {
  /** Unique par room (`groupId:seq`). */
  id: string;
  userId: string;
  username: string;
  text: string;
  /** Date.now() serveur à la réception. */
  at: number;
}

// ── Messages client → serveur ──

export type WtSetItemReason = "manual" | "nextEp" | "prevEp" | "autonext";

export type WtClientMessage =
  | { type: "wt:play"; positionTicks: number }
  | { type: "wt:pause"; positionTicks: number }
  | { type: "wt:seek"; positionTicks: number }
  /** `fromItemId` = item courant vu par l'émetteur — sert à dédupliquer les
   *  auto-next concurrents : le serveur ignore si fromItemId ≠ state.itemId.
   *  `startPositionTicks` = position initiale du groupe (reprise Jellyfin du
   *  lanceur) — absent/0 pour un démarrage du début (épisode suivant…). */
  | { type: "wt:setItem"; itemId: string; fromItemId: string | null; reason: WtSetItemReason; startPositionTicks?: number }
  | { type: "wt:buffering"; buffering: boolean; positionTicks?: number }
  | { type: "wt:presence"; inPlayback: boolean; itemId?: string }
  | { type: "wt:playbackError"; itemId: string }
  /** L'utilisateur a masqué la bannière « épisode suivant » — masquée partout. */
  | { type: "wt:autonextDismiss" }
  /** L'app se ferme (pagehide) : quitter le groupe rapidement (grâce courte —
   *  un simple refresh se reconnecte avant son expiration). */
  | { type: "wt:goodbye" }
  | { type: "wt:syncRequest" }
  /** Message texte du chat de groupe (trim + tronqué à WT_CHAT_MAX_LENGTH). */
  | { type: "wt:chat"; text: string }
  /** Réaction emoji éphémère (non stockée côté serveur). */
  | { type: "wt:reaction"; emoji: string };

// ── Messages serveur → clients ──

export type WtStateCause =
  | "join" | "leave" | "kick" | "hostChange"
  | "play" | "pause" | "seek" | "setItem"
  | "buffering" | "resume" | "presence" | "sync";

export type WtErrorCode = "not_in_group" | "not_host" | "invalid" | "stale_item";

export type WtDissolvedReason = "kicked" | "expired" | "dissolved";

export type WtServerMessage =
  | { type: "wt:state"; state: WtRoomStateDto; originUserId: string | null; cause: WtStateCause }
  /** Relai transient (hors state/epoch) : un membre a masqué l'auto-next. */
  | { type: "wt:autonextDismiss"; originUserId: string }
  | { type: "wt:invite"; invite: WtInviteDto }
  /** Notifie l'hôte du sort de son invitation. */
  | { type: "wt:inviteResult"; inviteId: string; toUserId: string; toUsername: string; accepted: boolean }
  /** Reçu quand on ne fait plus partie du groupe (kick, grâce expirée). */
  | { type: "wt:dissolved"; groupId: string; reason: WtDissolvedReason }
  | { type: "wt:error"; code: WtErrorCode; message?: string }
  /** Nouveau message de chat (écho compris : l'émetteur le reçoit aussi). */
  | { type: "wt:chat"; message: WtChatMessageDto }
  /** Réaction emoji transient (hors state/epoch, comme autonextDismiss). */
  | { type: "wt:reaction"; userId: string; username: string; emoji: string; at: number }
  /** Fil complet (ring buffer) — envoyé au join et à chaque syncRequest. */
  | { type: "wt:chatHistory"; groupId: string; messages: WtChatMessageDto[] };

// ── Helpers d'extrapolation (utilisés par le serveur ET les clients) ──

/** Position vraie du groupe (ticks) à l'instant `serverNow` (horloge serveur). */
export function wtPositionTicksAt(
  state: Pick<WtRoomStateDto, "paused" | "positionTicks" | "stateAtServerTime">,
  serverNow: number,
): number {
  if (state.paused) return state.positionTicks;
  return state.positionTicks + Math.max(0, serverNow - state.stateAtServerTime) * TICKS_PER_MS;
}

/** Position vraie du groupe (secondes) à l'instant `serverNow`. */
export function wtPositionSecondsAt(
  state: Pick<WtRoomStateDto, "paused" | "positionTicks" | "stateAtServerTime">,
  serverNow: number,
): number {
  return wtPositionTicksAt(state, serverNow) / TICKS_PER_SECOND;
}
