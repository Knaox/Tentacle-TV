import { describe, expect, it } from "vitest";
import { MOUNT_PROFILES, mountProfileOf } from "./mountProfile";

describe("le profil de montage", () => {
  it("garde, au niveau normal, le montage d'avant le mode Lite à l'identique", () => {
    expect(mountProfileOf("normal")).toEqual({
      rowTails: "eager",
      fitRowHeads: false,
      retireOffscreenRows: false,
      gridDrawDistance: 1100,
      gridActiveDrawDistance: 1100,
      gridWidenStep: 1100,
      gridWidenDelayMs: 0,
      episodes: { initialNumToRender: 6, windowSize: 5, maxToRenderPerBatch: 10 },
    });
  });

  it("borne, en Lite, ce qui vit hors de l'écran", () => {
    const lite = mountProfileOf("lite");
    const normal = MOUNT_PROFILES.normal;
    expect(lite.rowTails).toBe("demanded");
    expect(lite.fitRowHeads).toBe(true);
    expect(lite.retireOffscreenRows).toBe(true);
    expect(lite.gridDrawDistance).toBeLessThan(normal.gridDrawDistance);
    expect(lite.episodes.windowSize).toBeLessThan(normal.episodes.windowSize);
    expect(lite.episodes.initialNumToRender).toBeLessThan(normal.episodes.initialNumToRender);
  });

  it("garde en Lite une ligne de grille d'avance : celle que BAS rejoint est montée", () => {
    // Une ligne de six affiches (~494 points) et l'écart qui la précède.
    const lite = mountProfileOf("lite");
    expect(lite.gridActiveDrawDistance).toBeGreaterThanOrEqual(494 + 52);
    expect(lite.gridDrawDistance).toBeLessThan(lite.gridActiveDrawDistance);
    // Jamais plus d'une ligne montée dans la même image.
    expect(lite.gridWidenStep).toBeLessThan(437);
  });
});
