import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { accountToken, accountUserId, profileMarkerIn, readActiveProfile, rememberActiveProfilePhoto } from "./profileSession";

/**
 * La marque d'une session de profil du bureau ne vaut que pour la session
 * ACTIVE de son profil. Une sortie qui ignore ces clés (`useAuth().logout`
 * depuis l'écran hors ligne, un changement de serveur) les laisse derrière
 * elle : la connexion suivante d'un autre compte ne doit jamais devenir un
 * « profil » — ni montrer l'interface d'un profil, ni lister la famille avec
 * le jeton personnel d'un autre compte resté en réserve.
 */

class MemoryStorage {
  private readonly map = new Map<string, string>();
  getItem(key: string) { return this.map.get(key) ?? null; }
  setItem(key: string, value: string) { this.map.set(key, String(value)); }
  removeItem(key: string) { this.map.delete(key); }
}

const LEA_MARKER = JSON.stringify({ id: "lea", name: "Léa", kind: "guest", color: "pink", imageTag: null, hasPin: false });
const LEA_USER = JSON.stringify({ Id: "lea", Name: "Léa", Policy: { IsAdministrator: false } });
const OWNER_USER = JSON.stringify({ Id: "owner", Name: "Damien", Policy: { IsAdministrator: true } });
const OLD_STASH = JSON.stringify({ token: "jeton-perso-ancien", user: OWNER_USER, deviceId: null });

let local: MemoryStorage;

beforeEach(() => {
  local = new MemoryStorage();
  vi.stubGlobal("localStorage", local);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("la marque d'une session de profil", () => {
  it("aucune marque : la session personnelle", () => {
    local.setItem("tentacle_user", OWNER_USER);
    expect(profileMarkerIn(local).state).toBe("none");
  });

  it("la marque du profil dont la session est active : le profil", () => {
    local.setItem("tentacle_token", "jeton-lea");
    local.setItem("tentacle_user", LEA_USER);
    local.setItem("tentacle_profile_session", LEA_MARKER);
    local.setItem("tentacle_account_session", OLD_STASH);
    expect(profileMarkerIn(local)).toMatchObject({ state: "active", profile: { id: "lea", kind: "guest" } });
    expect(readActiveProfile()?.id).toBe("lea");
    expect(accountToken()).toBe("jeton-perso-ancien");
    expect(accountUserId()).toBe("owner");
  });

  it("une marque illisible le reste", () => {
    local.setItem("tentacle_user", LEA_USER);
    local.setItem("tentacle_profile_session", "{pas du json");
    expect(profileMarkerIn(local).state).toBe("unreadable");
  });

  it("la marque restée d'une session passée, un autre compte connecté depuis : ignorée", () => {
    // Déconnexion depuis l'écran hors ligne pendant le profil de Léa (jeton et
    // compte effacés, marque et réserve oubliées là), puis connexion du compte.
    local.setItem("tentacle_profile_session", LEA_MARKER);
    local.setItem("tentacle_account_session", OLD_STASH);
    local.setItem("tentacle_token", "jeton-perso-neuf");
    local.setItem("tentacle_user", OWNER_USER);
    expect(profileMarkerIn(local).state).toBe("stale");
    expect(readActiveProfile()).toBeNull();
    // Le jeton personnel est celui de la session ACTIVE, jamais la vieille réserve.
    expect(accountToken()).toBe("jeton-perso-neuf");
    expect(accountUserId()).toBe("owner");
  });
});

describe("la photo d'un invité posée pendant SA session (serveur 1.30.0)", () => {
  it("la marque et le compte du profil la portent aussitôt ; la session reste la sienne", () => {
    local.setItem("tentacle_token", "jeton-lea");
    local.setItem("tentacle_user", LEA_USER);
    local.setItem("tentacle_profile_session", LEA_MARKER);
    local.setItem("tentacle_account_session", OLD_STASH);
    rememberActiveProfilePhoto("tag-lanterne");
    expect(readActiveProfile()).toMatchObject({ id: "lea", imageTag: "tag-lanterne" });
    expect(JSON.parse(local.getItem("tentacle_user") ?? "{}")).toMatchObject({ Id: "lea", PrimaryImageTag: "tag-lanterne" });
    expect(accountToken()).toBe("jeton-perso-ancien");
  });

  it("en session personnelle : rien à retenir, rien d'écrit", () => {
    local.setItem("tentacle_user", OWNER_USER);
    rememberActiveProfilePhoto("tag-lanterne");
    expect(local.getItem("tentacle_profile_session")).toBeNull();
    expect(JSON.parse(local.getItem("tentacle_user") ?? "{}").PrimaryImageTag).toBeUndefined();
  });
});
