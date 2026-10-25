/**
 * `POST /api/music/offline/plan` : le hors ligne appartient au compte de
 * l'appareil (une session de profil n'a rien), au droit Jellyfin
 * `EnableContentDownloading`, et ne planifie que ce que le compte voit.
 */

import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IndexRow } from "../index/indexTypes";

const state = vi.hoisted(() => ({
  session: "personal" as string,
  policy: null as Record<string, boolean> | null,
  visible: new Set<string>(),
  rows: new Map<string, unknown>(),
}));

vi.mock("../../middleware/auth", () => ({ getTokenFromRequest: () => "jeton" }));
vi.mock("../../services/jellyfinPolicy", () => ({
  getUserDownloadPolicy: async () => state.policy,
  audioLightAllowed: (p: Record<string, boolean> | null) => !!p && p.enableMediaConversion === true,
}));
vi.mock("../index/indexQueries", () => ({ rowsByIds: async (ids: string[]) => new Map(ids.filter((i) => state.rows.has(i)).map((i) => [i, state.rows.get(i)])) }));
vi.mock("../view/viewContext", () => ({ visibleRows: (_v: unknown, rows: Iterable<IndexRow>) => [...rows].filter((r) => state.visible.has(r.id)) }));
vi.mock("./requestView", () => ({
  userOf: () => ({ userId: "u1", username: "banc", isAdmin: false, session: state.session }),
  viewOf: async () => ({}),
}));

import { musicOfflineRoutes } from "./musicOfflineRoutes";

const A = "a".repeat(32);
const B = "b".repeat(32);
const FLAC = { codec: "flac", container: "flac", sampleRate: 44_100, bitDepth: 16, bitrate: 900_000, channels: 2, lossless: true };

function row(id: string): Partial<IndexRow> {
  return { id, kind: "track", name: id, durationMs: 1000, sizeBytes: 42, format: FLAC };
}

async function plan(ids: string[]) {
  const app = Fastify();
  musicOfflineRoutes(app);
  const res = await app.inject({ method: "POST", url: "/offline/plan", payload: { ids } });
  await app.close();
  return res;
}

beforeEach(() => {
  state.session = "personal";
  state.policy = { enableContentDownloading: true, enableMediaConversion: false };
  state.visible = new Set([A]);
  state.rows = new Map([[A, row(A)], [B, row(B)]]);
});

describe("plan de la musique gardée", () => {
  it("planifie ce que le compte voit et refuse le reste", async () => {
    const res = await plan([A, B, "c".repeat(32)]);
    expect(res.statusCode).toBe(200);
    const body = res.json() as { tracks: { id: string; variant: string }[]; refused: string[] };
    expect(body.tracks.map((t) => [t.id, t.variant])).toEqual([[A, "original"]]);
    expect(body.refused).toEqual([B, "c".repeat(32)]);
  });

  it("le mode Allégé de l'administration vaut pour la musique", async () => {
    state.policy = { enableContentDownloading: true, enableMediaConversion: true };
    const body = (await plan([A])).json() as { tracks: { variant: string; preset: string }[] };
    expect(body.tracks[0]).toMatchObject({ variant: "light", preset: "a256" });
  });

  it("une session de profil n'a pas de hors ligne (appel direct compris)", async () => {
    state.session = "tvProfile";
    expect((await plan([A])).statusCode).toBe(404);
    state.session = "impersonation";
    expect((await plan([A])).statusCode).toBe(404);
  });

  it("sans le droit Jellyfin de garder, rien", async () => {
    state.policy = { enableContentDownloading: false, enableMediaConversion: true };
    expect((await plan([A])).statusCode).toBe(404);
    state.policy = null;
    expect((await plan([A])).statusCode).toBe(404);
  });

  it("un lot mal formé est refusé", async () => {
    expect((await plan([])).statusCode).toBe(400);
  });
});
