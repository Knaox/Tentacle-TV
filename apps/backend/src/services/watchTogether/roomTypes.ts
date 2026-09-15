import type { PlaybackSettings } from "../../playback/playbackSettings";
import type { WebSocket } from "@fastify/websocket";
import type { SegmentType } from "../../playback/segmentTypes";
import type { WtChatMessageDto, WtPauseReason, WtWaitCause } from "./protocol";

/**
 * Watch Together — les formes de l'état en mémoire (salles, membres,
 * invitations). Rien que des types : le registre (`roomRegistry.ts`) tient les
 * maps, `roomStore.ts` les mutations de composition, `roomInvites.ts` les
 * invitations, `sync.ts` la lecture.
 */

export interface RoomMember {
  userId: string;
  username: string;
  hasAvatar: boolean;
  inPlayback: boolean;
  buffering: boolean;
  playbackError: boolean;
  joinedAt: number;
  /** Timer de grâce armé quand le membre passe hors ligne (F5, coupure). */
  graceTimer: ReturnType<typeof setTimeout> | null;
  /** Version annoncée par son lecteur (`wt:presence`) — 1 = client d'avant. */
  protocolVersion: number;
  /** Dernier aller-retour déclaré (ms), null tant qu'il ne l'a pas dit. */
  rttMs: number | null;
  /** Écart au dernier `wt:tick` (ms, > 0 = en avance), null sans balise. */
  driftMs: number | null;
  /** Le socket dont le lecteur est en séance (`wt:presence inPlayback`) : sa
   *  fermeture libère l'attente — un compte peut garder un autre socket ouvert
   *  (second onglet) alors que son lecteur est mort. */
  playbackSocket: WebSocket | null;
}

/**
 * Une barrière : la salle attend que des lecteurs soient posés (sur une cible
 * de seek, après un rechargement…) avant de repartir — ou de rester en pause,
 * si c'est l'utilisateur qui l'avait mise en pause (`resumeOnRelease`).
 */
export interface Barrier {
  /** Identifiant monotone (Room.barrierId) : un « prêt » d'une barrière
   *  précédente ne libère jamais celle-ci. */
  id: number;
  targetTicks: number;
  cause: WtWaitCause;
  openedAt: number;
  resumeOnRelease: boolean;
  /** Délai de lâcher des retardataires (seek, saut, reprise) ; null pour un
   *  chargement (délai du sweep anti-gel). */
  timer: ReturnType<typeof setTimeout> | null;
}

/** Saut de passage armé par le serveur (voir `WtPendingSkipDto`). */
export interface PendingSkip {
  segmentType: SegmentType;
  segmentStartTicks: number;
  toTicks: number;
  skipAtPositionTicks: number;
  byUserId: string | null;
}

export interface Room {
  groupId: string;
  epoch: number;
  hostUserId: string;
  /**
   * Les réglages de lecture de l'hôte, tels que la base les portait au dernier
   * rafraîchissement (`hostSettings.ts`). `null` = pas encore lus, ou base en
   * panne : chacun garde alors les siens.
   */
  hostSettings: PlaybackSettings | null;
  /** Média « contexte » (fiche média au moment du create) — affichage/invites. */
  contextItemId: string | null;
  /** Média en cours de lecture synchronisée (null = rien lancé). */
  itemId: string | null;
  paused: boolean;
  positionTicks: number;
  stateAtServerTime: number;
  pauseReason: WtPauseReason;
  /** Membres dont on attend la fin de mise en mémoire tampon (group-wait). */
  waitingFor: Set<string>;
  /** Horodatage d'entrée dans waitingFor (miroir) — timeout anti-gel infini. */
  waitingSince: Map<string, number>;
  /** Compteur monotone des barrières ouvertes. */
  barrierId: number;
  /** La barrière en cours, null quand personne n'est attendu. */
  barrier: Barrier | null;
  /** Pourquoi la salle attend, null quand elle n'attend pas. */
  waitCause: WtWaitCause | null;
  /** Saut de passage armé, null sans décompte en cours. */
  pendingSkip: PendingSkip | null;
  members: Map<string, RoomMember>;
  /** Anti-spam seek : dernier seek accepté par membre. */
  lastSeekAt: Map<string, number>;
  /** Fil de chat (ring buffer WT_CHAT_HISTORY_SIZE) — survit aux départs,
   *  détruit avec la room. Voir chat.ts. */
  chat: WtChatMessageDto[];
  /** Compteur monotone d'ids de messages (`groupId:seq`). */
  chatSeq: number;
  /** Anti-spam chat/réactions/GIFs : dernier envoi accepté par membre. */
  lastChatAt: Map<string, number>;
  lastReactionAt: Map<string, number>;
  lastGifAt: Map<string, number>;
  createdAt: number;
}

export interface Invite {
  inviteId: string;
  groupId: string;
  fromUserId: string;
  fromUsername: string;
  toUserId: string;
  /** Snapshot du média du groupe au moment de l'invitation (contexte UI). */
  itemId: string | null;
  itemName: string | null;
  createdAt: number;
}

export interface UserBasic {
  userId: string;
  username: string;
  hasAvatar: boolean;
}

export interface RemovalResult {
  room: Room;
  removed: RoomMember;
  /** Nouvel hôte élu (plus ancien joinedAt) si l'hôte est parti, sinon null. */
  newHostId: string | null;
  /** Le groupe est vide et a été détruit. */
  dissolved: boolean;
}
