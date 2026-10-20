import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { WT_INITIAL_STATE, wtReducer, type WsClientMessage, type WtElsewhereDto, type WtInviteDto } from "@tentacle-tv/shared";
import { acquireSocket, onSocketStatus, sendSocketMessage, subscribeSocket } from "../../socket/tentacleSocket";
import { getClockOffsetMs } from "../../socket/clockSync";
import {
  createGroup, fetchGroupElsewhere, fetchMyGroup, fetchMyInvites, joinGroupHere, kickGroupMember, leaveGroup,
  respondToInvite, sendGroupInvites,
} from "../../hooks/useWatchTogetherApi";
import { setGroupPlaybackSettings } from "../../hooks/usePlaybackSettings";
import { useUserId } from "../../hooks/useUserId";
import { useServerCapability } from "../../hooks/useServerCapabilities";
import { useWatchTogetherAccess, WT_ACCESS_KEY } from "../../rights/useWatchTogetherAccess";
import { consumeLaunchFollow } from "../affinity/affinityStore";
import { WT_IDLE_CONTEXT, type WatchTogetherContextValue } from "../context";
import { usePendingInvites } from "./usePendingInvites";
import { handleWtServerMessage, type WtEventHelpers } from "./wtMessages";

/**
 * Watch Together — la séance d'un appareil, sans interface : socket, état de
 * la salle, invitations, actions, avis « ailleurs », réglages de l'hôte. La
 * plateforme ne fournit que ses gestes (`WtPlatformPort`) et rend l'interface
 * à partir de la valeur rendue — à poser dans `WatchTogetherContext.Provider`.
 */
export interface WtPlatformPort {
  /** Faux : la session est INERTE — ni socket, ni appel REST, aucun message
   *  `wt:*` traité, valeur `WT_IDLE_CONTEXT` (avec `selfId`). Le mobile la
   *  tient éteinte tant que son serveur ne déclare pas
   *  `watchTogether.deviceMembership` : face à un serveur d'avant, la salle
   *  du bureau serait diffusée au téléphone du même compte. Défaut : vrai. */
  enabled?: boolean;
  /** Jeton d'authentification du socket (bureau, mobile) ; absent = cookie (web). */
  socketToken?: string | null;
  /** Ouvrir le lecteur du titre de la salle (auto-follow, invitation acceptée). */
  navigateToWatch: (itemId: string) => void;
  isOnWatchPage: (itemId: string) => boolean;
  /** Sur une page de lecture, quel que soit le titre. */
  isWatching: () => boolean;
  toast: (kind: "success" | "error" | "info", message: string) => void;
  /** t de l'espace « watchTogether ». */
  t: (key: string, opts?: Record<string, unknown>) => string;
  /** Une invitation vient d'arriver (le web ouvre sa boîte à l'accueil). */
  onInviteArrived?: (invite: WtInviteDto) => void;
  /** « L'app se ferme » (web : `pagehide`) — le groupe est quitté vite (grâce
   *  courte). Absent (mobile) : la grâce de déconnexion suffit. */
  subscribeAppExit?: (onExit: () => void) => () => void;
}

