/**
 * Le snapshot des segments au format résolu : un seul appel (le résolveur du
 * backend, pas le proxy Jellyfin), garde d'écriture minimale, rien d'écrit
 * quand la réponse n'est pas le contrat.
 */

import { mkdtempSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fetchAndSave } from "./segments";
import type { FetchBytes } from "./fetcher";

const CONTRACT = {
  version: 1,
  itemId: "ep-1",
  runtimeMs: 1_440_000,
  segments: [
    {
      type: "Intro",
      startMs: 0,
      endMs: 90_000,
      source: "jellyfin",
      endsAtMediaEnd: false,
      hasContentAfter: true,
    },
  ],
  resolvedAt: "2026-08-28T00:00:00.000Z",
};

let root = "";
let urls: string[] = [];

const settle = (body: string | null): FetchBytes => {
  return async (url) => {
    urls.push(url);
    return body === null ? null : new Uint8Array(Buffer.from(body, "utf8"));
  };
};

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), "tentacle-segments-"));
  urls = [];
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

const PATH = () => path.join(root, "meta", "ep-1", "segments.json");

describe("fetchAndSave", () => {
  it("interroge le résolveur du backend et persiste le contrat tel quel", async () => {
    const ok = await fetchAndSave(settle(JSON.stringify(CONTRACT)), "http://srv.test", root, "ep-1");
    expect(ok).toBe(true);
    expect(urls).toEqual(["http://srv.test/api/playback/segments/ep-1"]);
    expect(JSON.parse(readFileSync(PATH(), "utf8"))).toEqual(CONTRACT);
  });

  it("réponse hors contrat (HTML, ancien format brut) : rien n'est écrit", async () => {
    const html = await fetchAndSave(settle("<html>proxy</html>"), "http://srv.test", root, "ep-1");
    expect(html).toBe(false);

    const previous = await fetchAndSave(
      settle(JSON.stringify({ mediaSegments: null, pluginDict: null, pluginTs: null })),
      "http://srv.test",
      root,
      "ep-1",
    );
    expect(previous).toBe(false);
    expect(existsSync(PATH())).toBe(false);
  });

  it("réseau muet : faux, sans fichier", async () => {
    const ok = await fetchAndSave(settle(null), "http://srv.test", root, "ep-1");
    expect(ok).toBe(false);
    expect(existsSync(PATH())).toBe(false);
  });
});
