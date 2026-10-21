import { describe, expect, it } from "vitest";
import { MAX_REGIONS, type NativeGlassRegion } from "./protocol";
import { GlassRegions } from "./regions";
import { FakeBackend, manualTimers, type FakeView } from "./testkit";

function region(id: string, extra: Partial<NativeGlassRegion> = {}): NativeGlassRegion {
  return { id, x: 20, y: 700, width: 600, height: 56, radius: 28, level: "regular", tint: null, interactive: false, z: 0, ...extra };
}

function setup() {
  const backend = new FakeBackend();
  const timers = manualTimers();
  const logs: string[] = [];
  const regions = new GlassRegions(backend, timers, (m) => logs.push(m));
  const upsert = (...list: NativeGlassRegion[]) => regions.apply({ upserts: list, removes: [] }, 1);
  const remove = (...ids: string[]) => regions.apply({ upserts: [], removes: ids }, 1);
  const root = (): FakeView | undefined => backend.content.children.find((v) => v.kind === "root");
  const glasses = (container: FakeView | undefined): FakeView[] => container?.children[0]?.children ?? [];
  return { backend, timers, logs, regions, upsert, remove, root, glasses };
}

describe("GlassRegions — rien de posé qui ne sert", () => {
  it("sans région, la fenêtre n'a ni racine ni conteneur", () => {
    const t = setup();
    t.regions.apply({ enabled: true, upserts: [], removes: [] }, 1);
    expect(t.root()).toBeUndefined();
    expect(t.backend.ops).toEqual([]);
  });

  it("une région : racine, conteneur, verre — au bon endroit, axe retourné", () => {
    const t = setup();
    t.upsert(region("barre"));
    const glass = t.glasses(t.root()?.children[0])[0];
    expect(glass?.frame).toEqual({ x: 20, y: 44, width: 600, height: 56 });
    expect(t.regions.snapshot()).toMatchObject({ root: true, groups: 1, nativeViews: 1 });
  });

  it("la dernière région partie, verre, conteneur et racine partent avec elle", () => {
    const t = setup();
    t.upsert(region("barre"));
    t.remove("barre");
    expect(t.root()).toBeUndefined();
    expect(t.backend.ops.slice(-3)).toEqual(["dispose glass", "dispose container", "dispose root"]);
  });
});

describe("GlassRegions — n'écrire que ce qui change", () => {
  it("une région renvoyée telle quelle ne coûte aucun geste", () => {
    const t = setup();
    t.upsert(region("barre"));
    const before = t.backend.ops.length;
    t.upsert(region("barre"));
    expect(t.backend.ops.length).toBe(before);
  });

  it("chaque propriété changée, et elle seule ; un déplacement suit le ressort morph de la page", () => {
    const t = setup();
    t.upsert(region("barre"));
    t.backend.ops.length = 0;
    t.upsert(region("barre", { y: 600, transition: 180 }));
    expect(t.backend.ops).toEqual(["setFrame ressort 291"]);
    t.backend.ops.length = 0;
    t.upsert(region("barre", { y: 600, transition: 180, level: "clear", tint: "#7C3AED80", appearance: "dark" }));
    expect(t.backend.ops).toEqual(["setStyle", "setTint", "setAppearance dark"]);
    t.backend.ops.length = 0;
    t.upsert(region("barre", { y: 500, level: "clear", tint: "#7C3AED80", appearance: "dark" }));
    // Sans transition, le déplacement est direct.
    expect(t.backend.ops).toEqual(["setFrame direct"]);
  });

  it("le ressort de la région remplace morph (lens : 439 ms)", () => {
    const t = setup();
    t.upsert(region("pastille"));
    t.backend.ops.length = 0;
    t.upsert(region("pastille", { x: 90, transition: 200, spring: { response: 0.32, dampingFraction: 0.55 } }));
    expect(t.backend.ops).toEqual(["setFrame ressort 439"]);
  });

  it("le zoom de la page s'applique au rectangle et au rayon ; l'apparence est posée à la naissance", () => {
    const t = setup();
    t.regions.apply({ upserts: [region("barre", { y: 0, height: 40, radius: 20, appearance: "dark" })], removes: [] }, 1.5);
    const glass = t.glasses(t.root()?.children[0])[0];
    expect(glass?.frame).toEqual({ x: 30, y: 800 - 60, width: 900, height: 60 });
    expect(glass?.radius).toBe(30);
    expect(glass?.appearance).toBe("dark");
  });
});