export function useWatchTogetherSession(port: WtPlatformPort): WatchTogetherContextValue {
  const selfId = useUserId();
  const { mayJoin, mayCreate } = useWatchTogetherAccess();
  const deviceMembership = useServerCapability("watchTogether.deviceMembership");
  const queryClient = useQueryClient();
  const portRef = useRef(port);
  portRef.current = port;
  const enabled = port.enabled !== false;
  const mayJoinRef = useRef(mayJoin);
  mayJoinRef.current = mayJoin;

  const [state, dispatch] = useReducer(wtReducer, WT_INITIAL_STATE);
  const [elsewhere, setElsewhere] = useState<WtElsewhereDto | null>(null);
  const pendingInvites = usePendingInvites(state.room);
  const { add: addPending, resolve: resolvePending } = pendingInvites;

  const roomRef = useRef(state.room);
  roomRef.current = state.room;
  const helpersRef = useRef<WtEventHelpers | null>(null);
  helpersRef.current = {
    selfId: selfId ?? "",
    getRoom: () => roomRef.current,
    dispatch,
    toast: (kind, message) => portRef.current.toast(kind, message),
    t: (key, opts) => portRef.current.t(key, opts),
    navigateToWatch: (itemId) => portRef.current.navigateToWatch(itemId),
    isOnWatchPage: (itemId) => portRef.current.isOnWatchPage(itemId),
    isWatching: () => portRef.current.isWatching(),
    onInviteArrived: (invite) => portRef.current.onInviteArrived?.(invite),
    onInviteResult: (toUserId) => resolvePending(toUserId),
    followsLaunch: () => consumeLaunchFollow(),
    onAccessRevoked: () => { void queryClient.invalidateQueries({ queryKey: [WT_ACCESS_KEY] }); },
    onElsewhere: setElsewhere,
  };

  // Connexion + abonnements + resynchronisation d'état.
  const socketToken = port.socketToken;
  useEffect(() => {
    if (!selfId || !enabled) return;
    const release = acquireSocket(socketToken ?? undefined);
    const unsubMessages = subscribeSocket((msg) => {
      const h = helpersRef.current;
      // « Interdit » : aucune invitation ne s'affiche (le serveur n'en envoie déjà plus).
      if (msg.type === "wt:invite" && !mayJoinRef.current) return;
      if (h && msg.type.startsWith("wt:")) handleWtServerMessage(msg, h);
    });
    // À chaque (re)connexion authentifiée : état frais du groupe.
    const unsubStatus = onSocketStatus((status) => {
      if (status === "open" && roomRef.current) sendSocketMessage({ type: "wt:syncRequest" });
    });
    // Quitter l'app = quitter le groupe vite (un refresh se reconnecte avant la grâce courte).
    const unsubExit = portRef.current.subscribeAppExit?.(() => {
      if (roomRef.current) sendSocketMessage({ type: "wt:goodbye" });
    });
    return () => {
      unsubExit?.();
      unsubMessages();
      unsubStatus();
      release();
    };
  }, [selfId, socketToken, enabled]);

  // Démarrage REST : groupe courant, invitations, avis « ailleurs » — rien pour
  // un compte sans Watch Together (ou dont l'accès n'est pas encore connu).
  useEffect(() => {
    if (!selfId || !mayJoin || !enabled) {
      // Éteinte (ou sans droit) : plus rien de la séance d'avant.
      if (!enabled) dispatch({ type: "set_room", room: null });
      dispatch({ type: "set_invites", invites: [] });
      setElsewhere(null);
      return;
    }
    let cancelled = false;
    fetchMyGroup()
      .then((room) => { if (!cancelled) dispatch({ type: "set_room", room }); })
      .catch(() => {});
    fetchMyInvites()
      .then((invites) => { if (!cancelled) dispatch({ type: "set_invites", invites }); })
      .catch(() => {});
    if (deviceMembership) {
      fetchGroupElsewhere()
        .then((found) => { if (!cancelled && !roomRef.current) setElsewhere(found); })
        .catch(() => {});
    }
    return () => { cancelled = true; };
  }, [selfId, mayJoin, deviceMembership, enabled]);

  const send = useCallback((msg: WsClientMessage) => sendSocketMessage(msg), []);
  const serverNow = useCallback(() => Date.now() + (getClockOffsetMs() ?? 0), []);

  const actions = useMemo<WatchTogetherContextValue["actions"]>(() => {
    /** Entré dans une salle (invitation, « rejoindre ici ») : son lecteur, si elle joue. */
    const enter = (room: { itemId: string | null }) => {
      setElsewhere(null);
      const p = portRef.current;
      if (room.itemId && !p.isOnWatchPage(room.itemId)) p.navigateToWatch(room.itemId);
    };
    return {
      async create(itemId) {
        const room = await createGroup(itemId);
        dispatch({ type: "set_room", room });
        setElsewhere(null);
        return room;
      },
      async invite(users) {
        const { invited } = await sendGroupInvites(users.map((u) => u.id));
        addPending(users
          .filter((u) => invited.includes(u.id))
          .map((u) => ({ userId: u.id, username: u.name, hasAvatar: u.hasAvatar })));
        return invited.length;
      },
      async respond(inviteId, accept) {
        dispatch({ type: "remove_invite", inviteId });
        const result = await respondToInvite(inviteId, accept);
        if (accept && "groupId" in result) {
          dispatch({ type: "set_room", room: result });
          enter(result);
        }
      },
      async leave() {
        await leaveGroup();
        dispatch({ type: "set_room", room: null });
      },
      async kick(userId) {
        await kickGroupMember(userId);
      },
      async joinHere() {
        const room = await joinGroupHere();
        dispatch({ type: "set_room", room });
        enter(room);
      },
    };
  }, [addPending]);

  // Sortie de salle, quelle qu'en soit la voie (quitter, expulsé, dissoute,
  // appareil délié pendant une coupure) : les autres appareils du compte y
  // sont peut-être encore — l'avis se relit. Celui que le serveur a poussé
  // pendant qu'on se croyait dedans a été ignoré.
  const hadRoomRef = useRef(false);
  useEffect(() => {
    const hadRoom = hadRoomRef.current;
    hadRoomRef.current = !!state.room;
    if (!hadRoom || state.room || !enabled || !mayJoin || !deviceMembership) return;
    let cancelled = false;
    fetchGroupElsewhere()
      .then((found) => { if (!cancelled && !roomRef.current) setElsewhere(found); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [state.room, enabled, mayJoin, deviceMembership]);

  // Les réglages de lecture de l'HÔTE gouvernent la séance : posés tant qu'on
  // est dans un groupe sans en être l'hôte, retirés à la sortie. Le magasin
  // local n'est jamais écrit — les réglages du membre reviennent intacts.
  const hostSettings = state.room?.hostPlaybackSettings ?? null;
  const selfIsHost = !!state.room && !!selfId && state.room.hostUserId === selfId;
  useEffect(() => {
    setGroupPlaybackSettings(state.room && !selfIsHost ? hostSettings : null);
    return () => { setGroupPlaybackSettings(null); };
  }, [state.room, selfIsHost, hostSettings]);

  return useMemo<WatchTogetherContextValue>(() => (!enabled ? { ...WT_IDLE_CONTEXT, selfId } : {
    room: state.room,
    invites: state.invites,
    selfId,
    isInGroup: !!state.room,
    isHost: selfIsHost,
    pendingInvites: pendingInvites.pending,
    mayJoin,
    mayCreate,
    elsewhere: state.room ? null : elsewhere,
    send,
    serverNow,
    actions,
  }), [enabled, state.room, state.invites, selfId, selfIsHost, pendingInvites.pending, mayJoin, mayCreate, elsewhere, send, serverNow, actions]);
}
