/**
 * L'affinité face aux droits des membres (docs/DROITS-UTILISATEURS.md § 9.5.4) :
 * une proposition ne part que si TOUTE la salle voit son titre — au socket
 * comme en REST, comme match qui arrive, écarté ou lancé. Vraie salle, vraie
 * séance ; Jellyfin simulé par ce que chaque compte ne voit pas.
 */

import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import type { AffinityCard } from "./affinityTypes";

type Sent = {
  cause: string;
  state: { seq: number; proposals: Array<{ key: string }> } | null;
  matchKeys?: string[];
  match?: { key: string };
};
const sent: Array<{ to: string; msg: Sent }> = [];

vi.mock("../../wsManager", () => ({
  sendToUser: (to: string, msg: Sent) => sent.push({ to, msg }),
  isUserOnline: () => true,
  onPresenceChange: () => undefined,
}));

/** Jellyfin simulé : les titres que chaque compte ne voit pas, les comptes dont
 *  la politique ne se lit pas (fermé à l'échec), et une attente à volonté. */
const hidden = new Map<string, Set<string>>();
const unreadable = new Set<string>();
let jellyfinGate: Promise<void> | null = null;
vi.mock("../../itemAccess/itemVisibility", () => ({
  isItemVisibleTo: async (userId: string, itemId: string) => {
    if (jellyfinGate) await jellyfinGate;
    return !unreadable.has(userId) && !hidden.get(userId)?.has(itemId);
  },
}));

function card(key: string): AffinityCard {
  const [mediaType, id] = key.split(":");
  return {
    key, mediaType: mediaType as "movie" | "tv", tmdbId: Number(id), title: `Titre ${key}`, year: 2020,
    genres: [], voteAverage: null, posterPath: null, backdropPath: null, jellyfinItemId: `it-${key}`,
    source: "taste", reason: null,
  };
}
vi.mock("./affinityCatalog", () => ({
  loadGroupCatalog: async () => ({ members: [], entries: [], animeKeys: new Set() }),
  catalogKindCounts: () => ({ movie: 3, series: 0, anime: 0 }),
  catalogDeck: () => [card("movie:1"), card("movie:2"), card("movie:3")],
  // Un membre arrivé après le lancement : sa bibliothèque n'a pas movie:1.
  readableKeys: async () => new Set(["movie:2", "movie:3"]),
}));

import { addMember, createRoom, onMemberRemoved } from "../roomStore";
import { removeMemberAndSync } from "../sync";
import {
  currentAffinity, dismissAffinityMatch, handleAffinityMemberRemoved, joinAffinity, launchAffinity, quitAffinity,
  startAffinity, voteAffinity,
} from "./affinityService";

const unplug = onMemberRemoved(handleAffinityMemberRemoved);
const flush = () => new Promise((resolve) => setImmediate(resolve));
/** Ce que reçoit le compte — en texte : rien de caché ne doit y paraître, ni id ni titre. */
const received = (userId: string) => sent.filter((s) => s.to === userId).map((s) => JSON.stringify(s.msg)).join("\n");
const proposalsOf = async (userId: string) => (await currentAffinity(userId))?.proposals.map((m) => m.key);

afterEach(() => {
  for (const id of ["a", "b", "c"]) removeMemberAndSync(id);
  sent.length = 0;
  hidden.clear();
  unreadable.clear();
  jellyfinGate = null;
});
afterAll(() => unplug());

/** « a » et « b » swipent ensemble ; rend l'identifiant de la séance. */
async function swiping(ids: Array<"a" | "b" | "c">): Promise<{ room: ReturnType<typeof createRoom>; sid: number }> {
  const room = createRoom({ userId: ids[0], username: ids[0], hasAvatar: false }, null)!;
  for (const id of ids.slice(1)) addMember(room, { userId: id, username: id, hasAvatar: false });
  const started = await startAffinity("a", "movie");
  if (!started.ok) throw new Error(started.code);
  await joinAffinity("b", 10);
  return { room, sid: started.value.sessionId };
}

async function match(sid: number, key: string): Promise<boolean> {
  await voteAffinity("a", sid, key, "like");
  const voted = await voteAffinity("b", sid, key, "like");
  return voted.ok && voted.value.matched;
}

