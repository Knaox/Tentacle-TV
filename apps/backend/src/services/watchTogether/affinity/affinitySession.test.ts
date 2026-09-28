import { describe, expect, it } from "vitest";
import {
  createSession, joinSession, leaveSession, nextCards, promotedFor, recordVote, sessionToDto, undoVote,
} from "./affinitySession";
import type { AffinityCard } from "./affinityTypes";

/**
 * La règle du match et la pile servie à chacun, sans socket ni Jellyfin :
 * unanimité des participants (au moins deux), matchs acquis, dédits, départs,
 * titres déjà aimés par d'autres qui remontent.
 */

function card(n: number, mediaType: "movie" | "tv" = "movie"): AffinityCard {
  return {
    key: `${mediaType}:${n}`,
    mediaType,
    tmdbId: n,
    title: `Titre ${n}`,
    year: 2000 + n,
    genres: [],
    voteAverage: null,
    posterPath: null,
    backdropPath: null,
    jellyfinItemId: `item${n}`,
    source: "taste",
    reason: null,
  };
}

function session(size = 6) {
  const deck = Array.from({ length: size }, (_, i) => card(i + 1));
  return createSession({ sessionId: 1, kind: "movie", startedBy: "a", deck, now: 0 });
}

function withParticipants(ids: string[], size = 6) {
  const s = session(size);
  ids.forEach((id, i) => joinSession(s, id, null, i));
  return s;
}

describe("affinité — la règle du match", () => {
  it("deux participants qui aiment le même titre font un match", () => {
    const s = withParticipants(["a", "b"]);
    expect(recordVote(s, "a", "movie:1", "like", 10).matched).toBe(false);
    expect(recordVote(s, "b", "movie:1", "like", 20).matched).toBe(true);
    const [match] = sessionToDto(s, 1).matches;
    expect(match).toMatchObject({ key: "movie:1", itemId: "item1", likedBy: ["a", "b"], at: 20 });
  });

  it("seul, un participant ne fait jamais de match", () => {
    const s = withParticipants(["a"]);
    expect(recordVote(s, "a", "movie:1", "like", 1).matched).toBe(false);
    expect(s.matches.size).toBe(0);
  });

  it("à trois, il faut les trois : un refus ou un silence bloque", () => {
    const s = withParticipants(["a", "b", "c"]);
    recordVote(s, "a", "movie:2", "like", 1);
    expect(recordVote(s, "b", "movie:2", "like", 2).matched).toBe(false);
    recordVote(s, "c", "movie:3", "dislike", 3);
    recordVote(s, "a", "movie:3", "like", 4);
    expect(recordVote(s, "b", "movie:3", "like", 5).matched).toBe(false);
    expect(recordVote(s, "c", "movie:2", "like", 6).matched).toBe(true);
  });

  it("un match est acquis : un nouveau participant ne le défait pas", () => {
    const s = withParticipants(["a", "b"]);
    recordVote(s, "a", "movie:1", "like", 1);
    recordVote(s, "b", "movie:1", "like", 2);
    joinSession(s, "c", null, 3);
    expect(s.matches.has("movie:1")).toBe(true);
    // … mais les matchs suivants l'attendent.
    recordVote(s, "a", "movie:2", "like", 4);
    expect(recordVote(s, "b", "movie:2", "like", 5).matched).toBe(false);
  });

  it("annuler son j'aime défait le match qu'il portait", () => {
    const s = withParticipants(["a", "b"]);
    recordVote(s, "a", "movie:1", "like", 1);
    recordVote(s, "b", "movie:1", "like", 2);
    expect(undoVote(s, "a", "movie:1").unmatched).toBe(true);
    expect(s.matches.size).toBe(0);
    // Il peut revenir : le match se refait, et s'annonce de nouveau.
    expect(recordVote(s, "a", "movie:1", "like", 3).matched).toBe(true);
  });

  it("changer d'avis (j'aime → refus) défait le match", () => {
    const s = withParticipants(["a", "b"]);
    recordVote(s, "a", "movie:1", "like", 1);
    recordVote(s, "b", "movie:1", "like", 2);
    expect(recordVote(s, "b", "movie:1", "dislike", 3).unmatched).toBe(true);
  });

  it("quand le seul qui manquait s'en va, les restants matchent", () => {
    const s = withParticipants(["a", "b", "c"]);
    recordVote(s, "a", "movie:4", "like", 1);
    recordVote(s, "b", "movie:4", "like", 2);
    recordVote(s, "c", "movie:4", "dislike", 3);
    recordVote(s, "a", "movie:5", "like", 4);
    expect(leaveSession(s, "c", 5)).toEqual(["movie:4"]);
    expect(s.matches.get("movie:4")).toMatchObject({ likedBy: ["a", "b"] });
    // Un départ qui laisse un participant seul ne matche rien.
    expect(leaveSession(s, "b", 6)).toEqual([]);
  });

  it("un vote sur un titre hors pile ou d'un non-participant est ignoré", () => {
    const s = withParticipants(["a", "b"]);
    expect(recordVote(s, "a", "movie:999", "like", 1)).toEqual({ matched: false, unmatched: false });
    expect(recordVote(s, "z", "movie:1", "like", 1)).toEqual({ matched: false, unmatched: false });
    expect(s.participants.get("a")?.votes.size).toBe(0);
  });

  it("les matchs de la séance d'avant survivent à un changement de type", () => {
    const s = withParticipants(["a", "b"]);
    recordVote(s, "a", "movie:1", "like", 1);
    recordVote(s, "b", "movie:1", "like", 2);
    const next = createSession({ sessionId: 2, kind: "series", startedBy: "b", deck: [card(9, "tv")], now: 3, keepMatches: s.matches });
    expect(sessionToDto(next, 7).matches.map((m) => m.title)).toEqual(["Titre 1"]);
  });
});

