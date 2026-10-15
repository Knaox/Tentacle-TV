/**
 * La suppression par le jeton du compte : un appel par titre, le jeton reçu et lui
 * seul, un refus au milieu n'arrête pas les autres, et les statuts mesurés sur
 * Jellyfin 10.11.11 deviennent les sorts du contrat.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../configStore", () => ({ getJellyfinUrl: () => "http://jellyfin.test" }));

import { deleteLibraryItems, deletionRightsOfPolicy, outcomeOfStatus, readDeletionRights, tallyOutcomes } from "./libraryDeletion";

const A = "a".repeat(32);
const B = "b".repeat(32);
const C = "c".repeat(32);
const LIB = "84b49bd6a180d1ca614bbbd9227cb992";

interface Call { url: string; method: string; auth: string }
let calls: Call[] = [];
let statusOf: (id: string) => number | "throw" = () => 204;

beforeEach(() => {
  calls = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit = {}) => {
    const headers = init.headers as Record<string, string>;
    calls.push({ url, method: init.method ?? "GET", auth: headers.Authorization });
    if (url.endsWith("/Users/Me")) {
      return new Response(JSON.stringify({ Policy: { EnableContentDeletion: false, EnableContentDeletionFromFolders: [LIB] } }), { status: 200 });
    }
    const status = statusOf(url.split("/").pop() ?? "");
    if (status === "throw") throw new Error("ECONNREFUSED");
    return new Response(null, { status });
  }));
});
afterEach(() => vi.unstubAllGlobals());

describe("outcomeOfStatus", () => {
  it("rend les statuts mesurés de Jellyfin en sorts du contrat", () => {
    expect(outcomeOfStatus(204)).toBe("deleted");
    expect(outcomeOfStatus(401)).toBe("forbidden");
    expect(outcomeOfStatus(403)).toBe("forbidden");
    expect(outcomeOfStatus(404)).toBe("gone");
    expect(outcomeOfStatus(400)).toBe("failed");
    expect(outcomeOfStatus(500)).toBe("failed");
  });
});

describe("deletionRightsOfPolicy", () => {
  it("lit les deux droits de la politique, identifiants normalisés", () => {
    expect(deletionRightsOfPolicy({ EnableContentDeletion: true, EnableContentDeletionFromFolders: [] }))
      .toEqual({ everywhere: true, libraryIds: [] });
    expect(deletionRightsOfPolicy({ EnableContentDeletionFromFolders: ["84B49BD6-A180-D1CA-614B-BBD9227CB992", "pas un id", LIB] }))
      .toEqual({ everywhere: false, libraryIds: [LIB] });
  });

  it("une politique absente ou illisible ne supprime nulle part", () => {
    expect(deletionRightsOfPolicy(undefined)).toEqual({ everywhere: false, libraryIds: [] });
    expect(deletionRightsOfPolicy({ EnableContentDeletion: "true" })).toEqual({ everywhere: false, libraryIds: [] });
  });
});

describe("readDeletionRights", () => {
  it("relit la politique par le jeton du compte lui-même", async () => {
    await expect(readDeletionRights("jeton-du-compte")).resolves.toEqual({ everywhere: false, libraryIds: [LIB] });
    expect(calls).toEqual([{ url: "http://jellyfin.test/Users/Me", method: "GET", auth: 'MediaBrowser Token="jeton-du-compte"' }]);
  });
});

describe("deleteLibraryItems", () => {
  it("supprime titre par titre, par le jeton du compte, jamais DELETE /Items?ids=", async () => {
    const results = await deleteLibraryItems("jeton-du-compte", [A, B, C]);
    expect(results).toEqual([{ id: A, outcome: "deleted" }, { id: B, outcome: "deleted" }, { id: C, outcome: "deleted" }]);
    expect(calls.map((c) => c.method)).toEqual(["DELETE", "DELETE", "DELETE"]);
    expect(calls.map((c) => c.url).sort()).toEqual([A, B, C].map((id) => `http://jellyfin.test/Items/${id}`));
    expect(calls.every((c) => c.auth === 'MediaBrowser Token="jeton-du-compte"')).toBe(true);
  });

  it("un refus au milieu n'arrête pas les suivants, et chacun garde son sort, dans l'ordre", async () => {
    statusOf = (id) => (id === B ? 401 : id === C ? "throw" : 204);
    const results = await deleteLibraryItems("t", [A, B, C, "d".repeat(32)]);
    expect(results.map((r) => r.outcome)).toEqual(["deleted", "forbidden", "failed", "deleted"]);
    expect(calls).toHaveLength(4);
    expect(tallyOutcomes(results)).toEqual({ deleted: 2, gone: 0, forbidden: 1, failed: 1 });
    statusOf = () => 204;
  });
});
