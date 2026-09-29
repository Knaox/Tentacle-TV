/**
 * La sonde des capacités : l'index des routes que publie le document OpenAPI
 * du Jellyfin connecté, et ce qu'il dit des endpoints d'une fonctionnalité.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ calls: 0, doc: null as unknown, url: "http://jf.test" }));

vi.mock("../configStore", () => ({ getJellyfinUrl: () => state.url, getJellyfinApiKey: () => "cle" }));
vi.mock("../jellyfinAdminFetch", () => ({
  jellyfinAdminFetch: async () => {
    state.calls += 1;
    return state.doc ? { ok: true, data: state.doc } : { ok: false, failure: "unreachable" };
  },
}));

import { indexOpenApi, normalizeEndpoint, probeFeature, readEndpointIndex, resetEndpointIndexForTests } from "./openApiProbe";

const DOC = {
  openapi: "3.0.4",
  paths: {
    "/MediaSegments/{itemId}": { get: {}, parameters: [] },
    "/Items/{itemId}/Collections": { get: {} },
    "/Library/VirtualFolders": { get: {}, post: {}, delete: {} },
  },
};

afterEach(() => {
  resetEndpointIndexForTests();
  state.calls = 0;
  state.doc = null;
  state.url = "http://jf.test";
});

describe("index des routes", () => {
  it("ignore la casse et le nom des paramètres", () => {
    expect(normalizeEndpoint("GET /MediaSegments/{itemId}")).toBe("get /mediasegments/{}");
    expect(normalizeEndpoint("get  /mediasegments/{id}")).toBe("get /mediasegments/{}");
  });

  it("ne garde que les méthodes HTTP, pas les paramètres communs d'un chemin", () => {
    const index = indexOpenApi(DOC);
    expect(index && [...index].sort()).toEqual([
      "delete /library/virtualfolders",
      "get /items/{}/collections",
      "get /library/virtualfolders",
      "get /mediasegments/{}",
      "post /library/virtualfolders",
    ]);
  });

  it("un document sans routes n'est pas un index", () => {
    expect(indexOpenApi({ paths: {} })).toBeNull();
    expect(indexOpenApi("<html>")).toBeNull();
  });
});

describe("verdict de la sonde", () => {
  const index = indexOpenApi(DOC) as Set<string>;

  it("présente quand tout est publié, manquante sinon — avec ce qui manque", () => {
    expect(probeFeature(["GET /MediaSegments/{id}"], index)).toEqual({ state: "present", missing: [] });
    expect(probeFeature(["GET /MediaSegments/{itemId}", "GET /Items/{itemId}/LocalTrailers"], index)).toEqual({
      state: "missing",
      missing: ["GET /Items/{itemId}/LocalTrailers"],
    });
  });

  it("rien à chercher : pas de verdict", () => {
    expect(probeFeature([], index)).toBeNull();
  });
});

describe("lecture du document", () => {
  it("lu une fois par serveur et par version, relu quand l'un change", async () => {
    state.doc = DOC;
    expect(await readEndpointIndex("12.1.0")).not.toBeNull();
    await readEndpointIndex("12.1.0");
    expect(state.calls).toBe(1);
    await readEndpointIndex("12.1.1");
    expect(state.calls).toBe(2);
    state.url = "http://autre.test";
    await readEndpointIndex("12.1.1");
    expect(state.calls).toBe(3);
  });

  it("un document illisible ne se garde pas : la lecture suivante réessaie", async () => {
    expect(await readEndpointIndex("10.11.8")).toBeNull();
    state.doc = DOC;
    expect(await readEndpointIndex("10.11.8")).not.toBeNull();
    expect(state.calls).toBe(2);
  });
});