describe("affinité — la pile servie à chacun", () => {
  it("dans l'ordre commun, sans ce qui est déjà jugé ni tenu par le client", () => {
    const s = withParticipants(["a", "b"]);
    recordVote(s, "a", "movie:1", "dislike", 1);
    const keys = nextCards(s, "a", 3, new Set(["movie:2"])).map((c) => c.key);
    expect(keys).toEqual(["movie:3", "movie:4", "movie:5"]);
  });

  it("ce que d'autres ont aimé passe devant, le plus aimé d'abord", () => {
    const s = withParticipants(["a", "b", "c"]);
    recordVote(s, "b", "movie:5", "like", 1);
    recordVote(s, "b", "movie:6", "like", 2);
    recordVote(s, "c", "movie:6", "like", 3);
    expect(promotedFor(s, s.participants.get("a")!)).toEqual(["movie:6", "movie:5"]);
    expect(nextCards(s, "a", 4, new Set()).map((c) => c.key)).toEqual(["movie:6", "movie:5", "movie:1", "movie:2"]);
  });

  it("jamais un match, jamais ce qu'on a déjà jugé", () => {
    const s = withParticipants(["a", "b"], 3);
    recordVote(s, "a", "movie:1", "dislike", 1);
    recordVote(s, "a", "movie:2", "like", 2);
    recordVote(s, "b", "movie:2", "like", 3);
    expect(nextCards(s, "a", 10, new Set()).map((c) => c.key)).toEqual(["movie:3"]);
    expect(nextCards(s, "b", 10, new Set()).map((c) => c.key)).toEqual(["movie:1", "movie:3"]);
  });

  it("un participant arrivé après ne voit que ce qu'il peut lire", () => {
    const s = withParticipants(["a", "b"]);
    joinSession(s, "c", new Set(["movie:2", "movie:4"]), 5);
    expect(nextCards(s, "c", 10, new Set()).map((c) => c.key)).toEqual(["movie:2", "movie:4"]);
  });

  it("l'état diffusé : participants par ancienneté, avec ce qu'ils ont jugé", () => {
    const s = withParticipants(["b", "a"]);
    recordVote(s, "a", "movie:1", "dislike", 1);
    recordVote(s, "a", "movie:2", "like", 2);
    const dto = sessionToDto(s, 42);
    expect(dto).toMatchObject({ sessionId: 1, seq: 42, kind: "movie", deckSize: 6, matches: [] });
    expect(dto.participants).toEqual([
      { userId: "b", judged: 0, joinedAt: 0 },
      { userId: "a", judged: 2, joinedAt: 1 },
    ]);
    expect(dto.launch).toBeUndefined();
  });
});
