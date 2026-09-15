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

import type { PlaybackSettings } from "../playback/playbackSettings";
import type { SegmentType } from "../playback/segmentTypes";

/** Ticks Jellyfin par milliseconde (10 000 000 par seconde). */
const TICKS_PER_MS = 10_000;

/**
 * Version du protocole annoncée par un client (`wt:presence`). Un client
 * d'avant n'annonce rien : le serveur le tient pour la version 1 et ne
 * l'attend jamais dans une barrière de synchronisation (il ne saurait pas
 * répondre « prêt » — voir syncBarrier.ts) ; il reçoit les mêmes états et se
 * recale comme il l'a toujours fait.
 */
export const WT_PROTOCOL_VERSION = 2;

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
  /** Version annoncée par son lecteur (absente = client d'avant, version 1). */
  protocolVersion?: number;
  /** Aller-retour client ↔ serveur mesuré par son lecteur (ms), s'il l'a dit. */
  rttMs?: number;
  /** Écart de son lecteur à la position de la salle au dernier `wt:tick`
   *  (ms, > 0 = en avance) — diagnostic, jamais une consigne. */
  driftMs?: number;
}

export type WtPauseReason = "user" | "buffering" | null;

/**
 * Pourquoi la salle attend (elle est alors `paused` avec `pauseReason`
 * « buffering » : les clients d'avant ne connaissent que cette valeur, et
 * elle garde tout son sens — on attend que des lecteurs soient prêts).
 *  - buffering : un membre charge ou bufferise ;
 *  - seek / skip : tout le monde se cale sur la cible avant de repartir ;
 *  - play : une reprise a été demandée, elle attend les retardataires.
 */
export type WtWaitCause = "buffering" | "seek" | "skip" | "play";

/** Saut de passage armé par le serveur — le même décompte pour tous. */
export interface WtPendingSkipDto {
  segmentType: SegmentType;
  /** Début du passage (ticks) : identifie le passage, un par média. */
  segmentStartTicks: number;
  /** Cible du saut (ticks). */
  toTicks: number;
  /** Position de la salle à laquelle le saut s'exécute (ticks) — en position
   *  de média, pas en heure murale : une pause fige le décompte. */
  skipAtPositionTicks: number;
  /** Qui l'a proposé (null = client d'avant ou proposition serveur). */
  byUserId: string | null;
}

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
  /**
   * Barrière de synchronisation en cours : identifiant monotone que chaque
   * lecteur renvoie avec son « prêt » (`wt:buffering`), pour qu'un prêt
   * périmé ne libère jamais la barrière suivante. Absent = aucune barrière.
   */
  barrierId?: number;
  /** Pourquoi la salle attend — absent quand elle n'attend pas. */
  waitCause?: WtWaitCause;
  /** Saut de passage armé (décompte serveur) — absent quand il n'y en a pas. */
  pendingSkip?: WtPendingSkipDto;
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
  /** `force` : reprendre SANS attendre les retardataires d'une barrière —
   *  réservé à un geste explicite ; absent, une reprise demandée pendant une
   *  attente ne fait qu'en programmer la fin. */
  | { type: "wt:play"; positionTicks: number; force?: boolean }
  | { type: "wt:pause"; positionTicks: number }
  | { type: "wt:seek"; positionTicks: number }
  /** `fromItemId` = item courant vu par l'émetteur — sert à dédupliquer les
   *  auto-next concurrents : le serveur ignore si fromItemId ≠ state.itemId.
   *  `startPositionTicks` = position initiale du groupe (reprise Jellyfin du
   *  lanceur) — absent/0 pour un démarrage du début (épisode suivant…). */
  | { type: "wt:setItem"; itemId: string; fromItemId: string | null; reason: WtSetItemReason; startPositionTicks?: number }
  /** `barrierId` : la barrière à laquelle ce « prêt » répond (écho de l'état
   *  reçu) — sans lui (client d'avant), le prêt vaut pour la barrière courante.
   *  `rttMs` : l'aller-retour mesuré, pour le délai des reprises planifiées. */
  | { type: "wt:buffering"; buffering: boolean; positionTicks?: number; barrierId?: number; rttMs?: number }
  /** `protocolVersion` : ce que ce lecteur sait faire (WT_PROTOCOL_VERSION) ;
   *  absent = client d'avant. */
  | { type: "wt:presence"; inPlayback: boolean; itemId?: string; protocolVersion?: number; rttMs?: number }
  /** Balise périodique d'un lecteur en séance : sa position, son horloge, son
   *  aller-retour. Diagnostic (écart par membre) et délai des reprises — jamais
   *  une commande : la salle ne bouge pas. */
  | { type: "wt:tick"; positionTicks: number; paused: boolean; atServerTime: number; rttMs?: number }
  /** Un lecteur entre dans un passage que les réglages de l'HÔTE sautent tout
   *  seuls : il propose le saut, le serveur arme UN décompte pour la salle
   *  (dédupliqué par passage — tous les lecteurs proposent, un seul gagne). */
  | { type: "wt:skipPropose"; segmentType: SegmentType; isEpisode: boolean; segmentStartTicks: number; toTicks: number }
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
  | "buffering" | "resume" | "presence" | "sync"
  /** Saut de passage exécuté par le serveur (décompte arrivé à son terme). */
  | "skip"
  /** Reprise planifiée : `stateAtServerTime` est dans le futur, chacun repart
   *  à cet instant-là (un client d'avant repart à la réception et se recale). */
  | "schedule";

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
