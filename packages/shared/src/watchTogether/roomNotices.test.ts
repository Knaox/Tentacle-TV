import { describe, expect, it } from "vitest";
import type { WtMemberDto, WtRoomStateDto } from "../types/watchTogether";
import { wtStateEffects } from "./roomState";
import { waitingNotice } from "./ui/roomModel";
import fr from "../i18n/locales/fr/watchTogether";
import en from "../i18n/locales/en/watchTogether";

/**
 * Les messages d'arrivée et de départ de la LECTURE (retour de Damien du
 * 20/10) : ce que chaque autre appareil dit — l'iPhone d'Alice (propriétaire),
 * le web de Chloé (membre) — quand Bob arrive, renonce ou s'en va.
 */

const member = (userId: string, patch: Partial<WtMemberDto> = {}): WtMemberDto => ({
  userId, username: userId.toUpperCase(), hasAvatar: false, online: true, inPlayback: true, buffering: false,
  playbackError: false, isHost: userId === "a", joinedAt: 0, ...patch,
});
const room = (patch: Partial<WtRoomStateDto> = {}): WtRoomStateDto => ({
  groupId: "g", hostUserId: "a", epoch: 1, itemId: "film", paused: false, positionTicks: 0,
  stateAtServerTime: 0, pauseReason: null, waitingForUserIds: [], members: [member("a"), member("b"), member("c")],
  ...patch,
});
const keys = (prev: WtRoomStateDto, next: WtRoomStateDto, cause: Parameters<typeof wtStateEffects>[2], selfId: string) =>
  wtStateEffects(prev, next, cause, null, selfId).toasts.map((t) => `${t.key}:${t.params?.name ?? ""}`);

const bobAway = [member("a"), member("b", { inPlayback: false }), member("c")];
const frozenForBob = { paused: true, pauseReason: "buffering" as const, waitingForUserIds: ["b"], arrivingUserIds: ["b"] };

describe("départ de la lecture — chaque autre appareil le dit", () => {
  it("Bob ferme son lecteur : « Bob a quitté la lecture » chez le propriétaire ET chez l'autre membre", () => {
    const next = room({ epoch: 2, members: bobAway });
    for (const self of ["a", "c"]) expect(keys(room(), next, "presence", self)).toEqual(["memberLeftPlayback:B"]);
    // Jamais pour soi (un autre appareil du même compte n'est pas « quelqu'un »).
    expect(keys(room(), next, "presence", "b")).toEqual([]);
  });

  it("le propriétaire ferme son lecteur : les membres le disent", () => {
    const next = room({ epoch: 2, members: [member("a", { inPlayback: false }), member("b"), member("c")] });
    expect(keys(room(), next, "presence", "b")).toEqual(["memberLeftPlayback:A"]);
  });

  it("appli tuée : le socket fermé (hors lecture, puis hors ligne) ne le dit qu'une fois", () => {
    const closed = room({ epoch: 2, members: bobAway });
    const offline = room({ epoch: 3, members: [member("a"), member("b", { inPlayback: false, online: false }), member("c")] });
    expect(keys(room(), closed, "presence", "a")).toEqual(["memberLeftPlayback:B"]);
    expect(keys(closed, offline, "presence", "a")).toEqual([]);
  });

  it("rien au changement de titre (tout le monde recharge), rien sur un échec (« ne peut pas lire »)", () => {
    const relaunch = room({ epoch: 2, itemId: "ep2", members: [member("a", { inPlayback: false }), member("b", { inPlayback: false }), member("c", { inPlayback: false })] });
    expect(keys(room(), relaunch, "setItem", "a")).not.toContain("memberLeftPlayback:B");
    const failed = room({ epoch: 2, members: [member("a"), member("b", { inPlayback: false, playbackError: true }), member("c")] });
    expect(keys(room(), failed, "presence", "a")).toEqual(["memberCantPlay:B"]);
  });

  it("quitter le GROUPE garde son message ; le propriétaire parti, l'hôte passé est dit", () => {
    const next = room({ epoch: 2, hostUserId: "b", members: [member("b", { isHost: true }), member("c")] });
    expect(keys(room(), next, "leave", "c")).toEqual(["memberLeft:A", "hostTransferred:B"]);
  });
});

describe("arrivée dans la lecture", () => {
  it("Bob, déjà du groupe, rejoint la lecture : la salle se gèle et chacun le dit", () => {
    expect(keys(room({ members: bobAway }), room({ epoch: 2, members: bobAway, ...frozenForBob }), "buffering", "a"))
      .toEqual(["memberArriving:B"]);
  });

  it("un NOUVEAU membre qui arrive : « a rejoint le groupe », une fois", () => {
    const prev = room({ members: [member("a"), member("c")] });
    expect(keys(prev, room({ epoch: 2, members: bobAway, ...frozenForBob }), "join", "c")).toEqual(["memberJoined:B"]);
  });

  it("arrivé : rien de plus ; renoncé (retour, appli tuée, délai) : « n'a pas rejoint la lecture »", () => {
    const waiting = room({ epoch: 2, members: [member("a"), member("b", { buffering: true }), member("c")], ...frozenForBob });
    expect(keys(waiting, room({ epoch: 3 }), "schedule", "a")).toEqual([]);
    expect(keys(waiting, room({ epoch: 3, members: bobAway }), "schedule", "a")).toEqual(["memberArrivalCancelled:B"]);
  });

  it("le voile du lecteur dit qui on attend : « En attente de Bob… », puis « met en mémoire tampon » une fois qu'il charge sans arriver", () => {
    expect(waitingNotice(room({ members: bobAway, ...frozenForBob }), "a")).toEqual({ key: "waitingForMember", params: { name: "B" } });
    expect(waitingNotice(room({ ...frozenForBob, arrivingUserIds: undefined }), "a")).toEqual({ key: "memberBuffering", params: { name: "B" } });
  });
});

describe("les mots existent dans les deux langues", () => {
  it.each(["memberArriving", "memberArrivalCancelled", "memberLeftPlayback", "waitingForMember"])("%s", (key) => {
    for (const locale of [fr, en] as Array<Record<string, string>>) expect(locale[key]).toContain("{{name}}");
  });
});
