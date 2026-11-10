/**
 * Lot « pg » : les absents d'un import confiés PAR LOTS à l'extension qui les reçoit ainsi (`importBatches`), un
 * seul appel borné pour une extension d'avant, et la lecture « extension d'abord » (`importReadFirst`).
 */

import { describe, expect, it, vi } from "vitest";
import { MUSIC_IMPORT_BATCH, type ImportAbsentTrack, type ImportTracksRequest, type MusicImportJob } from "@tentacle-tv/shared/music";
import { confideAbsent, type ConfidePort } from "./importConfide";
import { runImport, type ImportFlowState, type ImportPort } from "./importFlow";

const absent = (index: number): ImportAbsentTrack => ({ index, position: 0, title: `T${index}`, artists: ["A"], album: null, durationMs: null, isrc: null, sourceId: null, artworkUrl: `https://i.scdn.co/image/${index}` });
const many = (n: number) => Array.from({ length: n }, (_, i) => absent(i));
const ctx = { playlistId: "pl", source: "spotify" as const, importId: "job-1", name: "Géante", artworkUrl: "https://i.scdn.co/image/cover" };

class NetworkDown extends Error {}
class Refused extends Error {}

function confidePort(over: Partial<ConfidePort> & { failures?: Map<number, number> } = {}) {
  const calls: ImportTracksRequest[] = [];
  let inFlight = 0;
  let peak = 0;
  const port: ConfidePort = {
    batches: true,
    confide: async (request) => {
      calls.push(request);
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await Promise.resolve();
      inFlight -= 1;
      const first = request.tracks[0]?.index ?? -1;
      const left = over.failures?.get(first) ?? 0;
      if (left > 0) {
        over.failures!.set(first, left - 1);
        throw left > 100 ? new Refused() : new NetworkDown();
      }
      return { operationId: "op-1", accepted: request.tracks.length };
    },
    progress: async () => ({ operationId: "op-1", state: "done", total: 9_000, processed: 9_000, added: 8_500, notFound: [1] }),
    cancel: vi.fn(),
    isRefusal: (error) => error instanceof Refused,
    sleep: async () => undefined,
    now: () => 0,
    ...over,
  };
  return { port, calls, peak: () => peak };
}

const signal = () => new AbortController().signal;

describe("confier par lots (`importBatches`)", () => {
  it("9 000 absents : 18 lots de 500, 3 en vol au plus, chacun avec importId, total, nom et pochette", async () => {
    const f = confidePort();
    const out = await confideAbsent(f.port, ctx, many(9_000), signal(), () => undefined);
    expect(f.calls).toHaveLength(18);
    expect(f.peak()).toBeLessThanOrEqual(MUSIC_IMPORT_BATCH.parallel);
    expect(f.calls.every((c) => c.importId === "job-1" && c.total === 9_000 && c.name === "Géante" && c.tracks.length <= 500)).toBe(true);
    expect(f.calls.flatMap((c) => c.tracks.map((t) => t.index)).sort((a, b) => a - b)).toEqual(many(9_000).map((t) => t.index));
    expect(f.calls[0]?.tracks[0]?.artworkUrl).toBe("https://i.scdn.co/image/0");
    expect(out.added).toBe(8_500);
    expect(out.outcome.kind === "done" && out.outcome.skipped.get(1)).toBe("notFound");
  });

  it("un lot tombé sur une coupure repart (même contenu, même importId) ; un refus ne repart jamais", async () => {
    const f = confidePort({ failures: new Map([[500, 2], [1_000, 1_000]]) });
    const out = await confideAbsent(f.port, ctx, many(1_500), signal(), () => undefined);
    expect(f.calls.filter((c) => c.tracks[0]?.index === 500)).toHaveLength(3);
    expect(f.calls.filter((c) => c.tracks[0]?.index === 1_000)).toHaveLength(1);
    // Le lot refusé : ses titres sont dits « indisponible », les autres suivent la progression.
    expect(out.outcome.kind === "done" && out.outcome.skipped.get(1_000)).toBe("unavailable");
    expect(out.outcome.kind === "done" && out.outcome.skipped.get(500)).toBeUndefined();
  });

  it("un lot perdu après les relances : ses titres seulement sont « indisponible »", async () => {
    const f = confidePort({ failures: new Map([[0, 99]]) });
    const out = await confideAbsent(f.port, ctx, many(1_000), signal(), () => undefined);
    expect(f.calls.filter((c) => c.tracks[0]?.index === 0)).toHaveLength(1 + MUSIC_IMPORT_BATCH.retries);
    expect(out.outcome.kind === "done" && out.outcome.skipped.get(499)).toBe("unavailable");
    expect(out.outcome.kind === "done" && out.outcome.skipped.has(500)).toBe(false);
  });
});

