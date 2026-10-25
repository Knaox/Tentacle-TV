import { describe, expect, it } from "vitest";
import {
  PLUGIN_NAV_LABEL_MAX,
  mergeNavigation,
  normalizeNavLabel,
  readNavigationDoc,
  readNavigationRoute,
} from "./pluginNavigation";

const NAV = [
  { path: "/x/page", icon: "clock", platforms: ["web"], labels: { fr: "Extension", en: "Extension" } },
  { path: "/admin/plugins/x", icon: "settings", admin: true, platforms: ["web"], labels: { fr: "X", en: "X" } },
];

describe("route navigation du manifeste", () => {
  it("lit un chemin sûr, refuse le reste", () => {
    expect(readNavigationRoute({ navigation: "/navigation" })).toBe("/navigation");
    expect(readNavigationRoute({ navigation: "navigation" })).toBeNull();
    expect(readNavigationRoute({ navigation: "//evil" })).toBeNull();
    expect(readNavigationRoute({ navigation: "/../x" })).toBeNull();
    expect(readNavigationRoute({})).toBeNull();
    expect(readNavigationRoute(null)).toBeNull();
  });
});

describe("nom de page en texte nu", () => {
  it("resserre et rogne les espaces", () => {
    expect(normalizeNavLabel("  Ma   musique ")).toBe("Ma musique");
  });
  it("refuse le vide, le trop long, le balisage et les contrôles", () => {
    expect(normalizeNavLabel("   ")).toBeNull();
    expect(normalizeNavLabel("a".repeat(PLUGIN_NAV_LABEL_MAX + 1))).toBeNull();
    expect(normalizeNavLabel("<b>Musique</b>")).toBeNull();
    expect(normalizeNavLabel("Mu\u0000sique")).toBeNull();
    expect(normalizeNavLabel(42)).toBeNull();
  });
  it("compte les caractères, pas les unités UTF-16", () => {
    expect(normalizeNavLabel("🎵".repeat(PLUGIN_NAV_LABEL_MAX))).toBe("🎵".repeat(PLUGIN_NAV_LABEL_MAX));
  });
});

describe("document de navigation", () => {
  it("lit la forme du contrat", () => {
    expect(readNavigationDoc({ items: [{ path: "/x/page", label: " Mes sons ", primary: false }] }))
      .toEqual({ items: [{ path: "/x/page", label: "Mes sons", primary: false }] });
    expect(readNavigationDoc({ items: [{ path: "/x/page", label: null, primary: true }] }))
      .toEqual({ items: [{ path: "/x/page", label: null, primary: true }] });
  });
  it("refuse tout le document au moindre écart", () => {
    expect(readNavigationDoc({ items: [{ path: "/x/page", label: "<i>", primary: true }] })).toBeNull();
    expect(readNavigationDoc({ items: [{ path: "/x/page", label: null }] })).toBeNull();
    expect(readNavigationDoc({ items: [{ path: "x", label: null, primary: true }] })).toBeNull();
    expect(readNavigationDoc({ items: "nope" })).toBeNull();
    expect(readNavigationDoc("nope")).toBeNull();
  });
});

describe("fusion dans les navItems", () => {
  it("sans document : la liste d'avant, intacte", () => {
    expect(mergeNavigation(NAV, null)).toEqual(NAV);
  });
  it("pose primary et remplace les libellés par le nom choisi", () => {
    const [page, admin] = mergeNavigation(NAV, { items: [{ path: "/x/page", label: "Mes sons", primary: false }] });
    expect(page).toEqual({ path: "/x/page", icon: "clock", platforms: ["web"], label: "Mes sons", primary: false });
    expect(admin).toEqual(NAV[1]);
  });
  it("nom absent : les libellés du manifeste restent", () => {
    const [page] = mergeNavigation(NAV, { items: [{ path: "/x/page", label: null, primary: true }] });
    expect(page).toEqual({ ...NAV[0], primary: true });
  });
  it("une page d'administration ne se règle jamais", () => {
    const [, admin] = mergeNavigation(NAV, { items: [{ path: "/admin/plugins/x", label: "Pirate", primary: true }] });
    expect(admin).toEqual(NAV[1]);
  });
});
