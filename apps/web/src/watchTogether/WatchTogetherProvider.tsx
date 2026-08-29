import {
  createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef,
  useState, type ReactNode,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  acquireSocket, fetchMyGroup, fetchMyInvites, getClockOffsetMs, onSocketStatus,
  respondToInvite, sendGroupInvites, sendSocketMessage, subscribeSocket, useUserId,
  createGroup as apiCreateGroup, kickGroupMember, leaveGroup as apiLeaveGroup,
  setGroupPlaybackSettings,
} from "@tentacle-tv/api-client";
import type { WsClientMessage, WtInviteDto, WtRoomStateDto } from "@tentacle-tv/shared";
import { useToast } from "../contexts/ToastContext";
import { handleWtServerMessage, wtReducer, type WtEventHelpers } from "./wtEvents";
import { GroupPlaybackPill } from "./GroupPlaybackPill";
import { InviteInboxModal } from "./InviteInboxModal";
import { ChatRoot } from "./chat/ChatRoot";

/** Watch Together — état global du groupe (app-level, sous le Router). */

export interface WatchTogetherContextValue {
  room: WtRoomStateDto | null;
  invites: WtInviteDto[];
  selfId: string | null;
  isInGroup: boolean;
  isHost: boolean;
  /** Envoie un message wt:* sur le socket partagé (false si déconnecté). */
  send: (msg: WsClientMessage) => boolean;
  /** Horloge serveur estimée : Date.now() + offset (0 si non mesuré). */
  serverNow: () => number;
  actions: {
    create: (itemId?: string) => Promise<WtRoomStateDto>;
    invite: (userIds: string[]) => Promise<number>;
    respond: (inviteId: string, accept: boolean) => Promise<void>;
    leave: () => Promise<void>;
    kick: (userId: string) => Promise<void>;
  };
}

const Ctx = createContext<WatchTogetherContextValue | null>(null);

export function useWatchTogether(): WatchTogetherContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useWatchTogether must be used within WatchTogetherProvider");
  return ctx;
}

