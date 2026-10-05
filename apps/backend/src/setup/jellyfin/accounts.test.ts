import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startFakeJellyfin, type FakeJellyfin } from "../../../test/setup/fakeJellyfin";
import { authenticate, createTentacleKey, signOut, verifyApiKey } from "./accounts";
import { configureJellyfinGuard } from "./guardedFetch";

let jf: FakeJellyfin;
beforeAll(async () => {
  jf = await startFakeJellyfin();
  configureJellyfinGuard({ allowLoopback: true });
});
afterAll(() => jf.close());
beforeEach(() => jf.requests.splice(0));

const codeOf = async (run: () => Promise<unknown>) => run().then(() => undefined, (err: { code?: string }) => err.code);

describe("comptes et clé d'API", () => {
  it("connexion : le jeton, l'identité, le rôle — mot de passe envoyé à Jellyfin seulement", async () => {
    jf.on("POST /Users/AuthenticateByName", ({ body }) =>
      (body as { Pw?: string }).Pw === "bon"
        ? { status: 200, json: { AccessToken: "jeton", User: { Id: "u1", Name: "Damien", Policy: { IsAdministrator: true } } } }
        : { status: 401 },
    );
    expect(await authenticate(jf.url, "Damien", "bon")).toEqual({ id: "u1", name: "Damien", isAdmin: true, token: "jeton" });
    expect(await codeOf(() => authenticate(jf.url, "Damien", "faux"))).toBe("jf_bad_credentials");
    expect(String(jf.requests[0].headers.authorization)).toMatch(/^MediaBrowser Client="Tentacle TV", Device="Setup"/);
  });

  it("la NOUVELLE clé « Tentacle » est retrouvée, jamais celle d'un autre serveur", async () => {
    let keys = [{ AccessToken: "autre-serveur", AppName: "Tentacle" }, { AccessToken: "k0", AppName: "Kodi" }];
    jf.on("GET /Auth/Keys", () => ({ status: 200, json: { Items: keys, TotalRecordCount: keys.length } }));
    jf.on("POST /Auth/Keys", ({ query }) => {
      keys = [...keys, { AccessToken: "la-notre", AppName: query.get("app") ?? "" }];
      return { status: 204 };
    });
    expect(await createTentacleKey(jf.url, "jeton-admin")).toBe("la-notre");
    expect(jf.calls("POST /Auth/Keys")[0].query.get("app")).toBe("Tentacle");
  });

  it("un compte non administrateur ne crée pas de clé", async () => {
    jf.on("GET /Auth/Keys", { status: 403 });
    expect(await codeOf(() => createTentacleKey(jf.url, "jeton"))).toBe("jf_not_admin");
  });

  it("une clé collée doit ouvrir l'administration", async () => {
    jf.on("GET /Auth/Keys", ({ headers }) =>
      headers.authorization === 'MediaBrowser Token="bonne"' ? { status: 200, json: { Items: [] } } : { status: 401 },
    );
    await expect(verifyApiKey(jf.url, "bonne")).resolves.toBeUndefined();
    expect(await codeOf(() => verifyApiKey(jf.url, "fausse"))).toBe("jf_api_key_invalid");
  });

  it("la session de l'assistant est refermée", async () => {
    jf.on("POST /Sessions/Logout", { status: 204 });
    await signOut(jf.url, "jeton");
    expect(String(jf.calls("POST /Sessions/Logout")[0].headers.authorization)).toContain('Token="jeton"');
  });
});
