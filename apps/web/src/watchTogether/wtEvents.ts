import type { WsServerMessage, WtInviteDto, WtRoomStateDto } from "@tentacle-tv/shared";
import { TICKS_PER_SECOND } from "@tentacle-tv/shared";
import { wtLog } from "./wtLog";

/**
 * Watch Together — réduction des messages serveur en actions d'état + effets
 * UI (toasts, auto-follow). Logique pure hors React : le provider fournit les
 * helpers (dispatch, toast, navigation) et reste sous la limite de lignes.
 */

export interface WtState {
  room: WtRoomStateDto | null;
  invites: WtInviteDto[];
}

export type WtAction =
  | { type: "set_room"; room: WtRoomStateDto | null }
  | { type: "room_state"; state: WtRoomStateDto }
  | { type: "set_invites"; invites: WtInviteDto[] }
  | { type: "add_invite"; invite: WtInviteDto }
  | { type: "remove_invite"; inviteId: string };

export function wtReducer(state: WtState, action: WtAction): WtState {
  switch (action.type) {
    case "set_room":
      return { ...state, room: action.room };
    case "room_state": {
      // Garde anti-stale : les états d'un même groupe doivent avancer l'epoch.
      const prev = state.room;
      if (prev && prev.groupId === action.state.groupId && action.state.epoch <= prev.epoch) {
        return state;
      }
      return { ...state, room: action.state };
    }
    case "set_invites":
      return { ...state, invites: action.invites };
    case "add_invite":
      if (state.invites.some((i) => i.inviteId === action.invite.inviteId)) return state;
      return { ...state, invites: [...state.invites, action.invite] };
    case "remove_invite":
      return { ...state, invites: state.invites.filter((i) => i.inviteId !== action.inviteId) };
  }
}

export interface WtEventHelpers {
  selfId: string;
  getRoom: () => WtRoomStateDto | null;
  dispatch: (action: WtAction) => void;
  toast: (type: "success" | "error" | "info", message: string) => void;
  /** t du namespace "watchTogether". */
  t: (key: string, opts?: Record<string, unknown>) => string;
  navigateToWatch: (itemId: string) => void;
  isOnWatchPage: (itemId: string) => boolean;
  /** Sur N'IMPORTE QUELLE page de lecture (l'utilisateur est « en train de regarder »). */
  isWatching: () => boolean;
  /**
   * Une invitation vient d'arriver.
   *
   * Le fournisseur décide seul ce qu'il en fait — ouvrir la modale à l'accueil,
   * se contenter du compteur ailleurs. Ce module ne connaît pas les routes, et
   * n'a pas à les apprendre pour cela.
   */
  onInviteArrived?: (invite: WtInviteDto) => void;
}

function username(state: WtRoomStateDto, userId: string | null): string {
  if (!userId) return "";
  return state.members.find((m) => m.userId === userId)?.username ?? "";
}

