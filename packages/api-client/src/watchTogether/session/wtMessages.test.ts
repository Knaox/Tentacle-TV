import { describe, expect, it, vi } from "vitest";
import type { WtAction, WtMemberDto, WtRoomStateDto } from "@tentacle-tv/shared";
import { handleWtServerMessage, type WtEventHelpers } from "./wtMessages";

/**
 * Ce qu'un message serveur fait à la séance d'un appareil : l'avis « ailleurs »
 * (adhésion par appareil), le suivi d'un titre lancé, l'anti-rafale des seeks.
 */

const member = (userId: string): WtMemberDto => ({
  userId, username: userId.toUpperCase(), hasAvatar: false, online: true, inPlayback: true, buffering: false,
  playbackError: false, isHost: false, joinedAt: 0,
});
const room = (patch: Partial<WtRoomStateDto> = {}): WtRoomStateDto => ({
  groupId: "g", hostUserId: "a", epoch: 1, itemId: null, paused: true, positionTicks: 0,
  stateAtServerTime: 0, pauseReason: "user", waitingForUserIds: [], members: [member("a"), member("b")], ...patch,
});

function helpers(current: WtRoomStateDto | null, patch: Partial<WtEventHelpers> = {}) {
  const actions: WtAction[] = [];
  const toasts: string[] = [];
  const h: WtEventHelpers = {
    selfId: "b",
    getRoom: () => current,
    dispatch: (a) => actions.push(a),
    toast: (_k, m) => toasts.push(m),
    t: (key) => key,
    navigateToWatch: vi.fn(),
    isOnWatchPage: () => false,
    isWatching: () => false,
    onElsewhere: vi.fn(),
    ...patch,
  };
  return { h, actions, toasts };
}

describe("handleWtServerMessage", () => {
  it("l'avis « ailleurs » n'existe que pour un appareil hors de la salle", () => {
    const elsewhere = { groupId: "g", hostUsername: "A", itemId: null, memberCount: 2, deviceCount: 1 };
    const out = helpers(null);
    handleWtServerMessage({ type: "wt:elsewhere", elsewhere }, out.h);
    expect(out.h.onElsewhere).toHaveBeenCalledWith(elsewhere);
    const inside = helpers(room());
    handleWtServerMessage({ type: "wt:elsewhere", elsewhere }, inside.h);
    expect(inside.h.onElsewhere).not.toHaveBeenCalled();
  });

  it("l'avis « ailleurs » reçu dans une salle : quittée par une autre voie — l'état se redemande", () => {
    // Seuls les appareils NON liés le reçoivent : la séance garde l'état d'une salle quittée.
    const kept = helpers(room(), { resync: vi.fn() });
    handleWtServerMessage({ type: "wt:elsewhere", elsewhere: null }, kept.h);
    expect(kept.h.resync).toHaveBeenCalledTimes(1);
    expect(kept.actions).toEqual([]);
    const outside = helpers(null, { resync: vi.fn() });
    handleWtServerMessage({ type: "wt:elsewhere", elsewhere: null }, outside.h);
    expect(outside.h.resync).not.toHaveBeenCalled();
  });

  it("un état de la salle éteint l'avis et applique l'état", () => {
    const { h, actions } = helpers(null);
    handleWtServerMessage({ type: "wt:state", state: room({ epoch: 3 }), originUserId: null, cause: "join" }, h);
    expect(h.onElsewhere).toHaveBeenCalledWith(null);
    expect(actions[0]).toMatchObject({ type: "room_state" });
  });

  it("le premier titre lancé emmène tout le monde ; ensuite, seulement ceux qui regardent", () => {
    const first = helpers(room());
    handleWtServerMessage({ type: "wt:state", state: room({ epoch: 2, itemId: "film" }), originUserId: "a", cause: "setItem" }, first.h);
    expect(first.h.navigateToWatch).toHaveBeenCalledWith("film");
    const next = helpers(room({ itemId: "ep1" }));
    handleWtServerMessage({ type: "wt:state", state: room({ epoch: 2, itemId: "ep2" }), originUserId: "a", cause: "setItem" }, next.h);
    expect(next.h.navigateToWatch).not.toHaveBeenCalled();
  });

  it("deux seeks du même membre en rafale : un seul message", () => {
    const { h, toasts } = helpers(room({ itemId: "film" }));
    handleWtServerMessage({ type: "wt:state", state: room({ epoch: 5, itemId: "film" }), originUserId: "a", cause: "seek" }, h);
    handleWtServerMessage({ type: "wt:state", state: room({ epoch: 6, itemId: "film" }), originUserId: "a", cause: "seek" }, h);
    expect(toasts.filter((m) => m === "seekedBy")).toHaveLength(1);
  });

  it("une invitation répondue ailleurs disparaît de la liste", () => {
    const { h, actions } = helpers(null);
    handleWtServerMessage({ type: "wt:inviteGone", inviteId: "i1" }, h);
    expect(actions).toEqual([{ type: "remove_invite", inviteId: "i1" }]);
  });

  it("not_in_group (salle disparue, appareil délié) : purge locale", () => {
    const { h, actions } = helpers(room());
    handleWtServerMessage({ type: "wt:error", code: "not_in_group" }, h);
    expect(actions).toEqual([{ type: "set_room", room: null }]);
  });
});

describe("handleWtServerMessage — un seul avis pour une arrivée par invitation", () => {
  it("acceptée : « a rejoint le groupe » (dit par l'état) suffit ; refusée, ou état pas encore là : l'avis de la réponse", () => {
    const joined = helpers(room({ members: [member("a"), member("b"), member("c")] }));
    joined.h.selfId = "a";
    handleWtServerMessage({ type: "wt:inviteResult", inviteId: "i", toUserId: "c", toUsername: "C", accepted: true }, joined.h);
    expect(joined.toasts).toEqual([]);
    const notYet = helpers(room());
    handleWtServerMessage({ type: "wt:inviteResult", inviteId: "i", toUserId: "c", toUsername: "C", accepted: true }, notYet.h);
    expect(notYet.toasts).toEqual(["inviteAccepted"]);
    const declined = helpers(room());
    handleWtServerMessage({ type: "wt:inviteResult", inviteId: "i", toUserId: "c", toUsername: "C", accepted: false }, declined.h);
    expect(declined.toasts).toEqual(["inviteDeclined"]);
  });
});
