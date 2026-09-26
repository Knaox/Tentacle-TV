/**
 * La logique de la page Plugins : rapprocher par identifiant (le nom d'un
 * plugin installé n'est pas celui du catalogue), chercher, classer, et
 * refuser toute adresse qui ne soit pas du http(s).
 */

import { describe, expect, it } from "vitest";
import {
  availableUpdate,
  catalogCategories,
  catalogIndex,
  configRoute,
  humanizeSlug,
  iconImageUrl,
  monogram,
  navIconName,
  relativeTime,
  repoLink,
  safeHttpUrl,
  searchCatalog,
  sortCatalog,
} from "./pluginCatalog";
import type { InstalledPlugin, MarketplacePlugin } from "./types";

const entry = (over: Partial<MarketplacePlugin>): MarketplacePlugin => ({
  pluginId: "vigie", name: "Vigie — Jellyseerr (unofficial)", version: "1.16.0",
  description: "Demandez films et séries, suivez leur arrivée.", author: "Knaox",
  sourceId: "official", sourceName: "Officielle", official: true, installed: false,
  updateAvailable: false, ...over,
});

const installed = (over: Partial<InstalledPlugin>): InstalledPlugin => ({
  id: "0f3d", pluginId: "vigie", name: "Demandes — Jellyseerr (unofficial)", version: "1.15.1",
  sourceId: "official", enabled: true, config: {}, installedAt: "2026-07-27T20:00:49.962Z", ...over,
});

describe("availableUpdate", () => {
  it("rapproche par identifiant, même quand le nom a été réécrit", () => {
    const index = catalogIndex([entry({})]);
    expect(availableUpdate(installed({}), index.get("vigie"))).toBe("1.16.0");
  });

  it("ne propose ni la même version, ni une plus ancienne", () => {
    expect(availableUpdate(installed({ version: "1.16.0" }), entry({}))).toBeNull();
    expect(availableUpdate(installed({ version: "1.17.0" }), entry({}))).toBeNull();
  });

  it("ignore une entrée venue d'une autre source que celle d'installation", () => {
    expect(availableUpdate(installed({ sourceId: "mirror" }), entry({}))).toBeNull();
    expect(availableUpdate(installed({}), undefined)).toBeNull();
  });
});

describe("searchCatalog", () => {
  const catalog = [
    entry({ pluginId: "stats", name: "Statistiques", description: "Temps de visionnage", tags: ["charts"], official: false }),
    entry({ pluginId: "vigie", tags: ["requests", "overseerr"] }),
    entry({ pluginId: "trakt", name: "Trakt Sync", description: "Synchronise l'historique et les statistiques", author: "Autre" }),
  ];

  it("sans recherche, l'ordre d'origine", () => {
    expect(searchCatalog(catalog, "  ").map((e) => e.pluginId)).toEqual(["stats", "vigie", "trakt"]);
  });

  it("le nom l'emporte sur la description, accents et casse ignorés", () => {
    expect(searchCatalog(catalog, "STATISTIQUES").map((e) => e.pluginId)).toEqual(["stats", "trakt"]);
    expect(searchCatalog(catalog, "arrivee").map((e) => e.pluginId)).toEqual(["vigie"]);
  });

  it("trouve par mot-clé, par identifiant et par auteur", () => {
    expect(searchCatalog(catalog, "overseerr").map((e) => e.pluginId)).toEqual(["vigie"]);
    expect(searchCatalog(catalog, "trakt").map((e) => e.pluginId)).toEqual(["trakt"]);
    expect(searchCatalog(catalog, "autre").map((e) => e.pluginId)).toEqual(["trakt"]);
  });

  it("ne rend rien de hors sujet", () => {
    expect(searchCatalog(catalog, "zzz")).toEqual([]);
  });
});

describe("catalogue", () => {
  it("compte les catégories, les plus fournies d'abord", () => {
    const list = [{ category: "media-management" }, { category: "tools" }, { category: "media-management" }, {}];
    expect(catalogCategories(list)).toEqual([{ id: "media-management", count: 2 }, { id: "tools", count: 1 }]);
  });

  it("donne un libellé lisible à une catégorie inconnue", () => {
    expect(humanizeSlug("media-management")).toBe("Media management");
    expect(humanizeSlug("home_automation")).toBe("Home automation");
  });

  it("range l'officiel d'abord, puis par nom", () => {
    const list = [entry({ pluginId: "b", name: "Beta", official: false }), entry({ pluginId: "z", name: "Zeta" }), entry({ pluginId: "a", name: "Alpha", official: false })];
    expect(sortCatalog(list).map((e) => e.pluginId)).toEqual(["z", "a", "b"]);
  });
});

