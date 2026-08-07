import { afterEach, describe, expect, it, vi } from "vitest";
import { revalidateSession } from "./sessionGuard";

/** Le verdict de session est le seul motif de déconnexion du client : chacune
 *  de ces branches se paie en session perdue à tort, ou en session zombie. */

function mockFetch(response: Partial<Response> & { json?: () => Promise<unknown> }) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response as Response));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("revalidateSession", () => {
  it("valide une réponse portant un AccessToken", async () => {
    mockFetch({ ok: true, status: 200, json: async () => ({ AccessToken: "abc", User: {} }) });
    await expect(revalidateSession()).resolves.toBe("ok");
  });

  it("conclut à l'expiration sur un 401 — seul refus explicite", async () => {
    mockFetch({ ok: false, status: 401, json: async () => ({ message: "Token invalide" }) });
    await expect(revalidateSession()).resolves.toBe("expired");
  });

  it("conserve la session quand Jellyfin redémarre (503)", async () => {
    mockFetch({ ok: false, status: 503, json: async () => ({ message: "Jellyfin indisponible" }) });
    await expect(revalidateSession()).resolves.toBe("unreachable");
  });

  it("conserve la session sur erreur réseau", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Failed to fetch")));
    await expect(revalidateSession()).resolves.toBe("unreachable");
  });

  // Le piège du bureau : le repli monopage renvoie index.html en HTTP 200 pour
  // toute adresse inconnue. Un simple `res.ok` déclarait alors la session
  // valide quoi qu'il arrive — elle ne mourait jamais, et l'application restait
  // « connectée » devant des pages qui ne chargeaient pas.
  it("refuse de valider un index.html renvoyé en 200", async () => {
    mockFetch({ ok: true, status: 200, json: async () => { throw new SyntaxError("Unexpected token <"); } });
    await expect(revalidateSession()).resolves.toBe("unreachable");
  });

  it("refuse de valider un JSON sans AccessToken", async () => {
    mockFetch({ ok: true, status: 200, json: async () => ({ hello: "world" }) });
    await expect(revalidateSession()).resolves.toBe("unreachable");
  });

  // Le piège du bureau, deuxième acte. Là-bas il n'y a pas de cookie : le jeton
  // vit dans le stockage local. S'il ne part pas dans le corps, la requête
  // n'apporte aucune preuve d'identité et le serveur répond 401 « Token
  // manquant » — verdict « expirée » à tous les coups, donc déconnexion à
  // chaque démarrage.
  it("joint le jeton au corps quand il n'y a pas de cookie", async () => {
    mockFetch({ ok: true, status: 200, json: async () => ({ AccessToken: "abc", User: {} }) });
    await revalidateSession("jeton-du-bureau");
    const [, init] = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({ token: "jeton-du-bureau" });
    expect(init.credentials).toBe("include");
  });

  // Le navigateur n'a rien à joindre : son cookie httpOnly voyage seul, et lui
  // envoyer un corps ne ferait qu'exposer le jeton hors du cookie.
  it("n'envoie aucun corps quand le cookie fait foi", async () => {
    mockFetch({ ok: true, status: 200, json: async () => ({ AccessToken: "abc", User: {} }) });
    await revalidateSession(null);
    const [, init] = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init.body).toBeUndefined();
  });
});
