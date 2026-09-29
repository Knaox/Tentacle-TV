/**
 * Les rappels masqués : la liste après un geste (sans doublon, dans l'ordre du
 * contrat), la lecture du serveur — un serveur d'avant la route vaut « rien de
 * masqué », une vraie panne remonte —, et la diffusion en direct : un
 * `preferences:update` « hints » relit la liste, sauf pendant une sauvegarde
 * locale (l'optimiste ne doit pas être écrasé par une lecture périmée).
 */

import { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DISMISSED_HINTS_KEY, SET_HINT_DISMISSED_KEY, applyHintChange, fetchDismissedHints } from "./useDismissedHints";
import { applyPreferencesUpdate, catchUpPreferences } from "./usePreferencesLive";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("applyHintChange", () => {
  it("masque, sans doublon, puis réaffiche", () => {
    expect(applyHintChange(undefined, "trailerHelp", true)).toEqual(["trailerHelp"]);
    expect(applyHintChange(["trailerHelp"], "trailerHelp", true)).toEqual(["trailerHelp"]);
    expect(applyHintChange(["trailerHelp"], "trailerHelp", false)).toEqual([]);
    expect(applyHintChange(undefined, "trailerHelp", false)).toEqual([]);
  });
});

describe("fetchDismissedHints", () => {
  it("rend la liste du serveur, nettoyée des noms inconnus", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ dismissed: ["vieux", "trailerHelp"] }), { status: 200 })));
    await expect(fetchDismissedHints()).resolves.toEqual(["trailerHelp"]);
  });

  it("un serveur d'avant la route (404) : rien de masqué", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("Not Found", { status: 404 })));
    await expect(fetchDismissedHints()).resolves.toEqual([]);
  });

  it("une vraie panne remonte : on ne devine pas un « rien de masqué »", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("boom", { status: 500 })));
    await expect(fetchDismissedHints()).rejects.toMatchObject({ status: 500 });
  });
});

describe("diffusion en direct de la portée « hints »", () => {
  function client() {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    qc.setQueryData(DISMISSED_HINTS_KEY, []);
    return { qc, invalidate: vi.spyOn(qc, "invalidateQueries") };
  }

  it("relit la liste quand un autre appareil l'a changée, et au rattrapage", () => {
    const { qc, invalidate } = client();
    expect(applyPreferencesUpdate(qc, "hints")).toBe(true);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["hints"] });
    invalidate.mockClear();
    catchUpPreferences(qc);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["hints"] });
  });

  it("pas pendant une sauvegarde locale en vol", async () => {
    const { qc, invalidate } = client();
    const mutation = qc.getMutationCache().build(qc, {
      mutationKey: [...SET_HINT_DISMISSED_KEY],
      mutationFn: () => new Promise<void>(() => undefined),
    });
    void mutation.execute(undefined);
    await Promise.resolve();
    expect(applyPreferencesUpdate(qc, "hints")).toBe(false);
    expect(invalidate).not.toHaveBeenCalled();
    qc.getMutationCache().clear();
  });
});
