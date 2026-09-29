/** La préférence « VO » : la version originale du titre, que Jellyfin 12 sait nommer. */
import Fastify from "fastify";
import { beforeAll, describe, expect, it, vi } from "vitest";

const prefs = vi.hoisted(() => ({ audioLang: "original" as string | null }));
vi.mock("../services/db", () => ({
  getPrisma: () => ({
    itemTrackPreference: { findUnique: async () => null },
    libraryPreference: { findUnique: async () => ({ audioLang: prefs.audioLang, subtitleLang: null, subtitleMode: "none" }) },
  }),
}));

import { registerResolveRoute } from "./preferences.resolve";

const app = Fastify();
beforeAll(async () => {
  app.addHook("preHandler", async (request) => {
    (request as unknown as { user: unknown }).user = { userId: "u1", username: "u", isAdmin: false };
  });
  registerResolveRoute(app);
  await app.ready();
});

// Doublage français en première piste (par défaut), VO japonaise ensuite.
const TRACKS = [
  { index: 1, language: "fra", isDefault: true },
  { index: 2, language: "jpn" },
];

async function audioFor(body: Record<string, unknown>): Promise<number | null> {
  const res = await app.inject({ method: "POST", url: "/resolve", payload: { libraryId: "lib", audioTracks: TRACKS, ...body } });
  return (res.json() as { audioIndex: number | null }).audioIndex;
}

describe("POST /resolve — préférence VO", () => {
  it("choisit la piste que Jellyfin marque originale", async () => {
    expect(await audioFor({ audioTracks: [TRACKS[0], { ...TRACKS[1], isOriginal: true }] })).toBe(2);
  });

  it("sinon la langue originale du titre (ISO 639-1 contre 639-2)", async () => {
    expect(await audioFor({ originalLanguage: "ja" })).toBe(2);
  });

  it("la langue originale du titre prime sur le drapeau d'une autre piste (règle de Jellyfin 12)", async () => {
    expect(await audioFor({ audioTracks: [TRACKS[0], { ...TRACKS[1], isOriginal: true }], originalLanguage: "fr" })).toBe(1);
  });

  it("sans rien pour la reconnaître (Jellyfin d'avant 12), la piste par défaut", async () => {
    expect(await audioFor({})).toBe(1);
    expect(await audioFor({ originalLanguage: null })).toBe(1);
  });

  it("une langue précise se résout comme avant", async () => {
    prefs.audioLang = "jpn";
    expect(await audioFor({ originalLanguage: "fr" })).toBe(2);
    prefs.audioLang = "original";
  });
});
