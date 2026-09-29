/**
 * /api/watch-together/affinity de bout en bout : vraie salle en mémoire,
 * vraie logique de séance, auth réelle contre un faux /Users/Me ; le catalogue
 * (bibliothèques, goûts) est simulé, et chaque message du socket est capturé.
 * Le mode PARTAGÉ : lancer l'annonce à toute la salle, un match se propose à
 * tous et la première réponse vaut pour tous (écarter, lancer), quitter à deux
 * referme chez l'autre, à trois les autres continuent, relancer reprend. Et
 * les refus : seul, hors salle, type vide, titre hors pile, verdicts retirés.
 */

import Fastify from "fastify";
import { ZodError } from "zod";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { modernJellyfinToken } from "../../test/jellyfinFakeAuth";
import type { AffinityCard } from "../services/watchTogether/affinity/affinityTypes";

type Sent = { type: string; cause?: string; matchKeys?: string[]; state?: unknown; match?: { key: string } };
const sent: Array<{ to: string; msg: Sent }> = [];

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
  sendToUser: (to: string, msg: Sent) => sent.push({ to, msg }),
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
    const token = modernJellyfinToken(init?.headers);
    const found = USERS[token];
    return found ? Response.json({ ...found, Policy: { IsAdministrator: false } }) : new Response("{}", { status: 401 });
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  for (const id of ["a", "b", "c"]) removeMemberAndSync(id);
});

type Who = "a" | "b" | "c";
const BASE = "/api/watch-together/affinity";
const as = (who: Who) => ({ "x-emby-token": `jeton-${who}` });

async function makeApp() {
  const app = Fastify();
  app.setErrorHandler((err: unknown, _req, reply) => {
    if (err instanceof ZodError) return reply.status(400).send({ message: "Validation error" });
    return reply.status(500).send({ message: err instanceof Error ? err.message : "Erreur" });
  });
  await app.register(watchTogetherAffinityRoutes, { prefix: "/api/watch-together" });
  const call = (who: Who, method: "GET" | "POST" | "DELETE", url: string, payload?: object) =>
    app.inject({ method, url: `${BASE}${url}`, headers: as(who), ...(payload ? { payload } : {}) });
  return {
    app,
    call,
    start: (who: Who, kind: string) => call(who, "POST", "", { kind }),
    join: (who: Who) => call(who, "POST", "/join", {}),
    vote: (who: Who, sessionId: number, key: string, verdict: string) =>
      call(who, "POST", "/votes", { sessionId, key, verdict }),
  };
}

function roomOf(ids: Who[]) {
  const room = createRoom({ userId: ids[0], username: ids[0], hasAvatar: false }, null)!;
  for (const id of ids.slice(1)) addMember(room, { userId: id, username: id, hasAvatar: false });
  return room;
}

/** Les destinataires du dernier message de cette cause. */
const lastOf = (cause: string) => sent.filter((s) => s.msg.cause === cause);

