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
  return { backend, timers, logs, regions, upsert, remove, root };
}

describe("GlassRegions — rien de posé qui ne sert", () => {
  it("sans région, la fenêtre n'a ni racine ni groupe", () => {
    const t = setup();
    t.regions.apply({ enabled: true, upserts: [], removes: [] }, 1);
    expect(t.root()).toBeUndefined();
    expect(t.backend.ops).toEqual([]);
  });

  it("une région : racine, groupe, verre — au bon endroit, axe retourné", () => {
    const t = setup();
    t.upsert(region("barre"));
    const glass = t.root()?.children[0]?.children[0]?.children[0];
    expect(glass?.kind).toBe("glass");
    expect(glass?.frame).toEqual({ x: 20, y: 44, width: 600, height: 56 });
    expect(t.regions.snapshot()).toMatchObject({ root: true, groups: 1, nativeViews: 1 });
  });

  it("la dernière région partie, verre, groupe et racine partent avec elle", () => {
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

  it("chaque propriété changée, et elle seule", () => {
    const t = setup();
    t.upsert(region("barre"));
    t.backend.ops.length = 0;
    t.upsert(region("barre", { y: 600, transition: 180 }));
    expect(t.backend.ops).toEqual(["setFrame 180"]);
    t.backend.ops.length = 0;
    t.upsert(region("barre", { y: 600, level: "clear", tint: "#7C3AED80" }));
    expect(t.backend.ops).toEqual(["setStyle", "setTint"]);
  });

  it("le zoom de la page s'applique au rectangle et au rayon", () => {
    const t = setup();
    t.regions.apply({ upserts: [region("barre", { y: 0, height: 40, radius: 20 })], removes: [] }, 1.5);
    const glass = t.root()?.children[0]?.children[0]?.children[0];
    expect(glass?.frame).toEqual({ x: 30, y: 800 - 60, width: 900, height: 60 });
    expect(glass?.radius).toBe(30);
  });
});

describe("GlassRegions — profondeur et groupes", () => {
  it("la profondeur décide de l'empilement, l'arrivée départage", () => {
    const t = setup();
    t.upsert(region("haut", { z: 5, radius: 5 }), region("bas", { z: 0, radius: 1 }), region("milieu", { z: 2, radius: 2 }));
    t.upsert(region("milieu-bis", { z: 2, radius: 3 }));
    const container = t.root()?.children[0];
    expect(container && t.backend.stackOf(container)).toEqual([1, 2, 3, 5]);
    t.upsert(region("bas", { z: 9, radius: 1 }));
    expect(container && t.backend.stackOf(container)).toEqual([2, 3, 5, 1]);
  });

  it("un groupe par famille, la distance de fusion la plus grande", () => {
    const t = setup();
    t.upsert(region("a", { group: "lecteur", spacing: 8 }), region("b", { group: "lecteur", spacing: 20 }), region("c"));
    const snapshot = t.regions.snapshot();
    expect(snapshot.groups).toBe(2);
    const containers = t.root()?.children ?? [];
    expect(containers.map((c) => c.spacing).sort((x, y) => x - y)).toEqual([0, 20]);
    expect(snapshot.regions.find((r) => r.id === "a")?.group).toBe("lecteur");
  });

  it("changer de groupe repose la vue, et l'ancien groupe vide part", () => {
    const t = setup();
    t.upsert(region("a", { group: "un" }));
    t.upsert(region("a", { group: "deux" }));
    expect(t.regions.snapshot()).toMatchObject({ groups: 1, nativeViews: 1 });
    expect(t.regions.snapshot().regions[0]?.group).toBe("deux");
  });
});

describe("GlassRegions — transitions natives", () => {
  it("apparition en fondu, disparition en fondu, puis retrait", () => {
    const t = setup();
    t.upsert(region("toast", { transition: 200 }));
    expect(t.backend.ops).toContain("setAlpha 1 200");
    t.remove("toast");
    expect(t.backend.ops.at(-1)).toBe("setAlpha 0 200");
    // Le groupe et la racine attendent la fin du fondu.
    expect(t.root()).toBeDefined();
    t.timers.runAll();
    expect(t.root()).toBeUndefined();
  });

  it("couper le réglage pendant un fondu solde le fondu, sans toucher une poignée rendue", () => {
    const t = setup();
    t.upsert(region("toast", { transition: 200 }), region("barre"));
    t.remove("toast");
    t.regions.apply({ enabled: false, upserts: [], removes: [] }, 1);
    expect(t.root()).toBeUndefined();
    expect(t.timers.size()).toBe(0);
  });
});

describe("GlassRegions — réglage, page, fenêtre", () => {
  it("coupé : plus AUCUNE vue native ; rallumé : tout revient à l'identique", () => {
    const t = setup();
    t.upsert(region("a", { z: 1, radius: 1 }), region("b", { z: 0, radius: 2 }));
    t.regions.apply({ enabled: false, upserts: [], removes: [] }, 1);
    expect(t.root()).toBeUndefined();
    expect(t.regions.snapshot()).toMatchObject({ enabled: false, nativeViews: 0, root: false });
    // Coupé, une région changée est retenue sans rien poser.
    t.upsert(region("a", { z: 1, radius: 1, x: 99 }));
    expect(t.root()).toBeUndefined();
    t.regions.apply({ enabled: true, upserts: [], removes: [] }, 1);
    const container = t.root()?.children[0];
    expect(container && t.backend.stackOf(container)).toEqual([2, 1]);
    expect(container?.children[0]?.children[1]?.frame.x).toBe(99);
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
    expect(t.backend.ops.every((op) => op.startsWith("release"))).toBe(true);
    expect(t.backend.ops).toHaveLength(4);
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
