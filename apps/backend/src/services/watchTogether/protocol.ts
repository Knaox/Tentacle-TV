/**
 * Watch Together — protocole côté backend.
 *
 * MIROIR de `packages/shared/src/types/watchTogether.ts` : le backend
 * (CommonJS compilé, exécuté depuis dist/) ne peut pas importer le package
 * shared (TypeScript source ESM) à l'exécution. Toute évolution du protocole
 * doit être répercutée dans les deux fichiers.
 */

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
/** Anti-spam : intervalle minimal entre deux messages / réactions d'un membre. */
export const WT_MIN_CHAT_INTERVAL_MS = 400;
export const WT_MIN_REACTION_INTERVAL_MS = 250;
/** Réaction : longueur max (un emoji composé ZWJ tient en ≤ 16 unités UTF-16). */
export const WT_REACTION_MAX_LENGTH = 16;

// ── DTOs ──

export interface WtMemberDto {
  userId: string;
  username: string;
  hasAvatar: boolean;
  online: boolean;
  inPlayback: boolean;
  buffering: boolean;
  playbackError: boolean;
  isHost: boolean;
  joinedAt: number;
}

export type WtPauseReason = "user" | "buffering" | null;

export interface WtRoomStateDto {
  groupId: string;
  hostUserId: string;
  epoch: number;
  itemId: string | null;
  paused: boolean;
  positionTicks: number;
  stateAtServerTime: number;
  pauseReason: WtPauseReason;
  waitingForUserIds: string[];
  members: WtMemberDto[];
}

export interface WtInviteDto {
  inviteId: string;
  groupId: string;
  fromUserId: string;
  fromUsername: string;
  itemId: string | null;
  itemName: string | null;
}

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
  | { type: "wt:setItem"; itemId: string; fromItemId: string | null; reason: WtSetItemReason; startPositionTicks?: number }
  | { type: "wt:buffering"; buffering: boolean; positionTicks?: number }
  | { type: "wt:presence"; inPlayback: boolean; itemId?: string }
  | { type: "wt:playbackError"; itemId: string }
  | { type: "wt:autonextDismiss" }
  | { type: "wt:goodbye" }
  | { type: "wt:syncRequest" }
  | { type: "wt:chat"; text: string }
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
  | { type: "wt:autonextDismiss"; originUserId: string }
  | { type: "wt:invite"; invite: WtInviteDto }
  | { type: "wt:inviteResult"; inviteId: string; toUserId: string; toUsername: string; accepted: boolean }
  | { type: "wt:dissolved"; groupId: string; reason: WtDissolvedReason }
  | { type: "wt:error"; code: WtErrorCode; message?: string }
  | { type: "wt:chat"; message: WtChatMessageDto }
  | { type: "wt:reaction"; userId: string; username: string; emoji: string; at: number }
  | { type: "wt:chatHistory"; groupId: string; messages: WtChatMessageDto[] };

// ── Helpers ──

/** Position vraie du groupe (ticks) à l'instant `now` (horloge serveur). */
export function wtPositionTicksAt(
  state: { paused: boolean; positionTicks: number; stateAtServerTime: number },
  now: number,
): number {
  if (state.paused) return state.positionTicks;
  return state.positionTicks + Math.max(0, now - state.stateAtServerTime) * TICKS_PER_MS;
}

/** Clamp une position reçue du client (NaN/négatif/absurde → borné). */
export function clampTicks(n: unknown): number {
  const v = typeof n === "number" && Number.isFinite(n) ? Math.floor(n) : 0;
  return Math.min(Math.max(0, v), WT_MAX_POSITION_TICKS);
}

const SET_ITEM_REASONS: readonly string[] = ["manual", "nextEp", "prevEp", "autonext"];

/** Validation de forme des messages entrants (payloads non fiables). */
export function parseWtClientMessage(msg: { type: string } & Record<string, unknown>): WtClientMessage | null {
  switch (msg.type) {
    case "wt:play":
    case "wt:pause":
    case "wt:seek":
      if (typeof msg.positionTicks !== "number" || !Number.isFinite(msg.positionTicks)) return null;
      return { type: msg.type, positionTicks: clampTicks(msg.positionTicks) };
    case "wt:setItem": {
      if (typeof msg.itemId !== "string" || !msg.itemId) return null;
      const from = msg.fromItemId;
      if (from !== null && typeof from !== "string") return null;
      const reason = typeof msg.reason === "string" && SET_ITEM_REASONS.includes(msg.reason)
        ? (msg.reason as WtSetItemReason) : "manual";
      return {
        type: "wt:setItem",
        itemId: msg.itemId,
        fromItemId: from ?? null,
        reason,
        startPositionTicks: typeof msg.startPositionTicks === "number" && Number.isFinite(msg.startPositionTicks)
          ? clampTicks(msg.startPositionTicks) : undefined,
      };
    }
    case "wt:buffering":
      if (typeof msg.buffering !== "boolean") return null;
      return {
        type: "wt:buffering",
        buffering: msg.buffering,
        positionTicks: typeof msg.positionTicks === "number" && Number.isFinite(msg.positionTicks)
          ? clampTicks(msg.positionTicks) : undefined,
      };
    case "wt:presence":
      if (typeof msg.inPlayback !== "boolean") return null;
      return {
        type: "wt:presence",
        inPlayback: msg.inPlayback,
        itemId: typeof msg.itemId === "string" ? msg.itemId : undefined,
      };
    case "wt:playbackError":
      if (typeof msg.itemId !== "string" || !msg.itemId) return null;
      return { type: "wt:playbackError", itemId: msg.itemId };
    case "wt:autonextDismiss":
      return { type: "wt:autonextDismiss" };
    case "wt:goodbye":
      return { type: "wt:goodbye" };
    case "wt:syncRequest":
      return { type: "wt:syncRequest" };
    case "wt:chat": {
      if (typeof msg.text !== "string") return null;
      const text = msg.text.trim().slice(0, WT_CHAT_MAX_LENGTH);
      if (!text) return null;
      return { type: "wt:chat", text };
    }
    case "wt:reaction": {
      if (typeof msg.emoji !== "string") return null;
      const emoji = msg.emoji.trim();
      if (!emoji || emoji.length > WT_REACTION_MAX_LENGTH) return null;
      return { type: "wt:reaction", emoji };
    }
    default:
      return null;
  }
}
