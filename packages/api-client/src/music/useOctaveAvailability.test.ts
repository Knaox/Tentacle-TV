import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Octave — la disponibilité et « Accès à Octave » (`octave.rights`) : le
 * serveur qui retire le droit dit `octaveAccess: false` → ni bascule, ni
 * réglage, ni entrée ; un serveur d'avant ne dit rien → Octave comme avant.
 */
const h = vi.hoisted(() => ({
  status: { data: undefined as Record<string, unknown> | undefined, isPending: false, isError: false },
}));

vi.mock("../hooks/useServerCapabilities", () => ({
  useServerCapabilities: () => ({ capabilities: new Set(["music.library", "octave.rights"]), settled: true }),
}));
vi.mock("../hooks/useUserId", () => ({ useUserId: () => "u1" }));
vi.mock("./useMusicLibrary", () => ({ useMusicStatus: () => h.status }));

const { octaveAvailabilityOf, useOctaveAvailability } = await import("./useOctaveAvailability");

beforeEach(() => {
  h.status = { data: undefined, isPending: false, isError: false };
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

describe("serveur qui ne déclare rien (avant 1.40.0) → aucune trace d'Octave", () => {
  const silent = { enabled: true, userId: "u1", capabilities: new Set<string>(), capsSettled: true, status: { data: undefined, isPending: true, isError: false } };

  it("indisponible, et c'est un FAIT : rien n'attend, rien ne s'affiche", () => {
    expect(octaveAvailabilityOf(silent)).toEqual({ available: false, settled: true });
  });

  it("même si un statut traînait en cache, sans la capacité : rien", () => {
    expect(octaveAvailabilityOf({ ...silent, status: { data: { available: true, octaveAccess: true }, isPending: false, isError: false } })).toEqual({ available: false, settled: true });
  });

  it("d'autres capacités déclarées, pas `music.library` : rien non plus", () => {
    expect(octaveAvailabilityOf({ ...silent, capabilities: new Set(["family.webProfiles", "reco.trending"]) }).available).toBe(false);
  });
});
