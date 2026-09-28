/**
 * /api/watch-together/affinity de bout en bout : vraie salle en mémoire,
 * vraie logique de séance, auth réelle contre un faux /Users/Me ; le catalogue
 * (bibliothèques, goûts) est simulé, et chaque message du socket est capturé.
 * Le parcours : lancer à deux, rejoindre, voter jusqu'au match, lancer le
 * match, se dédire, changer de type ; et les refus (seul, séance périmée,
 * titre hors pile) ; enfin un départ du groupe qui arrête la séance.
 */

import Fastify from "fastify";
import { ZodError } from "zod";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AffinityCard } from "../services/watchTogether/affinity/affinityTypes";

const sent: Array<{ to: string; msg: { type: string; cause?: string; matchKeys?: string[]; state?: unknown } }> = [];

vi.mock("../services/configStore", () => ({
  getJellyfinUrl: () => "http://jf.test",
  getJellyfinApiKey: () => "cle-admin",
}));
vi.mock("../services/jwt", () => ({
  verifyImpersonationToken: async () => null,
  verifyDeviceToken: async () => null,
  hashToken: (value: string) => value,
}));
vi.mock("../services/wsManager", () => ({
  sendToUser: (to: string, msg: { type: string }) => sent.push({ to, msg }),
  isUserOnline: () => true,
  onPresenceChange: () => undefined,
}));

function card(key: string): AffinityCard {
  const [mediaType, id] = key.split(":");
  return {
    key, mediaType: mediaType as "movie" | "tv", tmdbId: Number(id), title: `Titre ${key}`, year: 2020,
    genres: [], voteAverage: null, posterPath: null, backdropPath: null, jellyfinItemId: `it-${key}`,
    source: "taste", reason: null,
  };
}
const DECKS: Record<string, AffinityCard[]> = {
  movie: [card("movie:1"), card("movie:2"), card("movie:3")],
  series: [card("tv:7")],
  anime: [],
};
vi.mock("../services/watchTogether/affinity/affinityCatalog", () => ({
  loadGroupCatalog: async () => ({ members: [], entries: [], animeKeys: new Set() }),
  catalogKindCounts: () => ({ movie: 3, series: 1, anime: 0 }),
  catalogDeck: (_catalog: unknown, kind: string) => DECKS[kind],
  readableKeys: async () => new Set(["movie:2"]),
}));

import { watchTogetherAffinityRoutes } from "./watchTogetherAffinity";
import { addMember, createRoom, onMemberRemoved } from "../services/watchTogether/roomStore";
import { removeMemberAndSync } from "../services/watchTogether/sync";
import { handleAffinityMemberRemoved } from "../services/watchTogether/affinity/affinityService";

const USERS: Record<string, { Id: string; Name: string }> = {
  "jeton-a": { Id: "a", Name: "Alice" },
  "jeton-b": { Id: "b", Name: "Bob" },
  "jeton-c": { Id: "c", Name: "Chloé" },
};
const unplug = onMemberRemoved(handleAffinityMemberRemoved);