describe("affinité — une proposition ne part que si toute la salle voit le titre", () => {
  it("salon mixte : le membre arrivé après les matchs ne reçoit que le titre permis, et le titre caché ne se lance pas", async () => {
    const { room, sid } = await swiping(["a", "b"]);
    expect(await match(sid, "movie:1")).toBe(true);
    expect(await match(sid, "movie:2")).toBe(true);

    hidden.set("c", new Set(["it-movie:1"]));
    addMember(room!, { userId: "c", username: "c", hasAvatar: false });
    sent.length = 0;
    // L'état est LE MÊME pour toute la salle : movie:1 n'est plus proposé à personne.
    for (const id of ["a", "b", "c"]) expect(await proposalsOf(id)).toEqual(["movie:2"]);
    const joined = await joinAffinity("c", 10);
    expect(joined.ok && joined.value.state.proposals.map((m) => m.key)).toEqual(["movie:2"]);
    expect(joined.ok && joined.value.cards.map((c) => c.key)).toEqual(["movie:3"]);

    await voteAffinity("a", sid, "movie:3", "dislike");
    // « Regarder ensemble » sur un titre que « c » ne voit pas : refusé, et la salle reçoit l'état qui ne le propose plus.
    expect(await launchAffinity("a", "movie:1")).toEqual({ ok: false, status: 409, code: "answered" });
    await flush();
    expect(sent.filter((s) => s.to === "a").map((s) => s.msg.cause)).toEqual(["join", "vote", "unmatch"]);
    expect(sent.every((s) => s.msg.state?.proposals.map((m) => m.key).join() === "movie:2")).toBe(true);
    expect(received("c")).not.toMatch(/movie:1/);
    expect(await currentAffinity("a")).not.toBeNull();

    // « c » parti, la proposition gardée revient — et se lance.
    removeMemberAndSync("c");
    expect(await proposalsOf("a")).toEqual(["movie:1", "movie:2"]);
    expect(await launchAffinity("a", "movie:1")).toEqual({ ok: true, value: null });
    await flush();
    expect(sent.at(-1)!.msg).toMatchObject({ cause: "launch", state: null, match: { key: "movie:1" } });
  });

  it("un match que la salle ne voit pas en entier n'est annoncé à personne, pas même à l'auteur du vote", async () => {
    const { room, sid } = await swiping(["a", "b"]);
    hidden.set("c", new Set(["it-movie:1"]));
    addMember(room!, { userId: "c", username: "c", hasAvatar: false });
    sent.length = 0;
    await voteAffinity("a", sid, "movie:1", "like");
    const voted = await voteAffinity("b", sid, "movie:1", "like");
    expect(voted).toMatchObject({ ok: true, value: { matched: false, state: { proposals: [] } } });
    await flush();
    const announced = sent.filter((s) => s.msg.cause === "match");
    expect(announced.map((s) => s.to)).toEqual(["a", "b", "c"]);
    expect(announced.every((s) => s.msg.matchKeys === undefined && s.msg.state!.proposals.length === 0)).toBe(true);
    // Écarté par un participant : le match parti n'est pas nommé non plus.
    sent.length = 0;
    await dismissAffinityMatch("b", "movie:1");
    await flush();
    expect(sent.map((s) => [s.to, s.msg.cause, s.msg.match])).toEqual([["a", "dismiss", undefined], ["b", "dismiss", undefined], ["c", "dismiss", undefined]]);
    expect(received("c")).not.toMatch(/movie:1/);
  });

  it("politique illisible d'un membre : aucune proposition ne sort, rien ne se lance ; Jellyfin revenu, elles reviennent", async () => {
    const { room, sid } = await swiping(["a", "b"]);
    expect(await match(sid, "movie:2")).toBe(true);
    unreadable.add("c");
    addMember(room!, { userId: "c", username: "c", hasAvatar: false });
    sent.length = 0;
    expect(await proposalsOf("c")).toEqual([]);
    expect(await proposalsOf("a")).toEqual([]);
    expect(await launchAffinity("b", "movie:2")).toEqual({ ok: false, status: 409, code: "answered" });
    await voteAffinity("a", sid, "movie:3", "like");
    await flush();
    expect(sent.length).toBeGreaterThan(0);
    expect(received("c")).not.toMatch(/movie:2/);

    unreadable.delete("c");
    expect(await proposalsOf("c")).toEqual(["movie:2"]);
  });

  it("changement de politique en cours de salon : le titre devenu caché ne part plus, ni ne se lance", async () => {
    const { sid } = await swiping(["a", "b"]);
    expect(await match(sid, "movie:2")).toBe(true);
    expect(await proposalsOf("b")).toEqual(["movie:2"]);

    // La politique de « b » se resserre (verdicts de Jellyfin renouvelés).
    hidden.set("b", new Set(["it-movie:2"]));
    sent.length = 0;
    expect(await proposalsOf("b")).toEqual([]);
    await voteAffinity("a", sid, "movie:3", "dislike");
    expect(await launchAffinity("a", "movie:2")).toEqual({ ok: false, status: 409, code: "answered" });
    await flush();
    expect(received("b")).not.toMatch(/movie:2/);
    expect(received("a")).not.toMatch(/movie:2/);

    // Rouverte : la proposition, gardée dans la séance, revient.
    hidden.clear();
    expect(await proposalsOf("b")).toEqual(["movie:2"]);
  });

  it("les états partent dans l'ordre de leur seq, même quand Jellyfin tarde à juger", async () => {
    const { sid } = await swiping(["a", "b"]);
    expect(await match(sid, "movie:2")).toBe(true);
    await flush();
    sent.length = 0;
    let release!: () => void;
    jellyfinGate = new Promise<void>((resolve) => (release = resolve));
    const voting = voteAffinity("a", sid, "movie:3", "dislike");
    // À deux, quitter referme la séance : un état sans proposition, qui n'a rien à juger.
    quitAffinity("b");
    expect(sent).toEqual([]);
    release();
    await voting;
    await flush();
    const toA = sent.filter((s) => s.to === "a").map((s) => s.msg);
    expect(toA.map((m) => m.cause)).toEqual(["vote", "quit"]);
    expect(toA[0].state!.proposals.map((m) => m.key)).toEqual(["movie:2"]);
    expect(toA[1].state).toBeNull();
  });
});