describe("GlassRegions — profondeur et groupes", () => {
  it("dans un groupe, la profondeur décide de l'empilement, l'arrivée départage", () => {
    const t = setup();
    const g = { group: "lecteur" };
    t.upsert(region("haut", { ...g, z: 5, radius: 5 }), region("bas", { ...g, z: 0, radius: 1 }), region("milieu", { ...g, z: 2, radius: 2 }));
    t.upsert(region("milieu-bis", { ...g, z: 2, radius: 3 }));
    const container = t.root()?.children[0];
    expect(container && t.backend.stackOf(container)).toEqual([1, 2, 3, 5]);
    t.upsert(region("bas", { ...g, z: 9, radius: 1 }));
    expect(container && t.backend.stackOf(container)).toEqual([2, 3, 5, 1]);
  });

  it("entre régions seules, la profondeur range leurs conteneurs", () => {
    const t = setup();
    t.upsert(region("dessus", { z: 3, radius: 3 }), region("dessous", { z: 1, radius: 1 }));
    const order = (t.root()?.children ?? []).map((c) => t.glasses(c)[0]?.radius);
    expect(order).toEqual([1, 3]);
  });

  it("un groupe, un conteneur ; une région sans groupe, le sien ; la plus grande distance de fusion", () => {
    const t = setup();
    t.upsert(region("a", { group: "lecteur", spacing: 8 }), region("b", { group: "lecteur", spacing: 20 }), region("c", { spacing: 30 }));
    expect(t.regions.snapshot().groups).toBe(2);
    const spacings = (t.root()?.children ?? []).map((c) => c.spacing).sort((x, y) => x - y);
    // La région seule ne fusionne jamais, même si elle porte un `spacing`.
    expect(spacings).toEqual([0, 20]);
  });

  it("changer de groupe repose la vue, et l'ancien conteneur vide part", () => {
    const t = setup();
    t.upsert(region("a", { group: "un" }));
    t.upsert(region("a", { group: "deux" }));
    expect(t.regions.snapshot()).toMatchObject({ groups: 1, nativeViews: 1 });
    expect(t.regions.snapshot().regions[0]?.group).toBe("deux");
  });
});

describe("GlassRegions — mouvements natifs (transition)", () => {
  it("une région seule entre et sort par le fondu de SON conteneur — jamais par l'alpha du verre", () => {
    const t = setup();
    t.upsert(region("toast", { transition: 200 }));
    expect(t.backend.ops).toContain("createGroup 0 alpha 0");
    expect(t.backend.ops).toContain("setAlpha container 1 200");
    t.remove("toast");
    expect(t.backend.ops.at(-1)).toBe("setAlpha container 0 200");
    expect(t.root()).toBeDefined();
    t.timers.runAll();
    expect(t.root()).toBeUndefined();
  });

  it("un groupe qui naît entre en fondu ENTIER : ses membres ne grandissent pas", () => {
    const t = setup();
    t.upsert(region("a", { group: "lecteur", transition: 220 }), region("b", { group: "lecteur", transition: 220 }));
    expect(t.backend.ops.filter((op) => op.startsWith("setAlpha"))).toEqual(["setAlpha container 1 220"]);
    expect(t.backend.ops.some((op) => op.startsWith("setFrame"))).toBe(false);
  });

  it("un membre qui rejoint un groupe visible naît de son centre, au ressort", () => {
    const t = setup();
    t.upsert(region("a", { group: "lecteur", transition: 220 }));
    t.backend.ops.length = 0;
    t.upsert(region("b", { group: "lecteur", transition: 220, x: 100 }));
    expect(t.backend.ops).toContain("setFrame ressort 291");
    expect(t.backend.ops.some((op) => op.startsWith("setAlpha"))).toBe(false);
  });

  it("un membre qui quitte un groupe qui reste fond vers son centre, puis part", () => {
    const t = setup();
    t.upsert(region("a", { group: "lecteur" }), region("b", { group: "lecteur", x: 300, transition: 200 }));
    t.remove("b");
    expect(t.backend.ops.at(-1)).toBe("setFrame ressort 291");
    const leaving = t.glasses(t.root()?.children[0]).find((v) => v.frame.width === 0);
    expect(leaving?.frame).toMatchObject({ width: 0, height: 0 });
    t.timers.runAll();
    expect(t.regions.snapshot().nativeViews).toBe(1);
  });

  it("un groupe qui se vide sort en fondu ENTIER", () => {
    const t = setup();
    t.upsert(region("a", { group: "lecteur", transition: 180 }), region("b", { group: "lecteur", transition: 180 }));
    t.backend.ops.length = 0;
    t.remove("a", "b");
    expect(t.backend.ops).toEqual(["setAlpha container 0 180"]);
    t.timers.runAll();
    expect(t.root()).toBeUndefined();
  });

  it("couper le réglage pendant les fondus les solde tous, sans toucher une poignée rendue", () => {
    const t = setup();
    t.upsert(region("toast", { transition: 200 }), region("a", { group: "g" }), region("b", { group: "g", transition: 200 }));
    t.remove("toast", "b");
    t.regions.apply({ enabled: false, upserts: [], removes: [] }, 1);
    expect(t.root()).toBeUndefined();
    expect(t.timers.size()).toBe(0);
  });
});

