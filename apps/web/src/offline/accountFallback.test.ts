import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Bureau : plus de connexion pendant la session d'un profil (membre ou invité)
 * → l'application revient d'elle-même au compte de l'appareil, sans « Qui
 * regarde ? » exigé, et le dit une fois. Le navigateur (jeton du compte tenu
 * par le serveur) ne le peut pas : rien ne bouge.
 */

class MemoryStorage {
  private readonly map = new Map<string, string>();
  getItem(key: string) { return this.map.get(key) ?? null; }
  setItem(key: string, value: string) { this.map.set(key, String(value)); }
  removeItem(key: string) { this.map.delete(key); }
}

const OWNER_USER = JSON.stringify({ Id: "owner", Name: "Damien" });
let local: MemoryStorage;
let session: MemoryStorage;
const assign = vi.fn();

const { fallBackToAccount, readAccountFallbackNotice, clearAccountFallbackNotice } = await import("./accountFallback");
const { isProfileSwitching, cancelProfileSwitch } = await import("../auth/profileEnded");
const { notifyProfileSessionChange } = await import("../auth/profileSession");

function openProfile(kind: "member" | "guest", stash: Record<string, unknown>): void {
  local.setItem("tentacle_account_session", JSON.stringify(stash));
  local.setItem("tentacle_token", `jeton-${kind}`);
  local.setItem("tentacle_user", JSON.stringify({ Id: kind, Name: kind }));
  local.setItem("tentacle_profile_session", JSON.stringify({ id: kind, name: kind, kind, color: "teal", imageTag: null, hasPin: true }));
  notifyProfileSessionChange();
}

beforeEach(() => {
  local = new MemoryStorage();
  session = new MemoryStorage();
  vi.stubGlobal("localStorage", local);
  vi.stubGlobal("sessionStorage", session);
  vi.stubGlobal("window", { location: { assign } });
  assign.mockClear();
  cancelProfileSwitch();
  local.setItem("tentacle_token", "jeton-compte");
  local.setItem("tentacle_user", OWNER_USER);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fallBackToAccount", () => {
  for (const kind of ["member", "guest"] as const) {
    it(`le profil d'un ${kind === "member" ? "membre" : "invité"} : retour au compte, l'accueil, le message`, () => {
      openProfile(kind, { token: "jeton-compte", user: OWNER_USER, deviceId: null });
      local.setItem("tentacle_query_cache_v1", "{}");
      expect(fallBackToAccount()).toBe(true);
      expect(local.getItem("tentacle_token")).toBe("jeton-compte");
      expect(local.getItem("tentacle_profile_session")).toBeNull();
      expect(local.getItem("tentacle_account_session")).toBeNull();
      expect(local.getItem("tentacle_query_cache_v1")).toBeNull();
      expect(assign).toHaveBeenCalledWith("/");
      // « Qui regarde ? » tenu pour fait dans cette exécution : rien ne s'impose au retour du réseau.
      expect(session.getItem("tentacle_profile_launch_passed")).toBe("1");
      expect(session.getItem("tentacle_profile_picker_request")).toBeNull();
      expect(readAccountFallbackNotice()).toBe("Damien");
      clearAccountFallbackNotice();
      expect(readAccountFallbackNotice()).toBeNull();
    });
  }

  it("le navigateur, dont le serveur tient le jeton : rien ne bouge", () => {
    openProfile("member", { token: null, user: OWNER_USER, deviceId: null, held: "server" });
    expect(fallBackToAccount()).toBe(false);
    expect(local.getItem("tentacle_token")).toBe("jeton-member");
    expect(assign).not.toHaveBeenCalled();
    expect(isProfileSwitching()).toBe(false);
  });

  it("la session du compte : rien à faire", () => {
    notifyProfileSessionChange();
    expect(fallBackToAccount()).toBe(false);
    expect(assign).not.toHaveBeenCalled();
  });
});
