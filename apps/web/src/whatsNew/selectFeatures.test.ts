import { describe, expect, it } from "vitest";
import { resolveServerCapabilities } from "@tentacle-tv/shared";
import { forAudience, forClient, forServer, selectWhatsNewFeatures } from "./selectFeatures";
import type { WhatsNewFeature, WhatsNewRelease } from "./types";

const Scene = () => null;
const feature = (id: string): WhatsNewFeature => ({ id, kind: "new", titleKey: `${id}_title`, bodyKey: `${id}_body`, Scene });
const release = (version: string, ids: string[]): WhatsNewRelease => ({ version, features: ids.map(feature) });

// Volontairement dans le désordre : la sélection trie elle-même.
const REGISTRY = [
  release("1.21.0", ["a", "b"]),
  release("1.22.0", ["future"]),
  release("1.20.0", ["old"]),
  release("1.21.2", ["d"]),
  release("1.21.1", []),
];

describe("sélection des nouveautés à montrer", () => {
  it("tout ce qui est plus récent que la version vue, jusqu'à la courante, plus récent d'abord", () => {
    const selection = selectWhatsNewFeatures("1.21.2", "1.20.11", REGISTRY);
    expect(selection.features.map((f) => `${f.version}:${f.id}`)).toEqual(["1.21.2:d", "1.21.0:a", "1.21.0:b"]);
    expect(selection.to).toBe("1.21.2");
    expect(selection.from).toBe("1.20.11");
    expect(selection.spansReleases).toBe(true);
  });

  it("un registre en avance sur le bundle est exclu, une seule release ne « s'étend » pas", () => {
    const selection = selectWhatsNewFeatures("1.21.0", "1.20.11", REGISTRY);
    expect(selection.features.map((f) => f.id)).toEqual(["a", "b"]);
    expect(selection.spansReleases).toBe(false);
  });

  it("rien quand la version vue est la courante ou plus récente", () => {
    expect(selectWhatsNewFeatures("1.21.0", "1.21.0", REGISTRY).features).toEqual([]);
    expect(selectWhatsNewFeatures("1.21.0", "1.21.2", REGISTRY).features).toEqual([]);
  });

  it("plafonne en gardant les plus récentes", () => {
    const selection = selectWhatsNewFeatures("1.21.2", "1.19.0", REGISTRY, 2);
    expect(selection.features.map((f) => f.id)).toEqual(["d", "a"]);
  });

  it("sans bornes : tout le registre, pour revoir chaque scène", () => {
    const selection = selectWhatsNewFeatures(null, null, REGISTRY, Infinity);
    expect(selection.features.map((f) => f.id)).toEqual(["future", "d", "a", "b", "old"]);
    expect(selection.to).toBe("1.22.0");
  });
});

describe("nouveautés réservées aux administrateurs", () => {
  const adminOnly: WhatsNewFeature = { ...feature("dashboard"), audience: "admin" };
  const mixed: WhatsNewRelease[] = [{ version: "1.22.0", features: [feature("remote"), adminOnly] }];

  it("un administrateur voit tout", () => {
    expect(forAudience(mixed, true)[0]?.features.map((f) => f.id)).toEqual(["remote", "dashboard"]);
  });

  it("les autres ne voient pas ce qui leur parlerait d'un écran qu'ils n'ont pas", () => {
    expect(forAudience(mixed, false)[0]?.features.map((f) => f.id)).toEqual(["remote"]);
    const onlyAdmin: WhatsNewRelease[] = [{ version: "1.22.0", features: [adminOnly] }];
    expect(selectWhatsNewFeatures("1.22.0", "1.21.4", forAudience(onlyAdmin, false)).features).toEqual([]);
  });
});

describe("nouveautés qui exigent une capacité du serveur", () => {
  const preview: WhatsNewFeature = { ...feature("preview"), capability: "trailers.preview" };
  const profiles: WhatsNewFeature = { ...feature("profiles"), capability: "family.desktopProfiles" };
  const plain = feature("plain");
  const registry: WhatsNewRelease[] = [{ version: "1.29.0", features: [preview, profiles, plain] }];

  it("un serveur qui ne déclare rien (≤ 1.23) : elles sont absentes, sans erreur", () => {
    const none = resolveServerCapabilities({ version: "1.23.0" });
    expect(forServer(registry, none)[0]?.features.map((f) => f.id)).toEqual(["plain"]);
    const onlyServer: WhatsNewRelease[] = [{ version: "1.29.0", features: [preview, profiles] }];
    expect(selectWhatsNewFeatures("1.29.0", "1.28.2", forServer(onlyServer, none)).features).toEqual([]);
  });

  it("un serveur d'avant ces fonctions (1.27.1, qui déclare sa liste) : absentes aussi", () => {
    const older = resolveServerCapabilities({ version: "1.27.1", capabilities: ["reco.moviesRow", "trailers.player"] });
    expect(forServer(registry, older)[0]?.features.map((f) => f.id)).toEqual(["plain"]);
  });

  it("un serveur qui déclare une capacité montre sa nouveauté, et elle seule", () => {
    const some = resolveServerCapabilities({ version: "1.29.0", capabilities: ["trailers.preview"] });
    expect(forServer(registry, some)[0]?.features.map((f) => f.id)).toEqual(["preview", "plain"]);
    const all = resolveServerCapabilities({ version: "1.29.0", capabilities: ["trailers.preview", "family.desktopProfiles"] });
    expect(forServer(registry, all)[0]?.features.map((f) => f.id)).toEqual(["preview", "profiles", "plain"]);
  });
});

describe("nouveautés qui exigent un trait de l'appareil", () => {
  const glass: WhatsNewFeature = { ...feature("glass"), requires: "liquidGlass" };
  const plain = feature("plain");

  it("sans le trait (Windows, Linux, macOS d'avant 26, web) : absente, et une release vidée n'ouvre rien", () => {
    const onlyGlass: WhatsNewRelease[] = [{ version: "1.40.0", features: [glass] }];
    expect(selectWhatsNewFeatures("1.40.0", "1.31.1", forClient(onlyGlass, new Set())).features).toEqual([]);
    const mixed: WhatsNewRelease[] = [{ version: "1.40.0", features: [glass, plain] }];
    expect(forClient(mixed, new Set())[0]?.features.map((f) => f.id)).toEqual(["plain"]);
  });

  it("avec le trait : montrée, à sa place", () => {
    const mixed: WhatsNewRelease[] = [{ version: "1.40.0", features: [glass, plain] }];
    expect(forClient(mixed, new Set(["liquidGlass"] as const))[0]?.features.map((f) => f.id)).toEqual(["glass", "plain"]);
  });
});
