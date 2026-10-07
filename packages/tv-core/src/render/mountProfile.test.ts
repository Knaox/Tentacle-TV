import { describe, expect, it } from "vitest";
import { MOUNT_PROFILES, mountProfileOf } from "./mountProfile";

describe("le profil de montage", () => {
  it("garde, au niveau normal, le montage d'avant le mode Lite à l'identique", () => {
    expect(mountProfileOf("normal")).toEqual({
      rowTails: "eager",
      retireOffscreenRows: false,
      stageSearchRows: false,
      recycleSearchCards: false,
      gridDrawDistance: 1100,
      gridStaging: false,
      episodes: { initialNumToRender: 6, windowSize: 5, maxToRenderPerBatch: 10 },
    });
  });

  it("borne, en Lite, ce qui vit hors de l'écran", () => {
    const lite = mountProfileOf("lite");
    const normal = MOUNT_PROFILES.normal;
    expect(lite.rowTails).toBe("demanded");
    expect(lite.retireOffscreenRows).toBe(true);
    expect(lite.stageSearchRows).toBe(true);
    expect(lite.recycleSearchCards).toBe(true);
    expect(lite.gridStaging).toBe(true);
    expect(lite.gridDrawDistance).toBeLessThan(normal.gridDrawDistance);
    expect(lite.episodes.windowSize).toBeLessThan(normal.episodes.windowSize);
    expect(lite.episodes.initialNumToRender).toBeLessThan(normal.episodes.initialNumToRender);
  });

  it("garde en Lite une ligne de grille d'avance : celle que BAS rejoint est montée", () => {
    // Une ligne de six affiches (~494 points) et l'écart qui la précède.
    expect(mountProfileOf("lite").gridDrawDistance).toBeGreaterThanOrEqual(494 + 52);
  });
});
