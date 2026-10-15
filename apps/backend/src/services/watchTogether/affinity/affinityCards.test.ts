/**
 * Les cartes d'un participant rejugées à chaque lot (docs/DROITS-UTILISATEURS.md
 * § 9.5.4) : une politique resserrée en cours de séance retire ses titres de la
 * pile, le lot se complète, un titre caché n'est plus redemandé ; un compte
 * libre ne coûte aucune question de plus ; une politique illisible ne laisse
 * rien passer. Vraie séance ; politique et Jellyfin simulés.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ContentPolicy } from "../../contentPolicy";
import type { AffinityCard } from "./affinityTypes";

const policies = new Map<string, Partial<ContentPolicy>>();
vi.mock("../../contentPolicy", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../contentPolicy")>()),
  getContentPolicy: async (userId: string) => policies.get(userId),
}));

/** Ce que Jellyfin cache à chacun ; `onVerdict` : un effet le temps d'un verdict. */
const hidden = new Map<string, Set<string>>();
let onVerdict: (() => void) | null = null;
const isItemVisibleTo = vi.fn(async (userId: string, itemId: string) => {
  onVerdict?.();
  return !hidden.get(userId)?.has(itemId);
});
vi.mock("../../itemAccess/itemVisibility", () => ({ isItemVisibleTo: (u: string, i: string) => isItemVisibleTo(u, i) }));

import { judgedCards } from "./affinityCards";
import { createSession, joinSession, leaveSession, recordVote } from "./affinitySession";

const FREE: Partial<ContentPolicy> = { readable: true, restricted: false, enableAllFolders: true, blockedMediaFolders: [] };
const SIX: Partial<ContentPolicy> = { ...FREE, restricted: true, maxParentalRating: 6 };
const FILMS_ONLY: Partial<ContentPolicy> = { ...FREE, enableAllFolders: false, enabledFolders: ["films"] };
const UNREADABLE: Partial<ContentPolicy> = { readable: false, restricted: true, enableAllFolders: false, blockedMediaFolders: [] };

function card(n: number): AffinityCard {
  return {
    key: `movie:${n}`, mediaType: "movie", tmdbId: n, title: `Titre ${n}`, year: 2020, genres: [], voteAverage: null,
    posterPath: null, backdropPath: null, jellyfinItemId: `it-${n}`, source: "taste", reason: null,
  };
}

function swiping() {
  const session = createSession({ sessionId: 1, kind: "movie", startedBy: "a", deck: [1, 2, 3, 4].map(card), now: 0, audience: ["a", "b"] });
  joinSession(session, "a", null, 0);
  joinSession(session, "b", null, 0);
  return session;
}
const keys = (cards: AffinityCard[]) => cards.map((c) => c.key);
const askedFor = (itemId: string) => isItemVisibleTo.mock.calls.filter(([, id]) => id === itemId).length;

beforeEach(() => {
  policies.clear();
  hidden.clear();
  onVerdict = null;
  isItemVisibleTo.mockClear();
});

describe("affinité — les cartes d'un participant suivent sa politique", () => {
  it("compte libre : la pile telle quelle, sans une question de plus à Jellyfin", async () => {
    policies.set("a", FREE);
    expect(keys(await judgedCards(swiping(), "a", 3, new Set()))).toEqual(["movie:1", "movie:2", "movie:3"]);
    expect(isItemVisibleTo).not.toHaveBeenCalled();
  });

  it("politique resserrée en cours de séance : le titre caché ne part plus, le lot se complète, il n'est plus redemandé", async () => {
    const session = swiping();
    policies.set("a", FREE);
    expect(keys(await judgedCards(session, "a", 2, new Set()))).toEqual(["movie:1", "movie:2"]);

    policies.set("a", SIX);
    hidden.set("a", new Set(["it-2"]));
    expect(keys(await judgedCards(session, "a", 2, new Set()))).toEqual(["movie:1", "movie:3"]);
    expect(keys(await judgedCards(session, "a", 3, new Set(["movie:1"])))).toEqual(["movie:3", "movie:4"]);
    expect(askedFor("it-2")).toBe(1);
    // L'autre participant, libre, garde toute la pile.
    policies.set("b", FREE);
    expect(keys(await judgedCards(session, "b", 4, new Set()))).toEqual(["movie:1", "movie:2", "movie:3", "movie:4"]);
  });

  it("bibliothèques bornées, sans contrôle parental : jugées aussi", async () => {
    policies.set("a", FILMS_ONLY);
    hidden.set("a", new Set(["it-1", "it-3"]));
    expect(keys(await judgedCards(swiping(), "a", 4, new Set()))).toEqual(["movie:2", "movie:4"]);
  });

  it("politique illisible, Jellyfin muet : aucune carte — la pile est finie pour lui", async () => {
    const session = swiping();
    policies.set("a", UNREADABLE);
    hidden.set("a", new Set(["it-1", "it-2", "it-3", "it-4"]));
    expect(await judgedCards(session, "a", 3, new Set())).toEqual([]);
    expect(session.participants.get("a")!.hidden.size).toBe(4);
  });

  it("rouvrir sa pile après une politique rouverte rend les titres", async () => {
    const session = swiping();
    policies.set("a", SIX);
    hidden.set("a", new Set(["it-2"]));
    expect(keys(await judgedCards(session, "a", 4, new Set()))).toEqual(["movie:1", "movie:3", "movie:4"]);
    hidden.clear();
    leaveSession(session, "a", 1);
    joinSession(session, "a", null, 2);
    expect(keys(await judgedCards(session, "a", 4, new Set()))).toEqual(["movie:1", "movie:2", "movie:3", "movie:4"]);
  });

  it("l'ordre est gardé : ce que d'autres ont aimé passe devant", async () => {
    const session = swiping();
    recordVote(session, "b", "movie:4", "like", 1);
    policies.set("a", SIX);
    hidden.set("a", new Set(["it-1"]));
    expect(keys(await judgedCards(session, "a", 2, new Set()))).toEqual(["movie:4", "movie:2"]);
  });

  it("parti pendant le jugement : rien n'est servi, la boucle s'arrête", async () => {
    const session = swiping();
    policies.set("a", SIX);
    hidden.set("a", new Set(["it-1", "it-2", "it-3", "it-4"]));
    onVerdict = () => leaveSession(session, "a", 1);
    expect(await judgedCards(session, "a", 2, new Set())).toEqual([]);
    expect(isItemVisibleTo).toHaveBeenCalledTimes(2);
  });
});
