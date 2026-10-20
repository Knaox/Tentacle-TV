import { createContext, useContext } from "react";
import type {
  WsClientMessage, WtElsewhereDto, WtInvitableUserDto, WtInviteDto, WtRoomStateDto,
} from "@tentacle-tv/shared";
import type { WtPendingInvite } from "./session/usePendingInvites";

/**
 * Watch Together — la valeur de séance d'un appareil, la même pour toutes les
 * plateformes : la plateforme la fabrique par `useWatchTogetherSession(port)`
 * et la pose dans `WatchTogetherContext.Provider` ; tout le reste (moteur de
 * synchronisation, chat, décompte de saut, interface) la lit par
 * `useWatchTogether()`.
 */
export interface WatchTogetherContextValue {
  room: WtRoomStateDto | null;
  invites: WtInviteDto[];
  selfId: string | null;
  isInGroup: boolean;
  isHost: boolean;
  /** Invitations envoyées par l'hôte, sans réponse encore. */
  pendingInvites: WtPendingInvite[];
  /** L'accès du compte (SyncPlayAccess) : `mayJoin` faux = aucune trace de Watch Together ;
   *  `mayCreate` faux = rien qui crée un salon ni invite (cf. useWatchTogetherAccess). */
  mayJoin: boolean;
  mayCreate: boolean;
  /** Adhésion par appareil (1.31.1) : la salle du compte vue d'ICI quand cet
   *  appareil n'y est pas lié — « Groupe en cours sur un autre appareil ».
   *  `null` : il y est, ou il n'y en a pas, ou le serveur ne le sait pas. */
  elsewhere: WtElsewhereDto | null;
  /** Envoie un message wt:* sur le socket partagé (false si déconnecté). */
  send: (msg: WsClientMessage) => boolean;
  /** Horloge serveur estimée : Date.now() + offset (0 si non mesuré). */
  serverNow: () => number;
  actions: {
    create: (itemId?: string) => Promise<WtRoomStateDto>;
    /** Invite ces personnes ; rend le nombre d'invitations parties. */
    invite: (users: WtInvitableUserDto[]) => Promise<number>;
    respond: (inviteId: string, accept: boolean) => Promise<void>;
    leave: () => Promise<void>;
    kick: (userId: string) => Promise<void>;
    /** « Rejoindre ici » : AJOUTE cet appareil à la salle de son compte. */
    joinHere: () => Promise<void>;
    /** « Rejoindre » la lecture du groupe (membre déjà dans le groupe) : la salle
     *  se gèle au clic et attend cet appareil, puis son lecteur s'ouvre. */
    joinPlayback: () => Promise<void>;
  };
}

export const WatchTogetherContext = createContext<WatchTogetherContextValue | null>(null);

export function useWatchTogether(): WatchTogetherContextValue {
  const ctx = useContext(WatchTogetherContext);
  if (!ctx) throw new Error("useWatchTogether must be used within WatchTogetherProvider");
  return ctx;
}

/** Hors fournisseur (une plateforme sans Watch Together) : null, sans erreur. */
export function useWatchTogetherOptional(): WatchTogetherContextValue | null {
  return useContext(WatchTogetherContext);
}

/** La valeur d'un appareil SANS séance possible (pas de fournisseur : le
 *  téléviseur LG ; une session éteinte : le mobile face à un serveur sans
 *  `watchTogether.deviceMembership`). */
export const WT_IDLE_CONTEXT: WatchTogetherContextValue = {
  room: null,
  invites: [],
  selfId: null,
  isInGroup: false,
  isHost: false,
  pendingInvites: [],
  mayJoin: false,
  mayCreate: false,
  elsewhere: null,
  send: () => false,
  serverNow: () => Date.now(),
  actions: {
    create: () => Promise.reject(new Error("Watch Together indisponible")),
    invite: () => Promise.resolve(0),
    respond: () => Promise.resolve(),
    leave: () => Promise.resolve(),
    kick: () => Promise.resolve(),
    joinHere: () => Promise.resolve(),
    joinPlayback: () => Promise.resolve(),
  },
};

/**
 * Pour les crochets d'un LECTEUR (moteur, décompte de saut, session de
 * lecture) : ils tournent aussi là où aucun fournisseur n'est monté — le
 * client LG compile les pages de lecture du web sans Watch Together. Sans
 * fournisseur : aucune séance, rien n'est envoyé.
 */
export function useWatchTogetherOrIdle(): WatchTogetherContextValue {
  return useContext(WatchTogetherContext) ?? WT_IDLE_CONTEXT;
}
