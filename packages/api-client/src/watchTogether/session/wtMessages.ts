import {
  TICKS_PER_SECOND, WT_TOAST_BURST_MS, isStaleRoomState, wtStateEffects,
  type WsServerMessage, type WtAction, type WtElsewhereDto, type WtInviteDto, type WtRoomStateDto,
  type WtToastEffect,
} from "@tentacle-tv/shared";
import { wtLog } from "../wtLog";

/**
 * Watch Together — ce qu'un message serveur fait à l'état et à l'écran d'un
 * appareil, hors React. Les décisions sont pures (shared : `wtReducer`,
 * `wtStateEffects`) ; la plateforme fournit les gestes (messages, navigation).
 */

export interface WtEventHelpers {
  selfId: string;
  getRoom: () => WtRoomStateDto | null;
  dispatch: (action: WtAction) => void;
  toast: (type: "success" | "error" | "info", message: string) => void;
  /** t de l'espace « watchTogether ». */
  t: (key: string, opts?: Record<string, unknown>) => string;
  navigateToWatch: (itemId: string) => void;
  isOnWatchPage: (itemId: string) => boolean;
  /** Sur N'IMPORTE QUELLE page de lecture (l'utilisateur est « en train de regarder »). */
  isWatching: () => boolean;
  /** Une invitation vient d'arriver — la plateforme décide (modale, compteur). */
  onInviteArrived?: (invite: WtInviteDto) => void;
  /** L'invitation envoyée à `toUserId` a reçu sa réponse : elle n'attend plus. */
  onInviteResult?: (toUserId: string, accepted: boolean) => void;
  /** Un autre vient de lancer un match de l'affinité pendant que je swipais :
   *  le lancement qui suit m'emmène, comme un premier lancement. Consommé une fois. */
  followsLaunch?: () => boolean;
  /** Le compte a perdu Watch Together : son accès se relit (plus aucune trace). */
  onAccessRevoked?: () => void;
  /** Adhésion par appareil : l'avis « groupe en cours sur un autre appareil ». */
  onElsewhere?: (elsewhere: WtElsewhereDto | null) => void;
  /** Redemander l'état de la salle (`wt:syncRequest`) : le serveur le redit, ou purge (`not_in_group`). */
  resync?: () => void;
}

/** Anti-rafale des messages (un seek coalescé = un état par remplacement). */
const lastBurstAt = new Map<string, number>();

function say(toast: WtToastEffect, h: WtEventHelpers): void {
  if (toast.burstKey) {
    const now = Date.now();
    if (now - (lastBurstAt.get(toast.burstKey) ?? 0) < WT_TOAST_BURST_MS) return;
    lastBurstAt.set(toast.burstKey, now);
  }
  h.toast(toast.kind, h.t(toast.key, toast.params));
}

/** Point d'entrée : traite tout message serveur pertinent pour Watch Together. */
export function handleWtServerMessage(msg: WsServerMessage, h: WtEventHelpers): void {
  switch (msg.type) {
    case "wt:state": {
      const prev = h.getRoom();
      const { state, cause, originUserId } = msg;
      const stale = isStaleRoomState(prev, state);
      wtLog("provider", `wt:state reçu cause=${cause} epoch=${state.epoch}`, {
        origin: originUserId, paused: state.paused, reason: state.pauseReason,
        posS: (state.positionTicks / TICKS_PER_SECOND).toFixed(1),
        waitingFor: state.waitingForUserIds, allReady: state.allReady, stale,
      });
      if (stale) return;
      h.dispatch({ type: "room_state", state });
      // Dans la salle : l'avis « ailleurs » ne vaut plus.
      h.onElsewhere?.(null);
      const effects = wtStateEffects(prev, state, cause, originUserId, h.selfId);
      for (const toast of effects.toasts) say(toast, h);
      // Auto-follow : le premier lancement emmène tout le monde ; ensuite, ceux
      // qui regardent — et qui swipait quand un autre a lancé un match. Un
      // membre qui a quitté la lecture n'est pas ramené de force.
      const follow = effects.follow;
      if (follow && !h.isOnWatchPage(follow.itemId)) {
        if (follow.firstLaunch || h.isWatching() || h.followsLaunch?.()) h.navigateToWatch(follow.itemId);
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
    case "wt:inviteGone":
      // Répondue ailleurs (autre appareil, autre onglet) : elle ne s'affiche plus.
      h.dispatch({ type: "remove_invite", inviteId: msg.inviteId });
      break;
    case "wt:inviteResult":
      h.onInviteResult?.(msg.toUserId, msg.accepted);
      // Acceptée : l'état de la salle (envoyé juste avant) a déjà dit « X a rejoint le
      // groupe » — un seul avis pour une arrivée (banc mobile du 20/10).
      if (msg.accepted && h.getRoom()?.members.some((m) => m.userId === msg.toUserId)) break;
      h.toast(msg.accepted ? "success" : "info", h.t(
        msg.accepted ? "inviteAccepted" : "inviteDeclined",
        { name: msg.toUsername },
      ));
      break;
    case "wt:dissolved": {
      const room = h.getRoom();
      if (room && room.groupId === msg.groupId) {
        h.dispatch({ type: "set_room", room: null });
        const reason = msg.reason === "kicked" ? "youWereKicked" : msg.reason === "access_revoked" ? "accessRevoked" : "groupDissolved";
        h.toast("info", h.t(reason));
      }
      if (msg.reason === "access_revoked") h.onAccessRevoked?.();
      break;
    }
    case "wt:elsewhere":
      // Un appareil lié n'a pas d'avis : il EST dans la salle. Le serveur ne l'envoie
      // qu'aux appareils NON liés : une séance qui se croit dans une salle l'a quittée
      // par une autre voie (autre onglet du même navigateur, appel direct) et en garde
      // l'état — elle le redemande, le serveur tranche (21/10).
      if (!h.getRoom()) h.onElsewhere?.(msg.elsewhere);
      else h.resync?.();
      break;
    case "wt:error":
      // Room disparue pendant une coupure (ou cet appareil n'y est plus lié) :
      // purge locale silencieuse.
      if (msg.code === "not_in_group" && h.getRoom()) {
        h.dispatch({ type: "set_room", room: null });
      }
      break;
    default:
      break;
  }
}
