/**
 * Le parcours d'un import : lecture → rapprochement par LA règle du cœur →
 * playlist créée au nom du compte avec les SEULS titres de la bibliothèque ;
 * les absents, avec leur place, jamais ajoutés.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { bestMatch } from "../contract/musicLibraryMatch";
import type { MusicMatchTrackQuery } from "../contract/musicCoreApi";
import type { IndexRow } from "../index/indexTypes";
import { trackMatchable } from "../view/matchViews";
import type { UserView } from "../view/viewContext";
import { getImport, resetImportsForTests, startImport, type ImportDeps } from "./importJobs";
import type { ImportRequestParsed } from "./importInput";

vi.mock("../index/matchQueries", () => ({ rowsNamed: async () => [], albumsByMbids: async () => [] }));
vi.mock("../index/indexQueries", () => ({ albumTracks: async () => [], tracksByRecording: async () => [] }));

function row(id: string, name: string, artist: string, durationMs: number | null): IndexRow {
  return { id, kind: "track", name, artists: [{ name: artist, mbid: null }], albumName: null, durationMs, recordingMbid: null, albumArtist: null, discNumber: null, trackNumber: null } as unknown as IndexRow;
}

const LIBRARY = [row("a1", "One More Time", "Daft Punk", 320_000), row("a2", "Bohemian Rhapsody", "Queen", 355_000), row("a3", "Get Lucky", "Daft Punk", 248_000)];

/** LA règle du cœur (`bestMatch` + `isSameTrack`), sur une bibliothèque en mémoire. */
const match: ImportDeps["match"] = async (_view, queries: readonly MusicMatchTrackQuery[]) => {
  const out = new Map<string, IndexRow>();
  for (const q of queries) {
    const hit = bestMatch(q, LIBRARY, trackMatchable);
    if (hit) out.set(q.ref, hit);
  }
  return out;
};

function deps(over: Partial<ImportDeps> = {}): ImportDeps & { created: { userId: string; name: string; ids: string[] }[] } {
  const created: { userId: string; name: string; ids: string[] }[] = [];
  return {
    created,
    fetcher: async () => {
      throw new Error("aucun réseau dans ce test");
    },
    view: async () => ({ userId: "u1" }) as unknown as UserView,
    create: async (userId, name, ids) => {
      created.push({ userId, name, ids });
      return { ok: true, value: "pl-new" };
    },
    match,
    ...over,
  };
}

const text = (body: string, extra: Partial<ImportRequestParsed> = {}): ImportRequestParsed => ({ input: { kind: "text", text: body }, name: null, keepEmpty: false, ...extra });

beforeEach(() => resetImportsForTests());

describe("import — parcours", () => {
  it("ne met dans la playlist QUE les titres de la bibliothèque, dans l'ordre de la source ; les absents gardent leur place", async () => {
    const d = deps();
    const list = "Absent One - Nope\nDaft Punk - Get Lucky\nUnknown - Missing\nQueen - Bohemian Rhapsody - Remastered 2011\nNobody - Else";
    const started = startImport("u1", text(list, { name: "Ma soirée" }), d);
    if (!started.ok) throw new Error("refusé");
    await started.done;
    const job = getImport("u1", started.jobId);
    expect(job?.stage).toBe("done");
    expect(d.created).toEqual([{ userId: "u1", name: "Ma soirée", ids: ["a3", "a2"] }]);
    expect(job?.result).toMatchObject({ playlistId: "pl-new", total: 5, added: 2, source: "text" });
    expect(job?.result?.absent.map((t) => [t.index, t.position])).toEqual([
      [0, 0],
      [2, 1],
      [4, 2],
    ]);
  });

  it("aucun titre de la bibliothèque et rien à confier : aucune playlist créée", async () => {
    const d = deps();
    const started = startImport("u1", text("X - Y\nZ - W"), d);
    if (!started.ok) throw new Error("refusé");
    await started.done;
    expect(getImport("u1", started.jobId)).toMatchObject({ stage: "failed", failure: "noneInLibrary" });
    expect(d.created).toEqual([]);
  });

  it("keepEmpty (une extension prendra les absents) : la playlist est créée, vide", async () => {
    const d = deps();
    const started = startImport("u1", text("X - Y", { keepEmpty: true }), d);
    if (!started.ok) throw new Error("refusé");
    await started.done;
    expect(getImport("u1", started.jobId)?.result).toMatchObject({ added: 0, absent: [{ index: 0, position: 0 }] });
    expect(d.created[0]?.ids).toEqual([]);
  });

  it("Jellyfin refuse la playlist : échec dit, rien d'autre", async () => {
    const started = startImport("u1", text("Daft Punk - Get Lucky"), deps({ create: async () => ({ ok: false }) }));
    if (!started.ok) throw new Error("refusé");
    await started.done;
    expect(getImport("u1", started.jobId)).toMatchObject({ stage: "failed", failure: "failed" });
  });

  it("un seul import à la fois par compte ; l'avancée n'est lue que par son compte", async () => {
    let release: () => void = () => undefined;
    const slow = deps({ view: () => new Promise((r) => (release = () => r({ userId: "u1" } as unknown as UserView))) });
    const first = startImport("u1", text("Daft Punk - Get Lucky"), slow);
    expect(startImport("u1", text("Queen - Bohemian Rhapsody"), slow)).toEqual({ ok: false, reason: "busy" });
    if (!first.ok) throw new Error("refusé");
    expect(getImport("u2", first.jobId)).toBeNull();
    expect(getImport("u1", "inconnu")).toBeNull();
    await vi.waitFor(() => expect(getImport("u1", first.jobId)?.stage).toBe("matching"));
    release();
    await first.done;
    expect(startImport("u1", text("Queen - Bohemian Rhapsody"), slow).ok).toBe(true);
  });

  it("RAPIDE : 300 titres rapprochés et la playlist créée en moins d'une seconde (hors réseau)", async () => {
    const d = deps();
    const lines = Array.from({ length: 300 }, (_, i) => (i % 3 === 0 ? "Daft Punk - Get Lucky" : `Artiste ${i} - Titre ${i}`)).join("\n");
    const at = performance.now();
    const started = startImport("u1", text(lines), d);
    if (!started.ok) throw new Error("refusé");
    await started.done;
    const tookMs = performance.now() - at;
    expect(getImport("u1", started.jobId)?.result).toMatchObject({ total: 300, added: 100 });
    expect(tookMs).toBeLessThan(1_000);
  });
});
