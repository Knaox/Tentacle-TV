import { describe, expect, it } from "vitest";
import type { WtMemberDto, WtRoomStateDto } from "../types/watchTogether";
import { WT_INITIAL_STATE, wtReducer, wtStateEffects } from "./roomState";

const member = (userId: string, patch: Partial<WtMemberDto> = {}): WtMemberDto => ({
  userId, username: userId.toUpperCase(), hasAvatar: false, online: true, inPlayback: true, buffering: false,
  playbackError: false, isHost: false, joinedAt: 0, ...patch,
});
const room = (patch: Partial<WtRoomStateDto> = {}): WtRoomStateDto => ({
  groupId: "g", hostUserId: "a", epoch: 1, itemId: "film", paused: false, positionTicks: 0,
  stateAtServerTime: 0, pauseReason: null, waitingForUserIds: [], members: [member("a"), member("b")], ...patch,
});

describe("wtReducer", () => {
  it("ignore un état périmé du même groupe, prend celui d'un autre groupe", () => {
    const s1 = wtReducer(WT_INITIAL_STATE, { type: "room_state", state: room({ epoch: 5 }) });
    expect(wtReducer(s1, { type: "room_state", state: room({ epoch: 4 }) })).toBe(s1);
    expect(wtReducer(s1, { type: "room_state", state: room({ epoch: 1, groupId: "h" }) }).room?.groupId).toBe("h");
  });

  it("invitations dédupliquées, retirées", () => {
    const invite = { inviteId: "i", groupId: "g", fromUserId: "a", fromUsername: "A", itemId: null, itemName: null };
    const s1 = wtReducer(WT_INITIAL_STATE, { type: "add_invite", invite });
    expect(wtReducer(s1, { type: "add_invite", invite })).toBe(s1);
    expect(wtReducer(s1, { type: "remove_invite", inviteId: "i" }).invites).toEqual([]);
  });
});

describe("wtStateEffects", () => {
  it("dit les arrivées, départs et le nouvel hôte — jamais pour soi", () => {
    const prev = room({ members: [member("a"), member("b")] });
    const next = room({ hostUserId: "b", epoch: 2, members: [member("b"), member("c")] });
    const { toasts } = wtStateEffects(prev, next, "leave", "a", "b");
    expect(toasts.map((t) => t.key)).toEqual(["memberJoined", "memberLeft", "youAreHost"]);
  });

  it("nomme l'auteur d'une pause, se tait sur ses propres gestes, marque le seek pour l'anti-rafale", () => {
    expect(wtStateEffects(room(), room({ epoch: 2 }), "pause", "a", "b").toasts).toEqual([{ kind: "info", key: "pausedBy", params: { name: "A" } }]);
    expect(wtStateEffects(room(), room({ epoch: 2 }), "pause", "b", "b").toasts).toEqual([]);
    expect(wtStateEffects(room(), room({ epoch: 2 }), "seek", "a", "b").toasts[0].burstKey).toBe("seek:a");
  });

  it("à mon entrée dans une salle, son premier état sert de référence : aucun avis de changement", () => {
    // Passe croisée du 21/10 : le bureau (a) a été l'hôte de g, l'a quittée par une autre voie —
    // sa séance garde cet état —, puis y revient par l'invitation de l'iPhone (b), hôte depuis.
    const kept = room({ epoch: 47, members: [member("a", { isHost: true, inPlayback: false }), member("b")] });
    const entry = room({
      epoch: 68, hostUserId: "b", members: [member("b", { isHost: true }), member("a", { inPlayback: false })],
      paused: true, pauseReason: "buffering", waitingForUserIds: ["a"], arrivingUserIds: ["a"],
    });
    expect(wtStateEffects(kept, entry, "join", "a", "a").toasts).toEqual([]);
    // Ensuite, la séance continue : les changements se disent de nouveau.
    const later = room({ ...entry, epoch: 69, members: [...entry.members, member("c")] });
    expect(wtStateEffects(entry, later, "join", "c", "a").toasts.map((t) => t.key)).toEqual(["memberJoined"]);
  });

  it("jamais d'avis entre deux salles différentes, ni d'après une séance où je n'étais pas", () => {
    const old = room({ groupId: "g", hostUserId: "a", members: [member("a"), member("c")] });
    const other = room({ groupId: "h", hostUserId: "b", epoch: 1, members: [member("b"), member("a", { inPlayback: false })] });
    for (const cause of ["join", "presence", "leave"] as const) expect(wtStateEffects(old, other, cause, "b", "a").toasts).toEqual([]);
    const notMine = room({ members: [member("c"), member("d")] });
    expect(wtStateEffects(notMine, room({ epoch: 2, hostUserId: "b" }), "presence", null, "a").toasts).toEqual([]);
  });

  it("un titre lancé est à suivre ; le premier du groupe par tous", () => {
    expect(wtStateEffects(room({ itemId: null }), room({ epoch: 2 }), "setItem", "a", "b").follow).toEqual({ itemId: "film", firstLaunch: true });
    expect(wtStateEffects(room(), room({ itemId: "ep2", epoch: 2 }), "setItem", "a", "b").follow).toEqual({ itemId: "ep2", firstLaunch: false });
    expect(wtStateEffects(room(), room({ epoch: 2 }), "presence", null, "b").follow).toBeNull();
  });
});