export function WatchTogetherProvider({ children }: { children: ReactNode }) {
  const selfId = useUserId();
  const { show } = useToast();
  const { t } = useTranslation("watchTogether");
  const navigate = useNavigate();
  const location = useLocation();

  const [state, dispatch] = useReducer(wtReducer, { room: null, invites: [] });
  /**
   * La boîte aux invitations, ouverte d'office à l'ACCUEIL.
   *
   * Là, on ne fait rien de précis : être interrompu ne coûte rien, et il ne
   * reste qu'à accepter. Ailleurs — une fiche qu'on lit, une lecture en cours —
   * l'invitation ne s'impose pas : le compteur du logo la garde sous la main.
   */
  const [inboxOpen, setInboxOpen] = useState(false);

  // Refs stables pour les callbacks socket (pas de re-souscription par render).
  const roomRef = useRef(state.room);
  roomRef.current = state.room;
  const locationRef = useRef(location.pathname);
  locationRef.current = location.pathname;
  const helpersRef = useRef<WtEventHelpers | null>(null);

  helpersRef.current = {
    selfId: selfId ?? "",
    getRoom: () => roomRef.current,
    dispatch,
    toast: show,
    t: (key, opts) => t(key, opts) as string,
    // Auto-follow : déjà sur un player → REMPLACER l'entrée d'historique
    // (sinon chaque épisode du groupe s'empile et le bouton retour du player
    // fait défiler les médias précédents au lieu de quitter la lecture).
    navigateToWatch: (itemId) => navigate(`/watch/${itemId}`, {
      replace: locationRef.current.startsWith("/watch/"),
    }),
    isOnWatchPage: (itemId) => locationRef.current === `/watch/${itemId}`,
    isWatching: () => locationRef.current.startsWith("/watch/"),
    onInviteArrived: () => { if (locationRef.current === "/") setInboxOpen(true); },
  };

  // Connexion + abonnements + resynchronisation d'état.
  useEffect(() => {
    if (!selfId) return;
    const token = typeof localStorage !== "undefined"
      ? localStorage.getItem("tentacle_token")
      : null;
    const release = acquireSocket(token ?? undefined);

    const unsubMessages = subscribeSocket((msg) => {
      const h = helpersRef.current;
      if (h && msg.type.startsWith("wt:")) handleWtServerMessage(msg, h);
    });

    const unsubStatus = onSocketStatus((status) => {
      // À chaque (re)connexion authentifiée : état frais du groupe.
      if (status === "open" && roomRef.current) {
        sendSocketMessage({ type: "wt:syncRequest" });
      }
    });

    // Quitter Tentacle (fermeture onglet/app) = quitter le groupe rapidement.
    // Un refresh émet aussi pagehide mais la reconnexion annule la grâce courte.
    const onPageHide = () => {
      if (roomRef.current) sendSocketMessage({ type: "wt:goodbye" });
    };
    window.addEventListener("pagehide", onPageHide);

    // Boot REST : groupe courant + invitations pendantes.
    let cancelled = false;
    fetchMyGroup()
      .then((room) => { if (!cancelled) dispatch({ type: "set_room", room }); })
      .catch(() => {});
    fetchMyInvites()
      .then((invites) => { if (!cancelled) dispatch({ type: "set_invites", invites }); })
      .catch(() => {});

    return () => {
      cancelled = true;
      window.removeEventListener("pagehide", onPageHide);
      unsubMessages();
      unsubStatus();
      release();
    };
  }, [selfId]);

  const send = useCallback((msg: WsClientMessage) => sendSocketMessage(msg), []);
  const serverNow = useCallback(() => Date.now() + (getClockOffsetMs() ?? 0), []);

  const actions = useMemo<WatchTogetherContextValue["actions"]>(() => ({
    async create(itemId) {
      const room = await apiCreateGroup(itemId);
      dispatch({ type: "set_room", room });
      return room;
    },
    async invite(userIds) {
      const { invited } = await sendGroupInvites(userIds);
      return invited.length;
    },
    async respond(inviteId, accept) {
      dispatch({ type: "remove_invite", inviteId });
      const result = await respondToInvite(inviteId, accept);
      if (accept && "groupId" in result) {
        dispatch({ type: "set_room", room: result });
        // Join en cours de lecture : rejoindre directement le player du groupe.
        if (result.itemId && locationRef.current !== `/watch/${result.itemId}`) {
          navigate(`/watch/${result.itemId}`);
        }
      }
    },
    async leave() {
      await apiLeaveGroup();
      dispatch({ type: "set_room", room: null });
    },
    async kick(userId) {
      await kickGroupMember(userId);
    },
  }), [navigate]);

  // Les réglages de lecture de l'HÔTE gouvernent la séance : posés tant qu'on
  // est dans un groupe sans en être l'hôte, retirés à la sortie. Le magasin
  // local n'est jamais écrit — les réglages du membre reviennent intacts.
  const hostSettings = state.room?.hostPlaybackSettings ?? null;
  const selfIsHost = !!state.room && !!selfId && state.room.hostUserId === selfId;
  useEffect(() => {
    setGroupPlaybackSettings(state.room && !selfIsHost ? hostSettings : null);
    return () => { setGroupPlaybackSettings(null); };
  }, [state.room, selfIsHost, hostSettings]);

  const value = useMemo<WatchTogetherContextValue>(() => ({
    room: state.room,
    invites: state.invites,
    selfId,
    isInGroup: !!state.room,
    isHost: selfIsHost,
    send,
    serverNow,
    actions,
  }), [state.room, state.invites, selfId, selfIsHost, send, serverNow, actions]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {inboxOpen && <InviteInboxModal onClose={() => setInboxOpen(false)} />}
      <GroupPlaybackPill />
      {state.room && <ChatRoot />}
    </Ctx.Provider>
  );
}
