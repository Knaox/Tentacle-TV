import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startFakeJellyfin, type FakeJellyfin } from "../../../test/setup/fakeJellyfin";
import { configureJellyfinGuard } from "./guardedFetch";
import { adoptProvisionalAdmin, applyServerLocale, isValidJellyfinUsername, runJellyfinStartup } from "./startup";

let jf: FakeJellyfin;
beforeAll(async () => {
  jf = await startFakeJellyfin();
  configureJellyfinGuard({ allowLoopback: true });
});
afterAll(() => jf.close());
beforeEach(() => jf.requests.splice(0));

const LOCALE = { uiCulture: "fr-FR", metadataCountry: "CH", metadataLanguage: "fr" };
const codeOf = async (run: () => Promise<unknown>) => run().then(() => undefined, (err: { code?: string }) => err.code);

describe("assistant de Jellyfin par l'API", () => {
  it("la séquence relue dans le source : configuration, compte, accès distant sans UPnP, fin", async () => {
    for (const route of ["POST /Startup/Configuration", "POST /Startup/User", "POST /Startup/RemoteAccess", "POST /Startup/Complete"]) {
      jf.on(route, { status: 204 });
    }
    jf.on("GET /Startup/User", { status: 200, json: { Name: "root" } });
    await runJellyfinStartup(jf.url, { username: "Damien", password: "motdepasse" }, { ...LOCALE, serverName: "Salon" });
    expect(jf.requests.map((r) => `${r.method} ${r.path}`)).toEqual([
      "POST /Startup/Configuration", "GET /Startup/User", "POST /Startup/User", "POST /Startup/RemoteAccess", "POST /Startup/Complete",
    ]);
    expect(jf.requests[0].body).toEqual({ UICulture: "fr-FR", MetadataCountryCode: "CH", PreferredMetadataLanguage: "fr", ServerName: "Salon" });
    expect(jf.requests[2].body).toEqual({ Name: "Damien", Password: "motdepasse" });
    expect(jf.requests[3].body).toEqual({ EnableRemoteAccess: true, EnableAutomaticPortMapping: false });
  });

  it("un Jellyfin qui n'est plus vierge refuse, et le dit", async () => {
    jf.on("POST /Startup/Configuration", { status: 401 });
    expect(await codeOf(() => runJellyfinStartup(jf.url, { username: "a", password: "b" }, LOCALE))).toBe("jf_not_blank");
  });

  it("l'administrateur provisoire prend le nom et le mot de passe choisis, par la clé", async () => {
    jf.on("GET /Users/u1", { status: 200, json: { Id: "u1", Name: "tentacle-setup", Configuration: { AudioLanguagePreference: "" } } });
    jf.on("POST /Users", { status: 204 });
    jf.on("POST /Users/Password", { status: 204 });
    await adoptProvisionalAdmin(jf.url, "cle", "u1", { username: "Damien", password: "motdepasse" });
    const rename = jf.calls("POST /Users")[0];
    expect(rename.query.get("userId")).toBe("u1");
    expect(rename.body).toEqual({ Id: "u1", Name: "Damien", Configuration: { AudioLanguagePreference: "" } });
    expect(jf.calls("POST /Users/Password")[0].body).toEqual({ NewPw: "motdepasse", ResetPassword: false });
    expect(rename.headers.authorization).toBe('MediaBrowser Token="cle"');
  });

  it("la langue choisie, posée sur la configuration entière", async () => {
    jf.on("GET /System/Configuration", { status: 200, json: { UICulture: "en-US", EnableMetrics: false } });
    jf.on("POST /System/Configuration", { status: 204 });
    await applyServerLocale(jf.url, "cle", LOCALE);
    expect(jf.calls("POST /System/Configuration")[0].body).toEqual({
      UICulture: "fr-FR", EnableMetrics: false, MetadataCountryCode: "CH", PreferredMetadataLanguage: "fr",
    });
  });

  it("les noms que Jellyfin accepte, en 10.10 comme en 12", () => {
    for (const ok of ["Damien", "marie.dupont", "Zoé_2", "o'neil", "a b", "x@y"]) expect(isValidJellyfinUsername(ok), ok).toBe(true);
    for (const bad of [" lead", "trail ", ".", "..", "a/b", "c+d", "", "x".repeat(65)]) expect(isValidJellyfinUsername(bad), bad).toBe(false);
  });
});