describe("/api/watch-together/affinity — le mode partagé", () => {
  it("lancer, matcher, écarter chez tous, puis lancer un match qui referme la séance", async () => {
    roomOf(["a", "b"]);
    const { app, call, start, join, vote } = await makeApp();

    expect((await call("a", "GET", "/kinds")).json()).toEqual({ counts: { movie: 3, series: 1, anime: 0 }, resume: [] });
    const { state } = (await start("a", "movie")).json();
    expect(state).toMatchObject({ kind: "movie", startedBy: "a", deckSize: 3, participants: [{ userId: "a" }], proposals: [] });
    // Toute la salle l'apprend — c'est ce qui l'ouvre chez l'autre.
    expect(lastOf("start").map((s) => s.to).sort()).toEqual(["a", "b"]);

    const joined = (await join("b")).json();
    expect(joined.cards.map((c: AffinityCard) => c.key)).toEqual(["movie:1", "movie:2", "movie:3"]);
    const sid = joined.sessionId as number;

    expect((await vote("a", sid, "movie:2", "like")).json()).toMatchObject({ matched: false });
    // Ce que « a » aime passe devant chez « b ».
    const cards = await call("b", "GET", `/cards?sessionId=${sid}&limit=2`);
    expect(cards.json().cards.map((c: AffinityCard) => c.key)).toEqual(["movie:2", "movie:1"]);

    sent.length = 0;
    const matched = (await vote("b", sid, "movie:2", "like")).json();
    expect(matched).toMatchObject({ matched: true, state: { proposals: [{ key: "movie:2", likedBy: ["a", "b"] }] } });
    expect(lastOf("match").map((s) => [s.to, s.msg.matchKeys])).toEqual([["a", ["movie:2"]], ["b", ["movie:2"]]]);

    // « Continuer à swiper » par « b » : écarté chez les deux, la pile reprend.
    sent.length = 0;
    const dismissed = (await call("b", "POST", "/dismiss", { key: "movie:2" })).json();
    expect(dismissed.state.proposals).toEqual([]);
    expect(lastOf("dismiss").map((s) => [s.to, s.msg.match?.key])).toEqual([["a", "movie:2"], ["b", "movie:2"]]);
    // Deux réponses croisées : la seconde ne trouve plus rien, sans erreur.
    expect((await call("a", "POST", "/dismiss", { key: "movie:2" })).statusCode).toBe(200);
    expect((await call("a", "POST", "/launch", { key: "movie:2" })).json()).toEqual({ code: "answered" });

    await vote("a", sid, "movie:3", "like");
    await vote("b", sid, "movie:3", "like");
    sent.length = 0;
    expect((await call("a", "POST", "/launch", { key: "movie:3" })).json()).toEqual({ ok: true });
    expect(lastOf("launch").map((s) => [s.to, s.msg.state, s.msg.match?.key])).toEqual([
      ["a", null, "movie:3"], ["b", null, "movie:3"],
    ]);
    expect((await call("b", "GET", "")).json()).toEqual({ state: null });
    await app.close();
  });

  it("à deux, quitter referme la séance chez l'autre ; relancer le même type la reprend", async () => {
    roomOf(["a", "b"]);
    const { app, call, start, join, vote } = await makeApp();
    await start("a", "movie");
    const sid = (await join("b")).json().sessionId as number;
    await vote("b", sid, "movie:1", "dislike");
    sent.length = 0;
    expect((await call("a", "POST", "/leave")).json()).toEqual({ ok: true });
    expect(lastOf("quit").map((s) => [s.to, s.msg.state])).toEqual([["a", null], ["b", null]]);
    expect((await call("b", "GET", "")).json()).toEqual({ state: null });
    // Quitter une séance déjà refermée ne fait rien.
    expect((await call("b", "POST", "/leave")).json()).toEqual({ ok: true });

    expect((await call("b", "GET", "/kinds")).json().resume).toEqual(["movie"]);
    const reopened = (await start("b", "movie")).json().state;
    expect(reopened.sessionId).not.toBe(sid);
    expect(reopened).toMatchObject({ startedBy: "b", participants: [{ userId: "b", judged: 1 }] });
    // « b » retrouve ses votes : movie:1 est déjà jugé.
    expect((await join("b")).json().cards.map((c: AffinityCard) => c.key)).toEqual(["movie:2", "movie:3"]);
    await app.close();
  });

  it("à trois, un départ laisse les autres swiper ; sous deux participants, la séance se referme", async () => {
    roomOf(["a", "b", "c"]);
    const { app, call, start, join, vote } = await makeApp();
    await start("a", "movie");
    const sid = (await join("b")).json().sessionId as number;
    await join("c");
    await vote("a", sid, "movie:1", "like");
    await vote("b", sid, "movie:1", "like");
    sent.length = 0;
    // « c » était le seul à manquer : son départ fait le match des restants.
    await call("c", "POST", "/leave");
    const quit = lastOf("quit").find((s) => s.to === "a")!.msg;
    expect(quit).toMatchObject({ matchKeys: ["movie:1"], state: { participants: [{ userId: "a" }, { userId: "b" }] } });
    sent.length = 0;
    await call("b", "POST", "/leave");
    expect(lastOf("quit").map((s) => s.msg.state)).toEqual([null, null, null]);
    await app.close();
  });

  it("changer de type relance la pile, périme l'ancienne séance ; chaque type garde la sienne", async () => {
    roomOf(["a", "b"]);
    const { app, call, start, join, vote } = await makeApp();
    await start("a", "movie");
    const sid = (await join("b")).json().sessionId as number;
    await vote("b", sid, "movie:1", "like");
    const next = (await start("b", "series")).json().state;
    expect(next).toMatchObject({ kind: "series", deckSize: 1, participants: [{ userId: "b" }] });
    expect(sent.at(-1)!.msg.cause).toBe("switch");
    const stale = await call("a", "GET", `/cards?sessionId=${sid}`);
    expect([stale.statusCode, stale.json()]).toEqual([409, { code: "stale_session" }]);
    // Même type que la séance ouverte : rien ne change.
    expect((await start("a", "series")).json().state.sessionId).toBe(next.sessionId);
    // Quitter les séries puis revenir aux films : chaque type a gardé sa séance.
    await join("a");
    await call("a", "POST", "/leave");
    expect((await call("a", "GET", "/kinds")).json().resume.sort()).toEqual(["movie", "series"]);
    const back = (await start("a", "movie")).json().state;
    expect(back.kind).toBe("movie");
    expect((await join("b")).json().cards.map((c: AffinityCard) => c.key)).toEqual(["movie:2", "movie:3"]);
    expect((await call("a", "GET", "/kinds")).json().resume).toEqual(["series"]);
    await app.close();
  });

  it("refuse : seul, hors salle, type vide, titre hors pile, non-participant, verdicts retirés", async () => {
    roomOf(["a"]);
    const { app, call, start, vote } = await makeApp();
    const alone = await start("a", "movie");
    expect([alone.statusCode, alone.json()]).toEqual([409, { code: "need_two_members" }]);
    const outside = await call("c", "GET", "/kinds");
    expect([outside.statusCode, outside.json()]).toEqual([404, { code: "not_in_group" }]);
    expect((await call("c", "GET", "")).json()).toEqual({ state: null });

    removeMemberAndSync("a");
    roomOf(["a", "b"]);
    const empty = await start("a", "anime");
    expect([empty.statusCode, empty.json()]).toEqual([409, { code: "empty_catalog" }]);
    expect((await start("a", "music")).statusCode).toBe(400);

    const sid = (await start("a", "movie")).json().state.sessionId as number;
    const unknown = await vote("a", sid, "movie:999", "like");
    expect([unknown.statusCode, unknown.json()]).toEqual([404, { code: "unknown_title" }]);
    const notYet = await vote("b", sid, "movie:1", "like");
    expect([notYet.statusCode, notYet.json()]).toEqual([409, { code: "not_participant" }]);
    // Ni coup de cœur ni « passer » : deux verdicts, rien d'autre.
    for (const verdict of ["superlike", "skip"]) expect((await vote("a", sid, "movie:1", verdict)).statusCode).toBe(400);
    await app.close();
  });

  it("un membre arrivé après le lancement ne voit que ce qu'il peut lire", async () => {
    const room = roomOf(["a", "b"]);
    const { app, start, join } = await makeApp();
    await start("a", "movie");
    addMember(room, { userId: "c", username: "c", hasAvatar: false });
    expect((await join("c")).json().cards.map((c: AffinityCard) => c.key)).toEqual(["movie:2"]);
    await app.close();
  });

  it("un départ qui laisse la salle à un seul membre arrête la séance", async () => {
    roomOf(["a", "b"]);
    const { app, call, start } = await makeApp();
    await start("a", "movie");
    sent.length = 0;
    removeMemberAndSync("b");
    expect(sent).toEqual([{ to: "a", msg: expect.objectContaining({ type: "wt:affinity", state: null, cause: "end" }) }]);
    expect((await call("a", "GET", "")).json()).toEqual({ state: null });
    await app.close();
  });
});

afterAll(() => unplug());