describe("adresses venues d'un registre", () => {
  it("n'accepte que le http(s)", () => {
    expect(safeHttpUrl("https://example.com/a")).toBe("https://example.com/a");
    expect(safeHttpUrl("javascript:alert(1)")).toBeNull();
    expect(safeHttpUrl("data:text/html,<script>")).toBeNull();
    expect(safeHttpUrl("pas une adresse")).toBeNull();
  });

  it("un dépôt « propriétaire/dépôt » mène à GitHub", () => {
    expect(repoLink("Knaox/Tentacle-Plugin-Vigie")).toEqual({
      href: "https://github.com/Knaox/Tentacle-Plugin-Vigie",
      label: "Knaox/Tentacle-Plugin-Vigie",
    });
    expect(repoLink("https://gitlab.com/org/plugin/")).toEqual({ href: "https://gitlab.com/org/plugin/", label: "gitlab.com/org/plugin" });
    expect(repoLink("javascript:alert(1)")).toBeNull();
    expect(repoLink("")).toBeNull();
  });

  it("une icône est une image http(s) ou data:image, sinon le monogramme", () => {
    expect(iconImageUrl("https://cdn.test/icon.png")).toBe("https://cdn.test/icon.png");
    expect(iconImageUrl("data:image/png;base64,AAAA")).toBe("data:image/png;base64,AAAA");
    expect(iconImageUrl("data:text/html;base64,AAAA")).toBeNull();
    expect(iconImageUrl("compass")).toBeNull();
    expect(iconImageUrl("")).toBeNull();
  });

  it("le monogramme prend la première lettre ou le premier chiffre", () => {
    expect(monogram("« Demandes » — Jellyseerr")).toBe("D");
    expect(monogram("éclair")).toBe("É");
    expect(monogram("42 stats")).toBe("4");
    expect(monogram("—")).toBe("?");
  });
});

describe("navigation du plugin", () => {
  const navItems = [
    { path: "/admin/plugins/vigie", icon: "settings", platforms: ["web"], admin: true },
    { path: "/discover", icon: "compass", platforms: ["web", "mobile"] },
  ];

  it("l'icône de la carte est celle de la navigation", () => {
    expect(navIconName({ navItems })).toBe("compass");
    expect(navIconName({ navItems: [navItems[0]] })).toBe("settings");
    expect(navIconName({})).toBeNull();
  });

  it("« Configurer » mène à la page d'administration déclarée, sinon à la page par convention", () => {
    expect(configRoute({ pluginId: "vigie", navItems, hasBundle: true })).toBe("/admin/plugins/vigie");
    expect(configRoute({ pluginId: "stats", navItems: [navItems[1]], hasBundle: true })).toBe("/admin/plugins/stats");
    expect(configRoute({ pluginId: "stats", navItems: [], hasBundle: false })).toBeNull();
  });
});

describe("relativeTime", () => {
  const NOW = Date.parse("2026-09-27T12:00:00.000Z");
  const ago = (ms: number) => new Date(NOW - ms).toISOString();

  it("dit l'âge d'une lecture, de la seconde au jour", () => {
    expect(relativeTime(ago(20_000), NOW, "fr")).toBe("maintenant");
    expect(relativeTime(ago(5 * 60_000), NOW, "fr")).toBe("il y a 5 minutes");
    expect(relativeTime(ago(3 * 3_600_000), NOW, "en")).toBe("3 hours ago");
    expect(relativeTime(ago(26 * 3_600_000), NOW, "fr")).toBe("hier");
  });

  it("une date future vaut « maintenant », une date illisible rien", () => {
    expect(relativeTime(new Date(NOW + 120_000).toISOString(), NOW, "en")).toBe("now");
    expect(relativeTime("pas une date", NOW, "fr")).toBeNull();
  });
});
