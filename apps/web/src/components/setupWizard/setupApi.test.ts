import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Le contexte de l'assistant : un serveur d'avant le parcours (sans `flow`)
 * est dit tel quel, au lieu de laisser l'assistant deviner ses étapes — le
 * bureau embarque l'assistant et peut tomber sur un serveur plus ancien.
 */
vi.mock("../../pages/adminUtils", () => ({ BACKEND: "", creds: () => undefined }));
const { setupApi, SetupApiError } = await import("./setupApi");

/** La réponse du serveur à `/context`, la session de l'onglet comprise. */
function reply(body: unknown): void {
  vi.stubGlobal("sessionStorage", { getItem: () => "session", setItem: () => undefined, removeItem: () => undefined });
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })));
}

afterEach(() => vi.unstubAllGlobals());

describe("le contexte de l'assistant", () => {
  it("un serveur d'avant le parcours : « server_outdated », jamais des étapes devinées", async () => {
    reply({ deployment: "docker", jellyfin: { configured: true } });
    await expect(setupApi.context()).rejects.toEqual(new SetupApiError("server_outdated"));
  });

  it("un serveur qui tient le parcours : le contexte tel quel", async () => {
    vi.stubGlobal("sessionStorage", { getItem: () => "session", setItem: () => undefined, removeItem: () => undefined });
    const flow = { databasePending: false, selection: null, linked: false };
    reply({ deployment: "docker", flow });
    expect((await setupApi.context()).flow).toEqual(flow);
  });
});
