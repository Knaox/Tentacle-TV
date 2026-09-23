import { describe, expect, it } from "vitest";
import { forAudience, selectWhatsNewFeatures } from "./selectFeatures";
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