describe("GlassRegions — réglage, page, fenêtre", () => {
  it("coupé : plus AUCUNE vue native ; rallumé : tout revient à l'identique", () => {
    const t = setup();
    const g = { group: "lecteur" };
    t.upsert(region("a", { ...g, z: 1, radius: 1 }), region("b", { ...g, z: 0, radius: 2 }));
    t.regions.apply({ enabled: false, upserts: [], removes: [] }, 1);
    expect(t.root()).toBeUndefined();
    expect(t.regions.snapshot()).toMatchObject({ enabled: false, nativeViews: 0, root: false });
    t.upsert(region("a", { ...g, z: 1, radius: 1, x: 99 }));
    expect(t.root()).toBeUndefined();
    t.regions.apply({ enabled: true, upserts: [], removes: [] }, 1);
    const container = t.root()?.children[0];
    expect(container && t.backend.stackOf(container)).toEqual([2, 1]);
    expect(t.glasses(container)[1]?.frame.x).toBe(99);
  });

  it("surface opaque : la racine naît cachée, et se montre avec la lecture", () => {
    const t = setup();
    t.regions.setSurfaceVisible(false);
    t.upsert(region("barre"));
    expect(t.root()?.hidden).toBe(true);
    expect(t.regions.snapshot().regions[0]?.hidden).toBe(true);
    t.regions.setSurfaceVisible(true);
    expect(t.root()?.hidden).toBe(false);
  });

  it("la page rechargée : plus rien de ce qu'elle avait demandé", () => {
    const t = setup();
    t.upsert(region("a"));
    t.regions.clear();
    expect(t.root()).toBeUndefined();
    expect(t.regions.snapshot().regions).toEqual([]);
  });

  it("la fenêtre détruite : les références sont rendues, rien n'est retiré", () => {
    const t = setup();
    t.upsert(region("a", { transition: 100 }), region("b"));
    t.remove("a");
    t.backend.ops.length = 0;
    t.regions.forget();
    // b (verre, conteneur), a qui s'estompe (verre, conteneur), la racine.
    expect(t.backend.ops.every((op) => op.startsWith("release"))).toBe(true);
    expect(t.backend.ops).toHaveLength(5);
    expect(t.timers.size()).toBe(0);
  });

  it(`au-delà de ${String(MAX_REGIONS)} régions, la page fuit : on ignore, et on le dit une fois`, () => {
    const t = setup();
    const many = Array.from({ length: MAX_REGIONS + 5 }, (_, i) => region(`r${String(i)}`));
    t.upsert(...many);
    t.upsert(region("encore"));
    expect(t.regions.snapshot().regions).toHaveLength(MAX_REGIONS);
    expect(t.logs).toHaveLength(1);
  });
});
