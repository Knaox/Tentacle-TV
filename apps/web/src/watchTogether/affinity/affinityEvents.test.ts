import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WtAffinityMatchDto, WtAffinityMessage, WtAffinityStateDto } from "@tentacle-tv/shared";

const closeRoomModal = vi.fn();
vi.mock("../roomModalStore", () => ({ closeRoomModal: () => closeRoomModal() }));

import { handleAffinityMessage, reconcileAffinity, type AffinityEventContext } from "./affinityEvents";
import {
  affinityFetchMark, applyAffinityFetch, applyAffinityPush, clearAffinityNotice, consumeLaunchFollow,
  getAffinitySnapshot, openAffinity, resetAffinity,
} from "./affinityStore";

/**
 * Ce qu'un `wt:affinity` change à l'écran, en mode PARTAGÉ : lancée par
 * l'autre, elle s'ouvre chez moi (sauf devant un film) ; écartée, défaite ou
 * quittée à trois, on le dit dans la modale ; refermée (quittée à deux, match
 * lancé, salle trop petite), elle se ferme chez tous avec la raison ; un
 * match lancé par l'autre m'emmène si je swipais. Et la relecture de l'état.
 */

function state(seq: number, extra: Partial<WtAffinityStateDto> = {}): WtAffinityStateDto {
  return {
    sessionId: 1, seq, kind: "movie", startedBy: "a", startedAt: 0, deckSize: 10,
    participants: [{ userId: "a", judged: 0, joinedAt: 0 }, { userId: "me", judged: 0, joinedAt: 1 }],
    proposals: [], ...extra,
  };
}

const match = (key: string): WtAffinityMatchDto => ({
  key, itemId: `it-${key}`, mediaType: "movie", title: `Titre ${key}`, year: 2020, likedBy: ["a", "me"], at: 1,
});

function msg(cause: WtAffinityMessage["cause"], s: WtAffinityStateDto | null, extra: Partial<WtAffinityMessage> = {}): WtAffinityMessage {
  return { type: "wt:affinity", state: s, cause, originUserId: "a", ...extra };
}

let toasts: string[];
let watching: boolean;
const ctx: AffinityEventContext = {
  selfId: "me",
  nameOf: (id) => (id === "a" ? "Alice" : ""),
  toast: (_type, message) => toasts.push(message),
  t: (key, opts) => (opts ? `${key}:${JSON.stringify(opts)}` : key),
  isWatching: () => watching,
};

const notice = () => getAffinitySnapshot().notice?.text ?? null;

beforeEach(() => {
  resetAffinity();
  closeRoomModal.mockClear();
  toasts = [];
  watching = false;
});

