import { describe, expect, it } from "vitest";
import {
  closeSession, createSession, joinSession, leaveSession, nextCards, promotedFor, recordVote, reopenSession,
  sessionToDto, settleProposal, undoVote,
} from "./affinitySession";
import type { AffinityCard } from "./affinityTypes";

/**
 * La règle du match et la pile servie à chacun, sans socket ni Jellyfin :
 * unanimité des participants (au moins deux), un match = une proposition
 * faite à tous et tranchée une fois pour toutes, dédits, départs, reprise
 * d'une séance refermée, titres aimés par d'autres qui remontent.
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

const pending = (s: ReturnType<typeof session>) => s.proposals.map((m) => m.key);

describe("affinité — la règle du match", () => {
  it("deux participants qui aiment le même titre font un match, proposé à tous", () => {
    const s = withParticipants(["a", "b"]);
    expect(recordVote(s, "a", "movie:1", "like", 10).matched).toBe(false);
    expect(recordVote(s, "b", "movie:1", "like", 20).matched).toBe(true);
    expect(sessionToDto(s, 1).proposals).toEqual([
      { key: "movie:1", itemId: "item1", mediaType: "movie", title: "Titre 1", year: 2001, likedBy: ["a", "b"], at: 20 },
    ]);
  });

  it("seul, un participant ne fait jamais de match", () => {
    const s = withParticipants(["a"]);
    expect(recordVote(s, "a", "movie:1", "like", 1).matched).toBe(false);
    expect(s.proposals).toEqual([]);
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

  it("deux matchs d'affilée attendent l'un derrière l'autre, le plus ancien d'abord", () => {
    const s = withParticipants(["a", "b"]);
    for (const key of ["movie:4", "movie:2"]) recordVote(s, "a", key, "like", 1);
    recordVote(s, "b", "movie:4", "like", 2);
    recordVote(s, "b", "movie:2", "like", 3);
    expect(pending(s)).toEqual(["movie:4", "movie:2"]);
  });

  it("« Continuer à swiper » écarte le match pour de bon : ni reproposé, ni resservi", () => {
    const s = withParticipants(["a", "b", "c"]);
    for (const who of ["a", "b", "c"]) recordVote(s, who, "movie:1", "like", 1);
    expect(settleProposal(s, "movie:1")?.key).toBe("movie:1");
    // Déjà tranché : une seconde réponse ne trouve plus rien.
    expect(settleProposal(s, "movie:1")).toBeNull();
    // Un dédit puis un nouveau j'aime ne le reproposent pas…
    undoVote(s, "a", "movie:1");
    expect(recordVote(s, "a", "movie:1", "like", 2).matched).toBe(false);
    // … ni le départ de quelqu'un, ni une arrivée : il ne se ressert plus.
    expect(leaveSession(s, "c", 3)).toEqual([]);
    joinSession(s, "d", null, 4);
    expect(nextCards(s, "d", 10, new Set()).map((c) => c.key)).not.toContain("movie:1");
  });

  it("un match en attente tombe quand quelqu'un qui l'aimait se dédit", () => {
    const s = withParticipants(["a", "b"]);
    recordVote(s, "a", "movie:1", "like", 1);
    recordVote(s, "b", "movie:1", "like", 2);
    expect(undoVote(s, "a", "movie:1").unmatched?.key).toBe("movie:1");
    expect(s.proposals).toEqual([]);
    // Il peut revenir : jamais tranché, le match se refait.
    expect(recordVote(s, "a", "movie:1", "like", 3).matched).toBe(true);
    // Changer d'avis (j'aime → pas pour moi) le défait aussi.
    expect(recordVote(s, "b", "movie:1", "dislike", 4).unmatched?.key).toBe("movie:1");
  });

  it("quand le seul qui manquait s'en va, les restants matchent", () => {
    const s = withParticipants(["a", "b", "c"]);
    recordVote(s, "a", "movie:4", "like", 1);
    recordVote(s, "b", "movie:4", "like", 2);
    recordVote(s, "c", "movie:4", "dislike", 3);
    recordVote(s, "a", "movie:5", "like", 4);
    expect(leaveSession(s, "c", 5)).toEqual(["movie:4"]);
    expect(s.proposals[0]).toMatchObject({ key: "movie:4", likedBy: ["a", "b"] });
    // Un départ qui laisse un participant seul ne matche rien.
    expect(leaveSession(s, "b", 6)).toEqual([]);
  });

  it("un vote sur un titre hors pile ou d'un non-participant est ignoré", () => {
    const s = withParticipants(["a", "b"]);
    expect(recordVote(s, "a", "movie:999", "like", 1)).toEqual({ matched: false, unmatched: null });
    expect(recordVote(s, "z", "movie:1", "like", 1)).toEqual({ matched: false, unmatched: null });
    expect(s.ballots.get("a")?.size).toBe(0);
  });
});

describe("affinité — quitter, revenir, reprendre", () => {
  it("quitter l'affinité garde ses votes : revenir les retrouve", () => {
    const s = withParticipants(["a", "b"]);
    recordVote(s, "a", "movie:1", "like", 1);
    recordVote(s, "a", "movie:2", "dislike", 2);
    leaveSession(s, "a", 3);
    joinSession(s, "a", null, 4);
    expect(nextCards(s, "a", 2, new Set()).map((c) => c.key)).toEqual(["movie:3", "movie:4"]);
    expect(recordVote(s, "b", "movie:1", "like", 5).matched).toBe(true);
  });

  it("quitter le groupe les emporte", () => {
    const s = withParticipants(["a", "b"]);
    recordVote(s, "a", "movie:1", "like", 1);
    leaveSession(s, "a", 2, true);
    expect(s.ballots.has("a")).toBe(false);
  });

  it("une séance refermée puis rouverte reprend là où l'on était, matchs en attente compris", () => {
    const s = withParticipants(["a", "b"]);
    recordVote(s, "a", "movie:1", "like", 1);
    recordVote(s, "b", "movie:1", "like", 2);
    recordVote(s, "a", "movie:2", "dislike", 3);
    closeSession(s);
    expect(sessionToDto(s, 9).participants).toEqual([]);
    reopenSession(s, { sessionId: 7, startedBy: "b", now: 50 });
    joinSession(s, "a", null, 51);
    expect(sessionToDto(s, 10)).toMatchObject({
      sessionId: 7, startedBy: "b", startedAt: 50, proposals: [{ key: "movie:1" }],
      participants: [{ userId: "a", judged: 2, joinedAt: 51 }],
    });
    expect(nextCards(s, "a", 1, new Set()).map((c) => c.key)).toEqual(["movie:3"]);
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
    expect(promotedFor(s, "a")).toEqual(["movie:6", "movie:5"]);
    expect(nextCards(s, "a", 4, new Set()).map((c) => c.key)).toEqual(["movie:6", "movie:5", "movie:1", "movie:2"]);
  });

  it("jamais un match en attente, même à qui arrive après lui", () => {
    const s = withParticipants(["a", "b"], 3);
    recordVote(s, "a", "movie:2", "like", 1);
    recordVote(s, "b", "movie:2", "like", 2);
    joinSession(s, "c", null, 3);
    expect(nextCards(s, "c", 10, new Set()).map((c) => c.key)).toEqual(["movie:1", "movie:3"]);
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
    expect(dto).toMatchObject({ sessionId: 1, seq: 42, kind: "movie", deckSize: 6, proposals: [] });
    expect(dto.participants).toEqual([
      { userId: "b", judged: 0, joinedAt: 0 },
      { userId: "a", judged: 2, joinedAt: 1 },
    ]);
  });
});
