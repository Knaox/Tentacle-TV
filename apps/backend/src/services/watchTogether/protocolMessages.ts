/**
 * Watch Together — le CONTRAT des messages, DTOs et causes.
 *
 * Ce fichier est recopié octet pour octet dans le backend
 * (`apps/backend/src/services/watchTogether/protocolMessages.ts`, seuls les
 * chemins d'import diffèrent) : le backend est compilé en CommonJS et exécuté
 * depuis dist/, il ne peut pas importer le package shared à l'exécution. Le
 * test `protocolMirror.test.ts` du backend tient les deux copies ensemble —
 * on modifie ICI, on recopie là-bas. Rien d'autre que le contrat ne vit ici :
 * les constantes propres à chaque côté restent dans `watchTogether.ts` et
 * `protocol.ts`.
 */

import type { PlaybackSettings } from "../../playback/playbackSettings";
import type { SegmentType } from "../../playback/segmentTypes";

/** Ticks Jellyfin par milliseconde (10 000 000 par seconde). */
const TICKS_PER_MS = 10_000;

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
  /**
   * Les réglages de lecture de l'HÔTE — ils gouvernent le groupe.
   *
   * Une séance commune ne peut pas avoir deux comportements : si l'hôte passe
   * les génériques tout seul et qu'un membre les garde, l'un des deux subit la
   * position de l'autre sans comprendre pourquoi. C'est donc l'hôte qui décide,
   * pour tout le monde, le temps de la séance — les réglages du membre ne sont
   * jamais écrits, ils reviennent intacts à la sortie.
   *
   * FACULTATIF : un serveur d'avant ne l'envoie pas, un client d'avant
   * l'ignore. Absent, chacun garde ses réglages, comme aujourd'hui.
   */
  hostPlaybackSettings?: PlaybackSettings;
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
  /** L'utilisateur refuse le saut d'un passage. Refusé partout : la position
   *  de lecture est commune, laisser le décompte de l'autre partir reviendrait
   *  à traîner hors du passage celui qui vient de le garder.
   *  `segmentType` est FACULTATIF : un client d'avant la refonte ne l'envoie
   *  pas, et son silence vaut « Intro » — le seul passage qu'il savait sauter.
   *  Le nom du message, lui, ne bouge pas : le renommer couperait la séance
   *  entre deux versions pour un gain nul. */
  | { type: "wt:skipIntroDismiss"; segmentType?: SegmentType }
  /** L'app se ferme (pagehide) : quitter le groupe rapidement (grâce courte —
   *  un simple refresh se reconnecte avant son expiration). */
  | { type: "wt:goodbye" }
  | { type: "wt:syncRequest" }
  /** Message texte du chat de groupe (trim + tronqué à WT_CHAT_MAX_LENGTH). */
  | { type: "wt:chat"; text: string }
  /** Réaction emoji éphémère (non stockée côté serveur). */
  | { type: "wt:reaction"; emoji: string }
  /** GIF éphémère (URL tinygif Klipy, allowlist d'hôtes côté serveur — jamais stocké). */
  | { type: "wt:gif"; url: string; w?: number; h?: number };

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
  /** Idem pour le refus d'un passage — `segmentType` absent = « Intro ». */
  | { type: "wt:skipIntroDismiss"; originUserId: string; segmentType?: SegmentType }
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
  /** GIF transient (même sémantique que wt:reaction — jamais stocké). */
  | { type: "wt:gif"; userId: string; username: string; url: string; w?: number; h?: number; at: number }
  /** Fil complet (ring buffer) — envoyé au join et à chaque syncRequest. */
  | { type: "wt:chatHistory"; groupId: string; messages: WtChatMessageDto[] };

// ── Extrapolation (serveur ET clients) ──

/** Position vraie du groupe (ticks) à l'instant `serverNow` (horloge serveur). */
export function wtPositionTicksAt(
  state: Pick<WtRoomStateDto, "paused" | "positionTicks" | "stateAtServerTime">,
  serverNow: number,
): number {
  if (state.paused) return state.positionTicks;
  return state.positionTicks + Math.max(0, serverNow - state.stateAtServerTime) * TICKS_PER_MS;
}
