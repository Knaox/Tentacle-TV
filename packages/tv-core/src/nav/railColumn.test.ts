import { describe, expect, it } from "vitest";

import { railColumn, type RailColumnSpec } from "./railColumn";

// La colonne du rail Apple TV : écran de 1080, marges de 40, écart de 14,
// bloc du bas de 88 (le profil seul), hauteur permise de 890 (le rail d'avant).
const BASE: RailColumnSpec = { screen: 1080, marginTop: 40, marginBottom: 40, gap: 14, wanted: 0, max: 890, bottom: 88 };
const column = (patch: Partial<RailColumnSpec>) => railColumn({ ...BASE, ...patch });

describe("railColumn — peu d'entrées : un bloc compact, centré", () => {
  it("haut comme ses entrées, centré sur l'écran", () => {
    const { top, height } = column({ wanted: 401 });
    expect(height).toBe(401);
    expect(top).toBe(Math.round((1080 - 401) / 2));
  });

  it("reste centré tant qu'il laisse l'écart au-dessus du bloc du bas", () => {
    const { top, height, bottomTop } = column({ wanted: 760 });
    expect(top).toBe(160);
    expect(top + height).toBeLessThanOrEqual(bottomTop - 14);
  });
});

describe("railColumn — le bloc du bas n'est jamais caché ni poussé", () => {
  it("ne bouge pas, quel que soit le nombre d'entrées", () => {
    for (const wanted of [0, 300, 900, 5000]) expect(column({ wanted }).bottomTop).toBe(1080 - 40 - 88);
  });

  it("le bloc du haut remonte d'abord, garde l'écart, puis rétrécit", () => {
    // Un bloc du bas plus haut (l'élément des demandes au-dessus du profil) :
    // 3 bibliothèques restent centrées, 5 font remonter le bloc des pages.
    expect(column({ wanted: 617, bottom: 160 }).top).toBe(Math.round((1080 - 617) / 2));
    const tall = column({ wanted: 760, bottom: 160 });
    expect(tall.height).toBe(760);
    expect(tall.top).toBeLessThan(Math.round((1080 - 760) / 2));
    expect(tall.top + tall.height).toBe(tall.bottomTop - 14);
    const squeezed = column({ wanted: 1400, bottom: 160 });
    expect(squeezed.top).toBe(40);
    expect(squeezed.top + squeezed.height).toBe(squeezed.bottomTop - 14);
  });

  it("même un bloc du bas démesuré ne fait pas déborder le bloc du haut", () => {
    const { top, height, bottomTop } = column({ wanted: 1400, bottom: 2000 });
    expect(height).toBe(0);
    expect(top).toBeGreaterThanOrEqual(40);
    expect(bottomTop).toBe(1080 - 40 - 2000);
  });
});

describe("railColumn — beaucoup d'entrées : jamais plus grand que permis", () => {
  it("plafonné à sa hauteur permise, sans toucher le haut de l'écran", () => {
    const { top, height } = column({ wanted: 1481 });
    expect(height).toBe(890);
    expect(top).toBeGreaterThanOrEqual(40);
  });

  it("collé à l'écart du bloc du bas quand il ne tient plus centré", () => {
    const { top, height, bottomTop } = column({ wanted: 1481 });
    expect(top + height).toBe(bottomTop - 14);
  });
});
