/**
 * Le déroulé d'un import, sur un cœur et une extension factices : sans
 * extension, les absents ne sont que listés ; avec `importTracks`, ils lui
 * sont confiés ; une source que le cœur ne lit pas passe par `importRead`.
 */

import { describe, expect, it, vi } from "vitest";
import type { ImportAbsentTrack, ImportedPlaylist, ImportTracksProgress, MusicImportJob, MusicImportRequest } from "@tentacle-tv/shared/music";
import { runImport, type ImportFlowState, type ImportPort } from "./importFlow";

const absent = (index: number, position: number): ImportAbsentTrack => ({ index, position, title: `T${index}`, artists: ["A"], album: null, durationMs: null, isrc: null, sourceId: null });

function doneJob(over: Partial<NonNullable<MusicImportJob["result"]>> = {}): MusicImportJob {
  return {
    jobId: "j",
    stage: "done",
    source: "spotify",
    name: "Mix",
    total: 4,
    matched: 4,
    found: 2,
    result: { playlistId: "pl", name: "Mix", source: "spotify", total: 4, added: 2, absent: [absent(1, 1), absent(3, 2)], truncated: false, ...over },
  };
}

function port(over: Partial<ImportPort> = {}): ImportPort & { started: MusicImportRequest[] } {
  const started: MusicImportRequest[] = [];
  let polls = 0;
  return {
    started,
    startCore: async (request) => {
      started.push(request);
      return "j";
    },
    core: async () => (++polls < 2 ? { jobId: "j", stage: "matching", source: "spotify", name: "Mix", total: 4, matched: 2, found: 1 } : doneJob()),
    refusal: () => null,
    canRead: () => false,
    read: async () => ({ ok: false, refusal: "unsupported" }),
    canConfide: false,
    confide: async () => null,
    progress: async () => {
      throw new Error("pas d'extension");
    },
    cancel: vi.fn(),
    sleep: async () => undefined,
    now: () => 0,
    ...over,
  };
}

async function run(input: Parameters<typeof runImport>[0], p: ImportPort) {
  const seen: ImportFlowState[] = [];
  const final = await runImport(input, p, (s) => seen.push(s), new AbortController().signal);
  return { final, seen };
}

describe("import — sans extension", () => {
  it("le cœur lit, rapproche, crée ; les absents sont LISTÉS, jamais confiés", async () => {
    const p = port();
    const { final, seen } = await run({ kind: "url", url: "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M" }, p);
    expect(p.started).toEqual([{ keepEmpty: false, url: "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M" }]);
    expect(seen.some((s) => s.phase === "matching" && s.matched === 2)).toBe(true);
    expect(final).toMatchObject({ phase: "done", summary: { playlistId: "pl", inLibrary: 2, outside: 0, outsideRefused: false } });
    expect(final.summary?.missing.map((t) => [t.index, t.reason])).toEqual([[1, "noExtension"], [3, "noExtension"]]);
  });

  it("un lien YouTube sans extension qui le lit : « demande une extension », rien n'est lancé", async () => {
    const p = port();
    const { final } = await run({ kind: "url", url: "https://music.youtube.com/playlist?list=PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG" }, p);
    expect(final).toMatchObject({ phase: "failed", failure: "needsExtension" });
    expect(p.started).toEqual([]);
  });

  it("un lien non reconnu, un serveur occupé, un échec du cœur : dits en mots fermés", async () => {
    expect((await run({ kind: "url", url: "https://evil.example/x" }, port())).final.failure).toBe("unsupported");
    const busy = port({ startCore: async () => Promise.reject(new Error("429")), refusal: () => "busy" });
    expect((await run({ kind: "text", text: "A - B" }, busy)).final.failure).toBe("busy");
    const none = port({ core: async () => ({ jobId: "j", stage: "failed", source: "text", name: null, total: 2, matched: 2, found: 0, failure: "noneInLibrary" }) });
    expect((await run({ kind: "text", text: "A - B" }, none)).final.failure).toBe("noneInLibrary");
  });
});

