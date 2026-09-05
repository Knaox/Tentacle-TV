import { describe, expect, it, vi } from "vitest";
import type { HomeLayoutData, HomeLayoutInput, RecoSettingsData } from "../hooks/useHomeLayout";
import {
  applyHomeLayoutPatch,
  applyRecoSettingsPatch,
  pushHomeLayoutPatch,
  pushRecoSettingsPatch,
  toHomeLayoutBody,
} from "./preferencesPatch";

const CATALOG = [
  { key: "resume", enabled: true },
  { key: "nextUp", enabled: true },
  { key: "reco:forYou", enabled: true },
  { key: "watched", enabled: true },
  { key: "watchlist", enabled: true },
];

/** Un compte qui n'a rien enregistré : le serveur sert son catalogue, sans bibliothèque. */
const FRESH_DEFAULT: HomeLayoutData = {
  heroMode: "reco",
  heroFixedItemId: null,
  rows: CATALOG.map((r) => ({ ...r })),
  cardDensity: "normal",
  stored: false,
  catalog: CATALOG,
};
const LIBS = [{ id: "L1", name: "Films" }];

const SETTINGS: RecoSettingsData = {
  personalized: true,
  includeVigie: true,
  community: true,
  shareHistory: true,
  explorationBalance: 70,
  providerFilter: [],
};

describe("applyHomeLayoutPatch — la copie fraîche, réconciliée puis patchée", () => {
  it("ancre les bibliothèques d'un défaut non stocké avant Déjà visionné, et applique le patch", () => {
    const next = applyHomeLayoutPatch(FRESH_DEFAULT, { heroMode: "resume" }, LIBS);
    const keys = next.rows.map((r) => r.key);
    expect(keys.indexOf("library:L1")).toBeGreaterThan(keys.indexOf("reco:forYou"));
    expect(keys.indexOf("library:L1")).toBeLessThan(keys.indexOf("watched"));
    expect(next.heroMode).toBe("resume");
    // Les données de lecture survivent dans le cache…
    expect(next.stored).toBe(false);
    expect(next.catalog).toBe(CATALOG);
  });

  it("un patch fonctionnel reçoit la copie réconciliée et ne renvoie que son delta", () => {
    const seen: string[][] = [];
    const next = applyHomeLayoutPatch(
      FRESH_DEFAULT,
      (fresh) => {
        seen.push(fresh.rows.map((r) => r.key));
        return { cardDensity: "large" };
      },
      LIBS,
    );
    expect(seen[0]).toContain("library:L1");
    expect(next.cardDensity).toBe("large");
    expect(next.rows.map((r) => r.key)).toEqual(seen[0]);
  });

  it("sans bibliothèques, les rangées restent telles quelles", () => {
    const next = applyHomeLayoutPatch(FRESH_DEFAULT, { heroMode: "random" });
    expect(next.rows).toBe(FRESH_DEFAULT.rows);
  });

  it("le corps du PUT ne porte ni stored ni catalog", () => {
    const body = toHomeLayoutBody(FRESH_DEFAULT);
    expect(body).not.toHaveProperty("stored");
    expect(body).not.toHaveProperty("catalog");
    expect(body.rows).toEqual(FRESH_DEFAULT.rows);
  });
});

describe("pushHomeLayoutPatch — lire, puis écrire le bloc fusionné", () => {
  it("relit le serveur avant d'écrire, et envoie le bloc nu", async () => {
    const order: string[] = [];
    const read = vi.fn(async () => { order.push("read"); return FRESH_DEFAULT; });
    const write = vi.fn(async (_body: HomeLayoutInput) => { order.push("write"); });
    const merged = await pushHomeLayoutPatch({ heroMode: "fixed", heroFixedItemId: "abc" }, LIBS, { read, write });
    expect(order).toEqual(["read", "write"]);
    const body = write.mock.calls[0][0] as unknown as Record<string, unknown>;
    expect(body).not.toHaveProperty("stored");
    expect(body.heroMode).toBe("fixed");
    expect(body.heroFixedItemId).toBe("abc");
    expect(merged.catalog).toBe(CATALOG);
  });
});

describe("applyRecoSettingsPatch / pushRecoSettingsPatch", () => {
  it("fusionne le patch et normalise le filtre de plateformes", () => {
    const next = applyRecoSettingsPatch(SETTINGS, { providerFilter: [415, 283, 283], community: false });
    expect(next.providerFilter).toEqual([283, 415]);
    expect(next.community).toBe(false);
    expect(next.explorationBalance).toBe(70);
  });

  it("accepte la forme fonctionnelle", () => {
    const next = applyRecoSettingsPatch(SETTINGS, (fresh) => ({ explorationBalance: fresh.explorationBalance - 10 }));
    expect(next.explorationBalance).toBe(60);
  });

  it("relit puis écrit le bloc entier", async () => {
    const read = vi.fn(async () => ({ ...SETTINGS, shareHistory: false }));
    const write = vi.fn(async () => undefined);
    const merged = await pushRecoSettingsPatch({ personalized: false }, { read, write });
    expect(write).toHaveBeenCalledWith({ ...SETTINGS, shareHistory: false, personalized: false });
    expect(merged.shareHistory).toBe(false);
  });
});
