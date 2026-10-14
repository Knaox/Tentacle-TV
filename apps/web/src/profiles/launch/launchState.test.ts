import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { launchPassed, noteFreshLogin } from "./launchState";

/**
 * Une connexion par mot de passe pendant l'exécution : le choix du profil est
 * fait (la session personnelle), et rien d'une session de profil passée ne
 * survit — ni sa marque, ni la réserve (le jeton personnel) d'un compte.
 */

class MemoryStorage {
  private readonly map = new Map<string, string>();
  getItem(key: string) { return this.map.get(key) ?? null; }
  setItem(key: string, value: string) { this.map.set(key, String(value)); }
  removeItem(key: string) { this.map.delete(key); }
}

let local: MemoryStorage;
let session: MemoryStorage;

beforeEach(() => {
  local = new MemoryStorage();
  session = new MemoryStorage();
  vi.stubGlobal("localStorage", local);
  vi.stubGlobal("sessionStorage", session);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("une connexion par mot de passe", () => {
  it("oublie la session de profil restée d'avant, et vaut choix fait", () => {
    // Le profil de Bob ouvert par Alice, quitté par une déconnexion qui ignorait
    // ces clés : la réserve d'Alice traîne encore. Bob se connecte, à son nom.
    local.setItem("tentacle_profile_session", JSON.stringify({ id: "bob", name: "Bob", kind: "member", color: "teal" }));
    local.setItem("tentacle_account_session", JSON.stringify({ token: "jeton-alice", user: "{\"Id\":\"alice\"}" }));
    local.setItem("tentacle_token", "jeton-bob");
    local.setItem("tentacle_user", JSON.stringify({ Id: "bob", Name: "Bob" }));
    noteFreshLogin();
    expect(local.getItem("tentacle_profile_session")).toBeNull();
    expect(local.getItem("tentacle_account_session")).toBeNull();
    expect(local.getItem("tentacle_token")).toBe("jeton-bob");
    expect(launchPassed()).toBe(true);
  });
});