describe("import — avec une extension", () => {
  it("demande au cœur de garder une playlist même vide, puis lui confie les absents avec leur place", async () => {
    const confide = vi.fn(async () => ({ operationId: "op", accepted: 2 }));
    const progress = vi
      .fn<() => Promise<ImportTracksProgress>>()
      .mockResolvedValueOnce({ operationId: "op", state: "running", total: 2, processed: 1, added: 1, notFound: [] })
      .mockResolvedValueOnce({ operationId: "op", state: "done", total: 2, processed: 2, added: 1, notFound: [3] });
    const p = port({ canConfide: true, confide, progress });
    const { final, seen } = await run({ kind: "text", text: "x" }, p);
    expect(p.started[0]).toMatchObject({ keepEmpty: true });
    expect(confide).toHaveBeenCalledWith({ playlistId: "pl", source: "spotify", tracks: [absent(1, 1), absent(3, 2)] }, expect.anything());
    expect(seen.some((s) => s.phase === "outside" && s.outside?.processed === 1)).toBe(true);
    expect(final.summary).toMatchObject({ inLibrary: 2, outside: 1, outsideRefused: false });
    expect(final.summary?.missing.map((t) => [t.index, t.reason])).toEqual([[3, "notFound"]]);
  });

  it("l'extension dit le motif de chaque titre non posé et combien étaient déjà importés par le compte", async () => {
    const progress = async (): Promise<ImportTracksProgress> => ({ operationId: "op", state: "done", total: 2, processed: 2, added: 1, own: 1, notFound: [], skipped: [{ index: 3, reason: "duplicate" }] });
    const p = port({ canConfide: true, confide: async () => ({ operationId: "op", accepted: 2 }), progress });
    const { final } = await run({ kind: "text", text: "x" }, p);
    expect(final.summary).toMatchObject({ total: 4, inLibrary: 2, outside: 1, own: 1 });
    expect(final.summary?.missing.map((t) => [t.index, t.reason])).toEqual([[3, "duplicate"]]);
  });

  it("l'extension s'arrête sur la limite du jour : chaque absent le dit", async () => {
    const progress = async (): Promise<ImportTracksProgress> => ({ operationId: "op", state: "failed", total: 2, processed: 0, added: 0, notFound: [], reason: "quota" });
    const p = port({ canConfide: true, confide: async () => ({ operationId: "op", accepted: 0 }), progress });
    const { final } = await run({ kind: "text", text: "x" }, p);
    expect(final.summary?.missing.map((t) => t.reason)).toEqual(["quota", "quota"]);
  });

  it("l'extension refuse (quota, panne) : les absents restent listés, la playlist de la bibliothèque est là", async () => {
    const p = port({ canConfide: true, confide: async () => Promise.reject(new Error("403")) });
    const { final } = await run({ kind: "text", text: "x" }, p);
    expect(final.summary).toMatchObject({ inLibrary: 2, outside: 0, outsideRefused: true });
    expect(final.summary?.missing.map((t) => t.reason)).toEqual(["unavailable", "unavailable"]);
  });

  it("YouTube : l'extension lit la playlist, le cœur rapproche ce qu'elle a lu", async () => {
    const playlist: ImportedPlaylist = { source: "youtube", name: "YT", tracks: [], truncated: false, artworkUrl: null };
    const read = vi.fn(async () => ({ ok: true as const, playlist }));
    const p = port({ canRead: (s) => s === "youtube", read });
    await run({ kind: "url", url: "https://www.youtube.com/playlist?list=PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG" }, p);
    expect(read).toHaveBeenCalledWith("https://music.youtube.com/playlist?list=PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG", expect.anything());
    expect(p.started[0]).toMatchObject({ playlist });
  });

  it("le cœur ne lit plus la page : l'extension qui sait la lire prend le relais", async () => {
    let call = 0;
    const playlist: ImportedPlaylist = { source: "spotify", name: "S", tracks: [], truncated: false, artworkUrl: null };
    const p = port({
      canRead: (s) => s === "spotify",
      read: async () => ({ ok: true, playlist }),
      core: async () => (++call === 1 ? { jobId: "j", stage: "failed", source: "spotify", name: null, total: 0, matched: 0, found: 0, failure: "unavailable" } : doneJob()),
    });
    const { final } = await run({ kind: "url", url: "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M" }, p);
    expect(p.started.map((r) => ("playlist" in r ? "playlist" : "url"))).toEqual(["url", "playlist"]);
    expect(final.phase).toBe("done");
  });

  it("annulé pendant la tenue des absents : l'opération de l'extension est arrêtée", async () => {
    const controller = new AbortController();
    const p = port({
      canConfide: true,
      confide: async () => ({ operationId: "op", accepted: 2 }),
      progress: async () => {
        controller.abort();
        throw new Error("annulé");
      },
    });
    await expect(runImport({ kind: "text", text: "x" }, p, () => undefined, controller.signal)).rejects.toBeDefined();
    expect(p.cancel).toHaveBeenCalledWith("op");
  });
});

describe("import — lien de partage d'un autre Tentacle", () => {
  const link = "https://musique.ami.example/octave/share/AbCdEfGhIjKlMnOpQrStUv";

  it("le cœur le lit lui-même ; les absents vont à l'extension sous la source `text`", async () => {
    const confide = vi.fn(async () => ({ operationId: "op", accepted: 2 }));
    const done = { ...doneJob({ source: "tentacle" }), source: "tentacle" as const };
    const p = port({ tentacleShare: true, canConfide: true, confide, core: async () => done, progress: async (): Promise<ImportTracksProgress> => ({ operationId: "op", state: "done", total: 2, processed: 2, added: 2, notFound: [] }) });
    const { final } = await run({ kind: "url", url: link }, p);
    expect(p.started).toEqual([{ keepEmpty: true, url: link }]);
    expect(confide).toHaveBeenCalledWith(expect.objectContaining({ playlistId: "pl", source: "text" }), expect.anything());
    expect(final).toMatchObject({ phase: "done", summary: { source: "tentacle", inLibrary: 2, outside: 2 } });
  });

  it("face à un serveur qui ne les lit pas : « non pris en charge », rien n'est lancé", async () => {
    const p = port({ canRead: () => true });
    const { final } = await run({ kind: "url", url: link }, p);
    expect(final).toMatchObject({ phase: "failed", failure: "unsupported" });
    expect(p.started).toEqual([]);
  });
});
