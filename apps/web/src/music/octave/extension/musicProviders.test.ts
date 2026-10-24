import { describe, expect, it } from "vitest";
import { asMusicEvent } from "../events/useMusicEvents";
import { musicProvidersOf, providerSectionLabel } from "./musicProviders";

const music = { search: "/music/search", resolve: "/music/resolve", like: "/music/like", labels: { fr: "Pas encore dans la bibliothèque" } };

describe("extensions musique : aucune trace sans garde complète", () => {
  it("rien sans la capacité du runtime isolé", () => {
    expect(musicProvidersOf(false, [{ pluginId: "x", name: "X", configEnabled: true, music } as never])).toEqual([]);
  });

  it("rien pour une extension non configurée, sans contrat, ou au contrat invalide", () => {
    const metas = [
      { pluginId: "a", name: "A", configEnabled: false, music },
      { pluginId: "b", name: "B", configEnabled: true },
      { pluginId: "c", name: "C", configEnabled: true, music: { search: "/s" } },
      { pluginId: "d", name: "D", configEnabled: true, music: { search: "//x", resolve: "/r" } },
    ];
    expect(musicProvidersOf(true, metas as never)).toEqual([]);
  });

  it("une extension active, configurée et au contrat valide est proposée", () => {
    const [p] = musicProvidersOf(true, [{ pluginId: "x", name: "X", configEnabled: true, music } as never]);
    expect(p?.manifest.like).toBe("/music/like");
    expect(providerSectionLabel(p!, "fr-FR", "défaut")).toBe("Pas encore dans la bibliothèque");
    expect(providerSectionLabel(p!, "en", "default")).toBe("default");
  });
});

describe("événements music:*", () => {
  it("seuls les types de la liste fermée passent", () => {
    expect(asMusicEvent({ type: "music:resolved", pluginId: "x" })?.type).toBe("music:resolved");
    expect(asMusicEvent({ type: "music:inconnu" })).toBeNull();
    expect(asMusicEvent({ type: "home:update" })).toBeNull();
    expect(asMusicEvent(null)).toBeNull();
  });
});
