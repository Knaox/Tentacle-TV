/**
 * Un `preferences:update` venu d'un autre appareil relit le bloc concerné —
 * sauf quand une sauvegarde locale de CE bloc est en vol (l'optimiste ne
 * doit pas être écrasé par une lecture périmée) ; les autres blocs, eux,
 * se relisent quand même. Le rattrapage couvre les deux blocs.
 */

import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { applyPreferencesUpdate, catchUpPreferences } from "./usePreferencesLive";

function client() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  qc.setQueryData(["home-layout"], { heroMode: "reco" });
  qc.setQueryData(["reco-settings"], { personalized: true });
  qc.setQueryData(["reco-page", "x"], { rows: [] });
  const invalidate = vi.spyOn(qc, "invalidateQueries");
  return { qc, invalidate };
}

/** Une sauvegarde qui ne se termine jamais : en vol pour toute la durée du test. */
function pendingMutation(qc: QueryClient, mutationKey: readonly string[]) {
  const mutation = qc.getMutationCache().build(qc, {
    mutationKey: [...mutationKey],
    mutationFn: () => new Promise<void>(() => undefined),
  });
  void mutation.execute(undefined);
  return mutation;
}

const keys = (spy: { mock: { calls: unknown[][] } }) =>
  spy.mock.calls.map((call) => JSON.stringify((call[0] as { queryKey?: unknown } | undefined)?.queryKey));

describe("applyPreferencesUpdate", () => {
  it("relit le bloc annoncé ; les réglages entraînent la page", () => {
    const { qc, invalidate } = client();
    expect(applyPreferencesUpdate(qc, "home-layout")).toBe(true);
    expect(keys(invalidate)).toEqual(['["home-layout"]']);
    invalidate.mockClear();
    expect(applyPreferencesUpdate(qc, "reco-settings")).toBe(true);
    expect(keys(invalidate)).toContain('["reco-settings"]');
    expect(keys(invalidate).some((k) => k.includes("reco-page"))).toBe(true);
  });

  it("ne relit pas un bloc dont une sauvegarde locale est en vol — patch ou bloc entier", async () => {
    const { qc, invalidate } = client();
    pendingMutation(qc, ["home-layout", "patch"]);
    await Promise.resolve();
    expect(applyPreferencesUpdate(qc, "home-layout")).toBe(false);
    expect(invalidate).not.toHaveBeenCalled();

    pendingMutation(qc, ["reco-settings", "save"]);
    await Promise.resolve();
    expect(applyPreferencesUpdate(qc, "reco-settings")).toBe(false);
    expect(invalidate).not.toHaveBeenCalled();
    qc.getMutationCache().clear();
  });

  it("une sauvegarde d'un AUTRE bloc ne bloque rien", async () => {
    const { qc, invalidate } = client();
    pendingMutation(qc, ["reco-settings", "filter"]);
    await Promise.resolve();
    expect(applyPreferencesUpdate(qc, "home-layout")).toBe(true);
    expect(keys(invalidate)).toEqual(['["home-layout"]']);
    qc.getMutationCache().clear();
  });
});

describe("catchUpPreferences", () => {
  it("relit les deux blocs après une coupure", () => {
    const { qc, invalidate } = client();
    catchUpPreferences(qc);
    expect(keys(invalidate)).toContain('["home-layout"]');
    expect(keys(invalidate)).toContain('["reco-settings"]');
  });
});
