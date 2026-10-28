import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Octave — la disponibilité et « Accès à Octave » (`octave.rights`) : le
 * serveur qui retire le droit dit `octaveAccess: false` → ni bascule, ni
 * réglage, ni entrée ; un serveur d'avant ne dit rien → Octave comme avant.
 * Un serveur qui ne déclare pas la musique (≤ 1.31, règle 16 du lot mobile) :
 * Octave n'existe pas — ni bascule, ni écran, aucune attente, aucune erreur.
 */
const h = vi.hoisted(() => ({
  status: { data: undefined as Record<string, unknown> | undefined, isPending: false, isError: false },
  caps: { capabilities: new Set(["music.library", "octave.rights"]), settled: true },
}));

vi.mock("../hooks/useServerCapabilities", () => ({
  useServerCapabilities: () => h.caps,
}));
vi.mock("../hooks/useUserId", () => ({ useUserId: () => "u1" }));
vi.mock("./useMusicLibrary", () => ({ useMusicStatus: () => h.status }));

const { useOctaveAvailability } = await import("./useOctaveAvailability");

beforeEach(() => {
  h.status = { data: undefined, isPending: false, isError: false };
  h.caps = { capabilities: new Set(["music.library", "octave.rights"]), settled: true };
});

describe("useOctaveAvailability et « Accès à Octave »", () => {
  it("droit retiré : indisponible, et c'est un fait (pas d'attente)", () => {
    h.status.data = { available: false, libraryId: null, indexReady: true, trackCount: 0, octaveAccess: false };
    expect(useOctaveAvailability()).toEqual({ available: false, settled: true });
  });

  it("serveur d'avant (aucun champ) : comme avant", () => {
    h.status.data = { available: true, libraryId: "lib", indexReady: true, trackCount: 3 };
    expect(useOctaveAvailability()).toEqual({ available: true, settled: true });
  });

  it("un `available: true` n'emporte jamais un accès refusé", () => {
    h.status.data = { available: true, libraryId: "lib", indexReady: true, trackCount: 3, octaveAccess: false };
    expect(useOctaveAvailability().available).toBe(false);
  });
});

describe("useOctaveAvailability face à un serveur sans Octave", () => {
  it("aucune capacité musique déclarée : indisponible, et c'est un fait — même si un statut traînait", () => {
    h.caps = { capabilities: new Set(["family.webProfiles"]), settled: true };
    h.status.data = { available: true, libraryId: "lib", indexReady: true, trackCount: 3 };
    expect(useOctaveAvailability()).toEqual({ available: false, settled: true });
  });

  it("configuration pas encore reçue : rien d'affiché, rien d'établi (jamais un éclair d'Octave)", () => {
    h.caps = { capabilities: new Set(), settled: false };
    expect(useOctaveAvailability()).toEqual({ available: false, settled: false });
  });
});