describe("une extension d'avant (sans `importBatches`)", () => {
  it("UN appel, la requête d'avant (aucun champ nouveau), au plus 1 000 titres ; les autres « extensionLimit »", async () => {
    const f = confidePort({ batches: false });
    const out = await confideAbsent(f.port, ctx, many(9_000), signal(), () => undefined);
    expect(f.calls).toHaveLength(1);
    expect(Object.keys(f.calls[0]!).sort()).toEqual(["playlistId", "source", "tracks"]);
    expect(f.calls[0]?.tracks).toHaveLength(MUSIC_IMPORT_BATCH.legacyCap);
    expect(out.overflow.size).toBe(8_000);
    expect(out.outcome.kind === "done" && out.outcome.skipped.get(8_999)).toBe("extensionLimit");
  });
});

describe("lecture par l'extension d'abord (`importReadFirst`)", () => {
  const job = (over: Partial<MusicImportJob> = {}): MusicImportJob => ({
    jobId: "job-9",
    stage: "done",
    source: "spotify",
    name: "Géante",
    total: 9_000,
    matched: 9_000,
    found: 0,
    result: { playlistId: "pl", name: "Géante", source: "spotify", total: 9_000, added: 0, absent: [], truncated: false },
    ...over,
  });
  function flowPort(read: ImportPort["read"]): ImportPort & { requests: unknown[] } {
    const requests: unknown[] = [];
    return {
      requests,
      startCore: async (request) => {
        requests.push(request);
        return "job-9";
      },
      core: async () => job(),
      refusal: () => null,
      canRead: (s) => s === "spotify" || s === "youtube",
      readsFirst: (s) => s === "spotify",
      read,
      canConfide: false,
      confide: async () => null,
      progress: async () => {
        throw new Error("rien");
      },
      cancel: () => undefined,
      sleep: async () => undefined,
      now: () => 0,
    };
  }
  const url = "https://open.spotify.com/playlist/69VOdzkx8II6pi0sUvcu65";
  const run = (p: ImportPort) => runImport({ kind: "url", url }, p, (_s: ImportFlowState) => undefined, signal());

  it("Spotify : l'extension lit la playlist ENTIÈRE, le cœur ne fait que rapprocher et créer", async () => {
    const tracks = many(9_000).map(({ position: _p, ...t }) => t);
    const p = flowPort(async () => ({ ok: true, playlist: { source: "spotify", name: "Géante", tracks, truncated: false, artworkUrl: null } }));
    const final = await run(p);
    expect(final.phase).toBe("done");
    expect(p.requests).toHaveLength(1);
    expect((p.requests[0] as { playlist?: { tracks: unknown[] } }).playlist?.tracks).toHaveLength(9_000);
  });

  it("l'extension ne peut pas (indisponible, budget) : le cœur lit sa page publique", async () => {
    const p = flowPort(async () => ({ ok: false, refusal: "budget" }));
    const final = await run(p);
    expect(final.phase).toBe("done");
    expect(p.requests[0]).toMatchObject({ url });
  });

  it("introuvable chez l'extension : l'import s'arrête, le cœur n'est pas appelé", async () => {
    const p = flowPort(async () => ({ ok: false, refusal: "notFound" }));
    const final = await run(p);
    expect(final).toMatchObject({ phase: "failed", failure: "notFound" });
    expect(p.requests).toHaveLength(0);
  });
});
