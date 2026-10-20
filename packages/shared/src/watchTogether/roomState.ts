import type { WtInviteDto, WtRoomStateDto, WtStateCause } from "../types/watchTogether";

/**
 * Watch Together — l'état de salle d'un appareil et ce qu'un nouvel état y
 * change, en pur : réducteur (garde anti-périmé par epoch) et EFFETS d'un
 * `wt:state` (messages à dire, titre à suivre). Chaque plateforme les rend à
 * sa façon — toast du web, bannière du mobile — sans rien décider elle-même.
 */

export interface WtState {
  room: WtRoomStateDto | null;
  invites: WtInviteDto[];
}

export const WT_INITIAL_STATE: WtState = { room: null, invites: [] };

export type WtAction =
  | { type: "set_room"; room: WtRoomStateDto | null }
  | { type: "room_state"; state: WtRoomStateDto }
  | { type: "set_invites"; invites: WtInviteDto[] }
  | { type: "add_invite"; invite: WtInviteDto }
  | { type: "remove_invite"; inviteId: string };

/** Un état d'un même groupe qui n'avance pas l'epoch est périmé (réseau réordonné). */
export function isStaleRoomState(prev: WtRoomStateDto | null, next: WtRoomStateDto): boolean {
  return !!prev && prev.groupId === next.groupId && next.epoch <= prev.epoch;
}

export function wtReducer(state: WtState, action: WtAction): WtState {
  switch (action.type) {
    case "set_room":
      return { ...state, room: action.room };
    case "room_state":
      return isStaleRoomState(state.room, action.state) ? state : { ...state, room: action.state };
    case "set_invites":
      return { ...state, invites: action.invites };
    case "add_invite":
      if (state.invites.some((i) => i.inviteId === action.invite.inviteId)) return state;
      return { ...state, invites: [...state.invites, action.invite] };
    case "remove_invite":
      return { ...state, invites: state.invites.filter((i) => i.inviteId !== action.inviteId) };
  }
}

/** Un message à dire (clé de l'espace i18n `watchTogether`). */
export interface WtToastEffect {
  kind: "success" | "error" | "info";
  key: string;
  params?: Record<string, string>;
  /** Anti-rafale : deux messages de même clé de rafale à moins de
   *  `WT_TOAST_BURST_MS` — le second se tait (un seek coalescé côté serveur
   *  produit un état par remplacement de barrière). */
  burstKey?: string;
}

export const WT_TOAST_BURST_MS = 2_000;

export interface WtStateEffects {
  toasts: WtToastEffect[];
  /** Un titre vient d'être lancé pour la salle : à suivre, selon la plateforme
   *  (`firstLaunch` : le premier du groupe — tout le monde le suit). */
  follow: { itemId: string; firstLaunch: boolean } | null;
}

function nameOf(state: WtRoomStateDto | null, userId: string | null): string {
  if (!state || !userId) return "";
  return state.members.find((m) => m.userId === userId)?.username ?? "";
}

/** Ce qu'un nouvel état (déjà jugé frais) change à l'écran de `selfId`. */
export function wtStateEffects(
  prev: WtRoomStateDto | null,
  next: WtRoomStateDto,
  cause: WtStateCause,
  originUserId: string | null,
  selfId: string,
): WtStateEffects {
  const toasts: WtToastEffect[] = [];
  const originName = nameOf(next, originUserId) || nameOf(prev, originUserId);

  if (prev && prev.groupId === next.groupId) {
    const prevIds = new Set(prev.members.map((m) => m.userId));
    const nextIds = new Set(next.members.map((m) => m.userId));
    for (const m of next.members) {
      if (!prevIds.has(m.userId) && m.userId !== selfId) toasts.push({ kind: "info", key: "memberJoined", params: { name: m.username } });
    }
    for (const m of prev.members) {
      if (!nextIds.has(m.userId) && m.userId !== selfId) {
        toasts.push({ kind: "info", key: cause === "kick" ? "memberKicked" : "memberLeft", params: { name: m.username } });
      }
    }
    if (next.hostUserId !== prev.hostUserId) {
      toasts.push(next.hostUserId === selfId
        ? { kind: "info", key: "youAreHost" }
        : { kind: "info", key: "hostTransferred", params: { name: nameOf(next, next.hostUserId) } });
    }
    // Un membre que ses droits Jellyfin empêchent de lire : les autres l'apprennent.
    for (const m of next.members) {
      const before = prev.members.find((p) => p.userId === m.userId);
      if (m.playbackError && !before?.playbackError && m.userId !== selfId) {
        toasts.push({ kind: "error", key: "memberCantPlay", params: { name: m.username } });
      }
    }
  }

  if (originUserId !== selfId) {
    const byName = { name: originName };
    if (cause === "pause") toasts.push({ kind: "info", key: "pausedBy", params: byName });
    else if (cause === "play") toasts.push({ kind: "info", key: "resumedBy", params: byName });
    else if (cause === "seek") toasts.push({ kind: "info", key: "seekedBy", params: byName, burstKey: `seek:${originUserId ?? ""}` });
    // Saut exécuté par le serveur (décompte arrivé à terme) : personne à nommer.
    else if (cause === "skip") toasts.push({ kind: "info", key: "skippedByGroup" });
    else if (cause === "setItem") toasts.push({ kind: "info", key: "itemStartedBy", params: byName });
  }

  // Auto-follow : le titre lancé pour le groupe (émetteur compris — chemin de
  // navigation unique du protocole). Qui le suit, c'est la plateforme qui le sait.
  const follow = cause === "setItem" && next.itemId
    ? { itemId: next.itemId, firstLaunch: !prev || prev.itemId === null }
    : null;
  return { toasts, follow };
}
