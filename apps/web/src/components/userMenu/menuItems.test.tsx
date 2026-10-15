import { describe, expect, it } from "vitest";
import {
  AVATAR_GRADIENT_BG,
  AVATAR_RING_STYLE,
  avatarBackgroundFor,
  avatarRingStyleFor,
  buildUserMenuGroups,
  buildUserMenuItems,
  menuProfileItems,
  type UserMenuItem,
} from "./menuItems";

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
    expect(member).toEqual(["stats", "settings", "help", "about"]);
    const guest = buildUserMenuItems({ ...all, profileSession: { guest: true } }).map((i) => i.key);
    expect(guest).toEqual(["stats", "settings", "about"]);
  });
});

/** Les familles et leurs entrées, par clés : `{ account: [...], device: [...] }`. */
function shape(opts: Parameters<typeof buildUserMenuGroups>[0]): Record<string, string[]> {
  return Object.fromEntries(buildUserMenuGroups(opts).map((group) => [group.key, group.items.map((item) => item.key)]));
}

describe("les familles du menu", () => {
  const everything = { ...base, isAdmin: true, onDevice: true, goOffline: () => undefined };

  it("tout est là : moi, cet appareil, l'aide, puis la déconnexion seule, dans cet ordre", () => {
    expect(buildUserMenuGroups(everything).map((group) => group.key)).toEqual(["account", "device", "support", "session"]);
    expect(shape(everything)).toEqual({
      account: ["stats", "settings", "admin"],
      device: ["onDevice", "goOffline", "pair"],
      support: ["help", "about"],
      session: ["logout"],
    });
  });

  it("aucune famille ne dépasse trois entrées", () => {
    for (const group of buildUserMenuGroups({ ...everything, extended: true })) {
      expect(group.items.length).toBeLessThanOrEqual(3);
    }
  });

  it("l'administration ne paraît que pour un administrateur", () => {
    expect(shape({ ...everything, isAdmin: false }).account).toEqual(["stats", "settings"]);
  });

  it("« Sur cet appareil » et « Passer hors ligne » ne paraissent que si l'appareil les offre", () => {
    expect(shape({ ...base }).device).toEqual(["pair"]);
    expect(shape({ ...base, onDevice: true }).device).toEqual(["onDevice", "pair"]);
    expect(shape({ ...base, goOffline: () => undefined }).device).toEqual(["goOffline", "pair"]);
  });

  it("hors ligne : seules les destinations que le routeur sert, la famille de l'appareil disparaît", () => {
    expect(shape({ ...everything, offline: true, goOffline: undefined })).toEqual({
      account: ["settings"],
      support: ["about"],
      session: ["logout"],
    });
  });

  it("la feuille (`extended`) ajoute les crédits à l'aide", () => {
    expect(shape({ ...base, extended: true }).support).toEqual(["help", "about", "credits"]);
  });

  it("session d'un profil : la famille de l'appareil et la déconnexion disparaissent entières", () => {
    expect(shape({ ...everything, profileSession: { guest: false } })).toEqual({
      account: ["stats", "settings"],
      support: ["help", "about"],
    });
    expect(shape({ ...everything, profileSession: { guest: true } })).toEqual({
      account: ["stats", "settings"],
      support: ["about"],
    });
  });

  it("chaque destination garde sa route", () => {
    const visited: string[] = [];
    for (const item of buildUserMenuItems({ ...everything, extended: true, goOffline: undefined, navigate: (p) => visited.push(p) })) {
      if (item.key !== "logout") item.action();
    }
    expect(visited).toEqual(["/stats", "/settings", "/admin", "/on-device", "/pair-device", "/support", "/about", "/credits"]);
  });
});

describe("les profils dans le menu", () => {
  const entry = (key: string): UserMenuItem => ({ key, label: key, icon: null, action: () => undefined });

  it("ne garde que « Changer de profil » : « Gérer les profils » vit sur « Qui regarde ? » et dans Paramètres › Famille", () => {
    expect(menuProfileItems([entry("switchProfile"), entry("manageProfiles")]).map((i) => i.key)).toEqual(["switchProfile"]);
    expect(menuProfileItems([])).toEqual([]);
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
