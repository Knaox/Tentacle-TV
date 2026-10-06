import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { publicInfo, startFakeJellyfin, type FakeJellyfin } from "../../../test/setup/fakeJellyfin";

const config = vi.hoisted(() => new Map<string, string>());
vi.mock("../../services/configStore", () => ({
  getConfigValue: (key: string) => config.get(key),
  setConfigValue: async (key: string, value: string) => void config.set(key, value),
  deleteConfigValue: async (key: string) => void config.delete(key),
  detectAppState: async () => "setup_admin",
}));
vi.mock("../../services/jellyfinWs", () => ({ restartJellyfinWs: () => undefined }));

import { configureJellyfinGuard } from "../jellyfin/guardedFetch";
import { claimSiblingJellyfin, PROVISIONAL_ADMIN } from "./siblingClaim";

let jf: FakeJellyfin;
let keys: { AccessToken: string; AppName: string }[];
let firstUserPassword: string | null;
let wizardDone: boolean;

beforeAll(async () => {
  jf = await startFakeJellyfin();
  configureJellyfinGuard({ allowLoopback: true });
});
afterAll(() => jf.close());

beforeEach(() => {
  config.clear();
  jf.requests.splice(0);
  keys = [];
  firstUserPassword = null;
  wizardDone = false;
  jf.on("GET /System/Info/Public", () => publicInfo({ StartupWizardCompleted: wizardDone }));
  for (const route of ["POST /Startup/Configuration", "POST /Startup/RemoteAccess"]) jf.on(route, () => ({ status: wizardDone ? 401 : 204 }));
  jf.on("POST /Startup/Complete", ({ headers }) => {
    if (wizardDone && !headers.authorization) return { status: 401 };
    wizardDone = true;
    return { status: 204 };
  });
  jf.on("GET /Startup/User", { status: 200, json: { Name: "root" } });
  jf.on("POST /Startup/User", ({ body }) => {
    if (firstUserPassword) return { status: 403 };
    firstUserPassword = (body as { Password: string }).Password;
    return { status: 204 };
  });
  jf.on("POST /Users/AuthenticateByName", ({ body }) => {
    const { Username, Pw } = body as { Username: string; Pw: string };
    return Username === PROVISIONAL_ADMIN && Pw === firstUserPassword
      ? { status: 200, json: { AccessToken: "jeton", User: { Id: "u-prov", Name: Username, Policy: { IsAdministrator: true } } } }
      : { status: 401 };
  });
  jf.on("GET /Auth/Keys", ({ headers }) => (String(headers.authorization).includes("Token=") ? { status: 200, json: { Items: keys } } : { status: 401 }));
  jf.on("POST /Auth/Keys", () => {
    keys.push({ AccessToken: `cle-${keys.length + 1}`, AppName: "Tentacle" });
    return { status: 204 };
  });
  jf.on("POST /Sessions/Logout", { status: 204 });
});

// Le faux Jellyfin écoute sur 127.0.0.1 : une interface « du réseau de la pile » le couvre.
const sameNetwork = {
  resolve: async () => ["127.0.0.1"],
  interfaces: () => ({ eth0: [{ address: "127.0.0.2", netmask: "255.0.0.0", family: "IPv4" as const, mac: "", internal: false, cidr: "127.0.0.2/8" }] }),
};
const quick = { waitMs: 500, intervalMs: 50, log: () => undefined, network: sameNetwork };

describe("verrouillage du Jellyfin voisin (pile complète)", () => {
  it("vierge : administrateur provisoire, clé enregistrée, mot de passe provisoire oublié", async () => {
    expect(await claimSiblingJellyfin(jf.url, quick)).toBe("claimed");
    expect(wizardDone).toBe(true);
    expect(config.get("jellyfin_url")).toBe(jf.url);
    expect(config.get("jellyfin_api_key")).toBe("cle-1");
    expect(config.get("jellyfin_claim_user_id")).toBe("u-prov");
    expect(config.has("jellyfin_claim_secret")).toBe(false);
    expect(firstUserPassword).toMatch(/^[A-Za-z0-9_-]{32}$/);
  });

  it("déjà verrouillé par nous, clé valide : rien à refaire", async () => {
    await claimSiblingJellyfin(jf.url, quick);
    jf.requests.splice(0);
    expect(await claimSiblingJellyfin(jf.url, quick)).toBe("already");
    expect(jf.calls("POST /Auth/Keys")).toHaveLength(0);
  });

  it("le nom mène hors des réseaux de la pile : rien n'est verrouillé", async () => {
    const elsewhere = { ...quick, network: { ...sameNetwork, interfaces: () => ({}) } };
    expect(await claimSiblingJellyfin(jf.url, elsewhere)).toBe("elsewhere");
    expect(jf.calls("POST /Startup/User")).toHaveLength(0);
    expect(config.has("jellyfin_api_key")).toBe(false);
  });

  it("une base reprise garde un AUTRE Jellyfin : oublié, la pile reprend le sien", async () => {
    config.set("jellyfin_url", "http://172.16.1.30:8096");
    config.set("jellyfin_api_key", "cle-etrangere");
    config.set("jellyfin_server_id", "autre");
    expect(await claimSiblingJellyfin(jf.url, quick)).toBe("claimed");
    expect(config.get("jellyfin_url")).toBe(jf.url);
    expect(config.get("jellyfin_api_key")).toBe("cle-1");
  });

  it("configuré par quelqu'un d'autre : on n'y touche pas", async () => {
    wizardDone = true;
    expect(await claimSiblingJellyfin(jf.url, quick)).toBe("not-blank");
    expect(jf.calls("POST /Startup/User")).toHaveLength(0);
  });

  it("devancé entre la sonde et nous : rien de gardé", async () => {
    firstUserPassword = "celui-du-premier-venu";
    expect(await claimSiblingJellyfin(jf.url, quick)).toBe("not-blank");
    expect(config.has("jellyfin_claim_secret")).toBe(false);
    expect(config.has("jellyfin_api_key")).toBe(false);
  });

  it("reprise : compte posé, assistant de Jellyfin jamais fini — le même mot de passe sert", async () => {
    config.set("jellyfin_claim_secret", "secret-d-avant");
    firstUserPassword = "secret-d-avant";
    expect(await claimSiblingJellyfin(jf.url, quick)).toBe("claimed");
    expect(config.get("jellyfin_api_key")).toBe("cle-1");
    expect(wizardDone).toBe(true);
  });

  it("Jellyfin qui ne répond pas : l'assistant réessaiera", async () => {
    expect(await claimSiblingJellyfin("http://127.0.0.1:1", quick)).toBe("unreachable");
  });
});