/** Toasts dérivés du diff prev→next + cause (membres, hôte, lecture). */
function emitStateToasts(
  prev: WtRoomStateDto | null,
  next: WtRoomStateDto,
  cause: string,
  originUserId: string | null,
  h: WtEventHelpers,
): void {
  const originName = username(next, originUserId) || (prev ? username(prev, originUserId) : "");
  const fromSelf = originUserId === h.selfId;

  if (prev && prev.groupId === next.groupId) {
    const prevIds = new Set(prev.members.map((m) => m.userId));
    const nextIds = new Set(next.members.map((m) => m.userId));
    for (const m of next.members) {
      if (!prevIds.has(m.userId) && m.userId !== h.selfId) {
        h.toast("info", h.t("memberJoined", { name: m.username }));
      }
    }
    for (const m of prev.members) {
      if (!nextIds.has(m.userId) && m.userId !== h.selfId) {
        h.toast("info", h.t(cause === "kick" ? "memberKicked" : "memberLeft", { name: m.username }));
      }
    }
    if (next.hostUserId !== prev.hostUserId) {
      const hostName = username(next, next.hostUserId);
      h.toast("info", next.hostUserId === h.selfId
        ? h.t("youAreHost")
        : h.t("hostTransferred", { name: hostName }));
    }
    // Nouveau membre bloqué par les droits Jellyfin → informer les autres.
    for (const m of next.members) {
      const before = prev.members.find((p) => p.userId === m.userId);
      if (m.playbackError && !before?.playbackError && m.userId !== h.selfId) {
        h.toast("error", h.t("memberCantPlay", { name: m.username }));
      }
    }
  }

  if (fromSelf) return;
  switch (cause) {
    case "pause":
      h.toast("info", h.t("pausedBy", { name: originName }));
      break;
    case "play":
      h.toast("info", h.t("resumedBy", { name: originName }));
      break;
    case "seek":
      h.toast("info", h.t("seekedBy", { name: originName }));
      break;
    case "setItem":
      h.toast("info", h.t("itemStartedBy", { name: originName }));
      break;
  }
}

/** Point d'entrée : traite tout message serveur pertinent pour Watch Together. */
export function handleWtServerMessage(msg: WsServerMessage, h: WtEventHelpers): void {
  switch (msg.type) {
    case "wt:state": {
      const prev = h.getRoom();
      const { state, cause, originUserId } = msg;
      wtLog("provider", `wt:state reçu cause=${cause} epoch=${state.epoch}`, {
        origin: originUserId, paused: state.paused, reason: state.pauseReason,
        posS: (state.positionTicks / TICKS_PER_SECOND).toFixed(1),
        waitingFor: state.waitingForUserIds,
        stale: !!(prev && prev.groupId === state.groupId && state.epoch <= prev.epoch),
      });
      // Stale (réordonnancement réseau) : même garde que le reducer.
      if (prev && prev.groupId === state.groupId && state.epoch <= prev.epoch) return;
      h.dispatch({ type: "room_state", state });
      emitStateToasts(prev, state, cause, originUserId, h);
      // Auto-follow : suivent le changement de média (émetteur compris —
      // chemin de navigation unique du protocole) :
      //  - ceux qui REGARDENT (page de lecture) — épisode suivant, autre film ;
      //  - tout le monde au PREMIER lancement du groupe (itemId null → média).
      // Un membre qui a quitté la lecture n'est pas ramené de force : la
      // pilule « Rejoindre » l'attend.
      if (cause === "setItem" && state.itemId && !h.isOnWatchPage(state.itemId)) {
        const firstLaunch = !prev || prev.itemId === null;
        if (firstLaunch || h.isWatching()) {
          h.navigateToWatch(state.itemId);
        }
      }
      break;
    }
    case "wt:invite":
      h.dispatch({ type: "add_invite", invite: msg.invite });
      h.onInviteArrived?.(msg.invite);
      h.toast("info", msg.invite.itemName
        ? h.t("invitedByWithItem", { name: msg.invite.fromUsername, title: msg.invite.itemName })
        : h.t("invitedBy", { name: msg.invite.fromUsername }));
      break;
    case "wt:inviteResult":
      h.toast(msg.accepted ? "success" : "info", h.t(
        msg.accepted ? "inviteAccepted" : "inviteDeclined",
        { name: msg.toUsername },
      ));
      break;
    case "wt:dissolved": {
      const room = h.getRoom();
      if (room && room.groupId === msg.groupId) {
        h.dispatch({ type: "set_room", room: null });
        h.toast("info", h.t(msg.reason === "kicked" ? "youWereKicked" : "groupDissolved"));
      }
      break;
    }
    case "wt:error":
      // Room disparue pendant une coupure : purge locale silencieuse.
      if (msg.code === "not_in_group" && h.getRoom()) {
        h.dispatch({ type: "set_room", room: null });
      }
      break;
    default:
      break;
  }
}