beforeEach(() => {
  sent.length = 0;
  vi.stubGlobal("fetch", vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    const token = (init?.headers as Record<string, string> | undefined)?.["X-Emby-Token"] ?? "";
    const found = USERS[token];
    return found ? Response.json({ ...found, Policy: { IsAdministrator: false } }) : new Response("{}", { status: 401 });
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  for (const id of ["a", "b", "c"]) removeMemberAndSync(id);
});

async function makeApp() {
  const app = Fastify();
  app.setErrorHandler((err: unknown, _req, reply) => {
    if (err instanceof ZodError) return reply.status(400).send({ message: "Validation error" });
    return reply.status(500).send({ message: err instanceof Error ? err.message : "Erreur" });
  });
  await app.register(watchTogetherAffinityRoutes, { prefix: "/api/watch-together" });
  return app;
}

const as = (who: "a" | "b" | "c") => ({ "x-emby-token": `jeton-${who}` });

function roomOf(ids: string[]) {
  const room = createRoom({ userId: ids[0], username: ids[0], hasAvatar: false }, null)!;
  for (const id of ids.slice(1)) addMember(room, { userId: id, username: id, hasAvatar: false });
  return room;
}

describe("/api/watch-together/affinity", () => {
  it("le parcours à deux : lancer, rejoindre, matcher, lancer le match", async () => {
    roomOf(["a", "b"]);
    const app = await makeApp();

    const kinds = await app.inject({ method: "GET", url: "/api/watch-together/affinity/kinds", headers: as("a") });
    expect(kinds.json()).toEqual({ counts: { movie: 3, series: 1, anime: 0 } });

    const start = await app.inject({ method: "POST", url: "/api/watch-together/affinity", headers: as("a"), payload: { kind: "movie" } });
    const { state } = start.json();
    expect(state).toMatchObject({ kind: "movie", startedBy: "a", deckSize: 3, participants: [{ userId: "a", judged: 0 }] });
    // Toute la salle l'apprend, pas seulement le lanceur.
    expect(sent.filter((s) => s.msg.cause === "start").map((s) => s.to).sort()).toEqual(["a", "b"]);

    const join = await app.inject({ method: "POST", url: "/api/watch-together/affinity/join", headers: as("b"), payload: {} });
    expect(join.json().cards.map((c: AffinityCard) => c.key)).toEqual(["movie:1", "movie:2", "movie:3"]);
    const sid = join.json().sessionId as number;

    const vote = (who: "a" | "b", key: string, verdict: string) =>
      app.inject({ method: "POST", url: "/api/watch-together/affinity/votes", headers: as(who), payload: { sessionId: sid, key, verdict } });
    expect((await vote("a", "movie:2", "like")).json()).toEqual({ matched: false });
    // Ce que « a » aime passe devant chez « b ».
    const cards = await app.inject({ method: "GET", url: `/api/watch-together/affinity/cards?sessionId=${sid}&limit=2`, headers: as("b") });
    expect(cards.json().cards.map((c: AffinityCard) => c.key)).toEqual(["movie:2", "movie:1"]);

    sent.length = 0;
    expect((await vote("b", "movie:2", "superlike")).json()).toEqual({ matched: true });
    const matchMsg = sent.find((s) => s.to === "a")!.msg;
    expect(matchMsg).toMatchObject({ type: "wt:affinity", cause: "match", matchKeys: ["movie:2"] });
    expect((matchMsg.state as { matches: unknown[] }).matches).toEqual([
      expect.objectContaining({ key: "movie:2", itemId: "it-movie:2", likedBy: ["a", "b"], superlikedBy: ["b"] }),
    ]);

    const launch = await app.inject({ method: "POST", url: "/api/watch-together/affinity/launch", headers: as("a"), payload: { key: "movie:2" } });
    expect(launch.json()).toEqual({ ok: true });
    expect(sent.at(-1)!.msg).toMatchObject({ cause: "launch", state: { launch: { key: "movie:2", itemId: "it-movie:2", byUserId: "a" } } });

    // Se dédire défait le match.
    const undo = await app.inject({ method: "DELETE", url: `/api/watch-together/affinity/votes/movie:2?sessionId=${sid}`, headers: as("b") });
    expect(undo.json()).toEqual({ ok: true });
    expect(sent.at(-1)!.msg.cause).toBe("unmatch");
    await app.close();
  });

  it("changer de type relance la pile, garde les matchs, périme l'ancienne séance", async () => {
    roomOf(["a", "b"]);
    const app = await makeApp();
    await app.inject({ method: "POST", url: "/api/watch-together/affinity", headers: as("a"), payload: { kind: "movie" } });
    const sid = (await app.inject({ method: "POST", url: "/api/watch-together/affinity/join", headers: as("b"), payload: {} })).json().sessionId;
    for (const who of ["a", "b"] as const) {
      await app.inject({ method: "POST", url: "/api/watch-together/affinity/votes", headers: as(who), payload: { sessionId: sid, key: "movie:1", verdict: "like" } });
    }
    const next = await app.inject({ method: "POST", url: "/api/watch-together/affinity", headers: as("b"), payload: { kind: "series" } });
    expect(next.json().state).toMatchObject({ kind: "series", deckSize: 1, matches: [{ key: "movie:1" }] });
    expect(next.json().state.participants.map((p: { userId: string }) => p.userId).sort()).toEqual(["a", "b"]);
    expect(sent.at(-1)!.msg.cause).toBe("switch");
    const stale = await app.inject({ method: "GET", url: `/api/watch-together/affinity/cards?sessionId=${sid}`, headers: as("a") });
    expect(stale.statusCode).toBe(409);
    expect(stale.json()).toEqual({ code: "stale_session" });
    await app.close();
  });

  it("refuse : seul dans la salle, hors salle, type vide, titre hors pile", async () => {
    roomOf(["a"]);
    const app = await makeApp();
    const alone = await app.inject({ method: "POST", url: "/api/watch-together/affinity", headers: as("a"), payload: { kind: "movie" } });
    expect([alone.statusCode, alone.json()]).toEqual([409, { code: "need_two_members" }]);
    const outside = await app.inject({ method: "GET", url: "/api/watch-together/affinity/kinds", headers: as("c") });
    expect([outside.statusCode, outside.json()]).toEqual([404, { code: "not_in_group" }]);
    expect((await app.inject({ method: "GET", url: "/api/watch-together/affinity", headers: as("c") })).json()).toEqual({ state: null });

    removeMemberAndSync("a");
    roomOf(["a", "b"]);
    const empty = await app.inject({ method: "POST", url: "/api/watch-together/affinity", headers: as("a"), payload: { kind: "anime" } });
    expect([empty.statusCode, empty.json()]).toEqual([409, { code: "empty_catalog" }]);
    const bad = await app.inject({ method: "POST", url: "/api/watch-together/affinity", headers: as("a"), payload: { kind: "music" } });
    expect(bad.statusCode).toBe(400);

    const sid = (await app.inject({ method: "POST", url: "/api/watch-together/affinity", headers: as("a"), payload: { kind: "movie" } })).json().state.sessionId;
    const unknown = await app.inject({ method: "POST", url: "/api/watch-together/affinity/votes", headers: as("a"), payload: { sessionId: sid, key: "movie:999", verdict: "like" } });
    expect([unknown.statusCode, unknown.json()]).toEqual([404, { code: "unknown_title" }]);
    const notYet = await app.inject({ method: "POST", url: "/api/watch-together/affinity/votes", headers: as("b"), payload: { sessionId: sid, key: "movie:1", verdict: "like" } });
    expect([notYet.statusCode, notYet.json()]).toEqual([409, { code: "not_participant" }]);
    await app.close();
  });

  it("un membre arrivé après le lancement ne voit que ce qu'il peut lire", async () => {
    const room = roomOf(["a", "b"]);
    const app = await makeApp();
    await app.inject({ method: "POST", url: "/api/watch-together/affinity", headers: as("a"), payload: { kind: "movie" } });
    addMember(room, { userId: "c", username: "c", hasAvatar: false });
    const join = await app.inject({ method: "POST", url: "/api/watch-together/affinity/join", headers: as("c"), payload: {} });
    expect(join.json().cards.map((c: AffinityCard) => c.key)).toEqual(["movie:2"]);
    await app.close();
  });

  it("un départ qui laisse la salle à un seul membre arrête la séance", async () => {
    roomOf(["a", "b"]);
    const app = await makeApp();
    await app.inject({ method: "POST", url: "/api/watch-together/affinity", headers: as("a"), payload: { kind: "movie" } });
    sent.length = 0;
    removeMemberAndSync("b");
    expect(sent).toEqual([{ to: "a", msg: expect.objectContaining({ type: "wt:affinity", state: null, cause: "end" }) }]);
    expect((await app.inject({ method: "GET", url: "/api/watch-together/affinity", headers: as("a") })).json()).toEqual({ state: null });
    await app.close();
  });
});

afterAll(() => unplug());