describe("affinité — messages du socket", () => {
  it("écarte un état plus vieux, et une lecture REST dépassée par le socket", () => {
    handleAffinityMessage(msg("vote", state(5)), ctx);
    handleAffinityMessage(msg("vote", state(4, { deckSize: 99 })), ctx);
    expect(getAffinitySnapshot().state?.seq).toBe(5);
    const mark = affinityFetchMark();
    handleAffinityMessage(msg("vote", state(6)), ctx);
    expect(applyAffinityFetch(null, mark)).toBe(false);
    expect(getAffinitySnapshot().state?.seq).toBe(6);
  });

  it("lancée par l'autre, elle s'ouvre chez moi sur la pile — par-dessus la salle — et le dit", () => {
    handleAffinityMessage(msg("start", state(1)), ctx);
    expect(getAffinitySnapshot().modal).toEqual({ open: true, view: "deck" });
    expect(closeRoomModal).toHaveBeenCalledTimes(1);
    expect(notice()).toContain("affinityStartedBy");
    expect(toasts).toEqual([]);
  });

  it("devant un film, elle ne s'ouvre pas : un toast suffit", () => {
    watching = true;
    handleAffinityMessage(msg("start", state(1)), ctx);
    expect(getAffinitySnapshot().modal.open).toBe(false);
    expect(toasts[0]).toContain("affinityStartedBy");
  });

  it("je choisissais un type, l'autre en change : je rejoins sa pile", () => {
    openAffinity("kinds");
    handleAffinityMessage(msg("switch", state(1, { kind: "series" })), ctx);
    expect(getAffinitySnapshot().modal.view).toBe("deck");
    expect(notice()).toContain("affinitySwitchedBy");
  });

  it("à deux, l'autre quitte : la modale se ferme chez moi, avec la raison", () => {
    handleAffinityMessage(msg("start", state(1)), ctx);
    handleAffinityMessage(msg("quit", null), ctx);
    expect(getAffinitySnapshot()).toMatchObject({ state: null, modal: { open: false }, notice: null });
    expect(toasts).toEqual(['affinityQuitBy:{"name":"Alice"}']);
  });

  it("à trois, un départ se dit dans la modale, et la pile continue", () => {
    handleAffinityMessage(msg("start", state(1)), ctx);
    handleAffinityMessage(msg("quit", state(2)), ctx);
    expect(getAffinitySnapshot().modal.open).toBe(true);
    expect(notice()).toContain("affinityQuitBy");
  });

  it("« Continuer à swiper » d'un autre, ou un dédit : la pile reprend, et on dit pourquoi", () => {
    handleAffinityMessage(msg("start", state(1)), ctx);
    handleAffinityMessage(msg("match", state(2, { proposals: [match("movie:7")] }), { matchKeys: ["movie:7"] }), ctx);
    expect(toasts).toEqual([]);
    handleAffinityMessage(msg("dismiss", state(3), { match: match("movie:7") }), ctx);
    expect(notice()).toContain('"title":"Titre movie:7"');
    handleAffinityMessage(msg("unmatch", state(4), { match: match("movie:8") }), ctx);
    expect(notice()).toContain("affinityUnmatched");
  });

  it("ma propre réponse ne se raconte pas", () => {
    handleAffinityMessage(msg("start", state(1)), ctx);
    const shown = getAffinitySnapshot().notice!;
    clearAffinityNotice(shown.id);
    handleAffinityMessage({ ...msg("dismiss", state(2), { match: match("movie:7") }), originUserId: "me" }, ctx);
    expect(notice()).toBeNull();
  });

  it("qui ne swipe pas apprend un match par un toast", () => {
    const outsiders = { participants: [{ userId: "a", judged: 1, joinedAt: 0 }, { userId: "b", judged: 1, joinedAt: 0 }] };
    handleAffinityMessage(msg("match", state(2, { ...outsiders, proposals: [match("movie:7")] }), { matchKeys: ["movie:7"] }), ctx);
    expect(toasts).toEqual(["affinityMatchTitle Titre movie:7"]);
  });

  it("un match lancé par l'autre pendant que je swipais : fermé chez moi, et je suivrai", () => {
    handleAffinityMessage(msg("start", state(1)), ctx);
    handleAffinityMessage(msg("launch", null, { match: match("movie:7") }), ctx);
    expect(getAffinitySnapshot().modal.open).toBe(false);
    expect(toasts[0]).toContain("affinityLaunchedBy");
    expect(consumeLaunchFollow()).toBe(true);
    expect(consumeLaunchFollow()).toBe(false);
  });

  it("mon propre lancement ferme ma modale sans rien dire ni suivre", () => {
    applyAffinityPush(state(1));
    openAffinity("deck");
    handleAffinityMessage({ ...msg("launch", null, { match: match("movie:7") }), originUserId: "me" }, ctx);
    expect(getAffinitySnapshot().modal.open).toBe(false);
    expect(toasts).toEqual([]);
    expect(consumeLaunchFollow()).toBe(false);
  });

  it("la salle passe sous deux membres : la modale se ferme", () => {
    handleAffinityMessage(msg("start", state(1)), ctx);
    handleAffinityMessage(msg("end", null, { originUserId: null }), ctx);
    expect(getAffinitySnapshot()).toMatchObject({ state: null, modal: { open: false } });
    expect(toasts).toEqual(["affinityEnded"]);
  });
});

describe("affinité — la relecture de l'état", () => {
  it("participant après un rechargement : la pile se rouvre (pas devant un film)", () => {
    applyAffinityFetch(state(3), affinityFetchMark());
    watching = true;
    reconcileAffinity(ctx);
    expect(getAffinitySnapshot().modal.open).toBe(false);
    watching = false;
    reconcileAffinity(ctx);
    expect(getAffinitySnapshot().modal).toEqual({ open: true, view: "deck" });
  });

  it("non participant : rien ne s'ouvre (la pilule l'invite)", () => {
    applyAffinityFetch(state(3, { participants: [{ userId: "a", judged: 0, joinedAt: 0 }] }), affinityFetchMark());
    reconcileAffinity(ctx);
    expect(getAffinitySnapshot().modal.open).toBe(false);
  });

  it("ma pile ouverte sur une séance disparue pendant une coupure : elle se ferme, et le dit", () => {
    applyAffinityPush(state(1));
    openAffinity("deck");
    applyAffinityFetch(null, affinityFetchMark());
    reconcileAffinity(ctx);
    expect(getAffinitySnapshot().modal.open).toBe(false);
    expect(toasts).toEqual(["affinityClosed"]);
  });
});
