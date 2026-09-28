import { beforeEach, describe, expect, it } from "vitest";
import type { WtAffinityMessage, WtAffinityStateDto } from "@tentacle-tv/shared";
import { handleAffinityMessage, type AffinityEventContext } from "./affinityEvents";
import {
  affinityFetchMark, applyAffinityFetch, consumeLaunchFollow, getAffinitySnapshot, openAffinity, resetAffinity,
  showAffinityView,
} from "./affinityStore";

/**
 * Ce qu'un `wt:affinity` change à l'écran : états périmés écartés, match
 * annoncé (ou simple toast devant un film), dédit, lancement suivi, fin.
 */

function state(seq: number, extra: Partial<WtAffinityStateDto> = {}): WtAffinityStateDto {
  return {
    sessionId: 1, seq, kind: "movie", startedBy: "a", startedAt: 0, deckSize: 10,
    participants: [{ userId: "a", judged: 0, joinedAt: 0 }, { userId: "me", judged: 0, joinedAt: 1 }],
    matches: [], ...extra,
  };
}

const match = (key: string) => ({
  key, itemId: `it-${key}`, mediaType: "movie" as const, title: `Titre ${key}`, year: 2020,
  likedBy: ["a", "me"], superlikedBy: [], at: 1,
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

beforeEach(() => {
  resetAffinity();
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

  it("un match s'annonce par-dessus la pile, et on y revient", () => {
    handleAffinityMessage(msg("start", state(1)), ctx);
    openAffinity("deck");
    handleAffinityMessage(msg("match", state(2, { matches: [match("movie:7")] }), { matchKeys: ["movie:7"] }), ctx);
    expect(getAffinitySnapshot().modal).toMatchObject({ open: true, view: "match", matchKey: "movie:7", returnTo: "deck" });
  });

  it("devant un film, un match n'ouvre rien : un toast suffit", () => {
    watching = true;
    handleAffinityMessage(msg("match", state(2, { matches: [match("movie:7")] }), { matchKeys: ["movie:7"] }), ctx);
    expect(getAffinitySnapshot().modal.open).toBe(false);
    expect(toasts).toEqual(["affinityMatchTitle Titre movie:7"]);
  });

  it("plusieurs matchs d'un coup ouvrent la liste", () => {
    handleAffinityMessage(msg("match", state(2, { matches: [match("movie:7"), match("movie:8")] }), { matchKeys: ["movie:7", "movie:8"] }), ctx);
    expect(getAffinitySnapshot().modal).toMatchObject({ open: true, view: "matches" });
  });

  it("un dédit ferme le match affiché et le dit", () => {
    openAffinity("deck");
    handleAffinityMessage(msg("match", state(2, { matches: [match("movie:7")] }), { matchKeys: ["movie:7"] }), ctx);
    handleAffinityMessage(msg("unmatch", state(3)), ctx);
    expect(getAffinitySnapshot().modal).toMatchObject({ open: true, view: "deck", matchKey: null });
    expect(toasts[0]).toContain("affinityUnmatched");
  });

  it("un match lancé par un autre pendant qu'on swipait : on suivra le lancement", () => {
    openAffinity("deck");
    handleAffinityMessage(msg("launch", state(4, {
      matches: [match("movie:7")],
      launch: { key: "movie:7", itemId: "it-movie:7", byUserId: "a", at: 9 },
    })), ctx);
    expect(getAffinitySnapshot().modal.open).toBe(false);
    expect(toasts[0]).toContain("affinityLaunchedBy");
    expect(consumeLaunchFollow()).toBe(true);
    expect(consumeLaunchFollow()).toBe(false);
  });

  it("son propre lancement ne déclenche rien ; un autre, modale fermée, pas de suivi", () => {
    const launched = state(4, { matches: [match("movie:7")], launch: { key: "movie:7", itemId: "x", byUserId: "me", at: 9 } });
    handleAffinityMessage({ ...msg("launch", launched), originUserId: "me" }, ctx);
    handleAffinityMessage(msg("launch", { ...launched, seq: 5, launch: { ...launched.launch!, byUserId: "a" } }), ctx);
    expect(consumeLaunchFollow()).toBe(false);
    expect(toasts).toHaveLength(1);
  });

  it("lancée par un autre pendant que je choisissais : je rejoins sa pile", () => {
    openAffinity("kinds");
    handleAffinityMessage(msg("start", state(1)), ctx);
    expect(getAffinitySnapshot().modal.view).toBe("deck");
    expect(toasts[0]).toContain("affinityStartedBy");
  });

  it("la séance s'arrête : la modale se ferme", () => {
    handleAffinityMessage(msg("start", state(1)), ctx);
    openAffinity();
    showAffinityView("matches");
    handleAffinityMessage(msg("end", null, { originUserId: null }), ctx);
    expect(getAffinitySnapshot()).toMatchObject({ state: null, modal: { open: false } });
    expect(toasts).toEqual(["affinityEnded"]);
  });
});
