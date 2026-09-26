import { describe, expect, it } from "vitest";
import { nextTabIndex, panelDomId, tabDomId } from "./tabsKeyboard";
import { resolveTab } from "../../hooks/useUrlTab";

describe("le clavier d'une liste d'onglets", () => {
  it("les flèches passent à l'onglet voisin et bouclent aux extrémités", () => {
    expect(nextTabIndex("ArrowRight", 0, 3)).toBe(1);
    expect(nextTabIndex("ArrowRight", 2, 3)).toBe(0);
    expect(nextTabIndex("ArrowLeft", 0, 3)).toBe(2);
    expect(nextTabIndex("ArrowLeft", 2, 3)).toBe(1);
  });

  it("Origine et Fin sautent au premier et au dernier onglet", () => {
    expect(nextTabIndex("Home", 2, 3)).toBe(0);
    expect(nextTabIndex("End", 0, 3)).toBe(2);
  });

  it("les autres touches ne concernent pas la liste — Tab sort vers le panneau", () => {
    expect(nextTabIndex("Tab", 1, 3)).toBeNull();
    expect(nextTabIndex("Enter", 1, 3)).toBeNull();
    expect(nextTabIndex("ArrowDown", 1, 3)).toBeNull();
  });

  it("une liste vide ne propose aucun déplacement", () => {
    expect(nextTabIndex("ArrowRight", 0, 0)).toBeNull();
  });

  it("l'onglet et son panneau portent des identifiants reliés et distincts", () => {
    expect(tabDomId("p", "sources")).toBe("p-tab-sources");
    expect(panelDomId("p", "sources")).toBe("p-panel-sources");
  });
});

describe("l'onglet lu dans l'adresse", () => {
  const TABS = ["installed", "marketplace", "sources"] as const;

  it("une valeur connue ouvre son onglet", () => {
    expect(resolveTab("sources", TABS, "installed")).toBe("sources");
  });

  it("sans paramètre, l'onglet par défaut", () => {
    expect(resolveTab(null, TABS, "installed")).toBe("installed");
  });

  it("une valeur inconnue — vieux lien, faute de frappe — retombe sur le défaut", () => {
    expect(resolveTab("market", TABS, "installed")).toBe("installed");
    expect(resolveTab("", TABS, "installed")).toBe("installed");
  });
});
