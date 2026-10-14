import { describe, expect, it } from "vitest";
import { AVATAR_GRADIENT_BG, AVATAR_RING_STYLE, avatarBackgroundFor, avatarRingStyleFor, buildUserMenuItems } from "./menuItems";

const base = { t: (k: string) => k, isAdmin: false, navigate: () => undefined, handleLogout: () => undefined };

describe("le menu utilisateur", () => {
  it("ouvre sur « Mes statistiques » en ligne, puis les préférences", () => {
    const keys = buildUserMenuItems(base).map((i) => i.key);
    expect(keys.slice(0, 2)).toEqual(["stats", "settings"]);
  });

  it("retire les statistiques hors ligne : la route les refuse", () => {
    const keys = buildUserMenuItems({ ...base, offline: true }).map((i) => i.key);
    expect(keys).not.toContain("stats");
    expect(keys[0]).toBe("settings");
  });

  it("mène à /stats", () => {
    const visited: string[] = [];
    const stats = buildUserMenuItems({ ...base, navigate: (p) => visited.push(p) }).find((i) => i.key === "stats");
    stats?.action();
    expect(visited).toEqual(["/stats"]);
  });

  it("une session de profil n'offre ni administration, ni jumelage, ni contenu gardé, ni déconnexion", () => {
    const all = { ...base, isAdmin: true, onDevice: true, goOffline: () => undefined };
    expect(buildUserMenuItems(all).map((i) => i.key)).toEqual(
      expect.arrayContaining(["admin", "pair", "onDevice", "goOffline", "logout", "help"]),
    );
    const member = buildUserMenuItems({ ...all, profileSession: { guest: false } }).map((i) => i.key);
    expect(member).toEqual(["stats", "settings", "about", "help"]);
    const guest = buildUserMenuItems({ ...all, profileSession: { guest: true } }).map((i) => i.key);
    expect(guest).toEqual(["stats", "settings", "about"]);
  });
});

describe("le rond du compte", () => {
  it("sans famille : le dégradé de marque et son halo, comme avant", () => {
    expect(avatarRingStyleFor(null)).toBe(AVATAR_RING_STYLE);
    expect(avatarBackgroundFor(null)).toBe(AVATAR_GRADIENT_BG);
  });

  it("dans une famille : le dégradé du profil (celui de « Qui regarde ? ») et un halo de sa teinte", () => {
    expect(avatarRingStyleFor("orange")).toEqual({
      background: "linear-gradient(135deg, #c2410c, #ea580c)",
      boxShadow: "0 2px 12px #c2410c59",
    });
    expect(avatarBackgroundFor("orange")).toBe("linear-gradient(135deg, #c2410c, #ea580c)");
  });
});
