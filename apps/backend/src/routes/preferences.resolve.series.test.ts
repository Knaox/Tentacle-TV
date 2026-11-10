/**
 * « Appliquer à cette série » : le contrat que le web et le bureau tiennent
 * avec `POST /resolve` (`apps/web/src/hooks/trackPrefScope.ts`). La route
 * s'arrête au premier niveau trouvé — le contenu, puis `libraryId`, puis
 * `libraryIds` dans l'ordre. Le client qui veut que la série l'emporte sur le
 * choix propre à l'épisode et sur la saison n'envoie donc QUE la série, sans
 * `itemId`. Ce test verrouille l'ordre dont il dépend.
 */
import Fastify from "fastify";
import { beforeAll, describe, expect, it, vi } from "vitest";

const pref = (audioLang: string, subtitleLang: string | null, subtitleMode: string) => ({ audioLang, subtitleLang, subtitleMode });
const store = vi.hoisted(() => ({
  items: new Map<string, unknown>(),
  libraries: new Map<string, unknown>(),
}));
vi.mock("../services/db", () => ({
  getPrisma: () => ({
    itemTrackPreference: {
      findUnique: async ({ where }: { where: { jellyfinUserId_itemId: { itemId: string } } }) =>
        store.items.get(where.jellyfinUserId_itemId.itemId) ?? null,
    },
    libraryPreference: {
      findUnique: async ({ where }: { where: { jellyfinUserId_libraryId: { libraryId: string } } }) =>
        store.libraries.get(where.jellyfinUserId_libraryId.libraryId) ?? null,
    },
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
  // L'épisode a son choix propre (anglais), la saison le sien (allemand), la
  // série est cochée : japonais, sous-titres français.
  store.items.set("ep7", pref("eng", null, "none"));
  store.libraries.set("saison2", pref("ger", null, "none"));
  store.libraries.set("serie", pref("jpn", "fre", "always"));
});

const audioTracks = [
  { index: 1, language: "fre", isDefault: true },
  { index: 2, language: "eng" },
  { index: 3, language: "ger" },
  { index: 4, language: "jpn" },
];
const subtitleTracks = [{ index: 5, language: "eng" }, { index: 6, language: "fre" }];

async function resolve(scope: Record<string, unknown>) {
  const res = await app.inject({ method: "POST", url: "/resolve", payload: { ...scope, audioTracks, subtitleTracks } });
  return res.json() as { audioIndex: number | null; subtitleIndex: number | null };
}

describe("POST /resolve — la série cochée l'emporte", () => {
  it("l'ordre d'avant : le choix propre à l'épisode passe devant", async () => {
    expect(await resolve({ libraryId: "saison2", libraryIds: ["saison2", "serie", "biblio"], itemId: "ep7" }))
      .toEqual({ audioIndex: 2, subtitleIndex: -1 });
  });

  it("sans le contenu, la saison passe encore devant la série", async () => {
    expect((await resolve({ libraryId: "saison2", libraryIds: ["saison2", "serie"] })).audioIndex).toBe(3);
  });

  it("la série seule : audio ET sous-titres de la série", async () => {
    expect(await resolve({ libraryId: "serie", libraryIds: ["serie"] })).toEqual({ audioIndex: 4, subtitleIndex: 6 });
  });
});
