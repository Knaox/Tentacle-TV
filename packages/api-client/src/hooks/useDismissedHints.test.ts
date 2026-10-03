/**
 * Les rappels masqués : l'état après un geste (sans doublon, dans l'ordre du
 * contrat, la marque retenue puis oubliée), la lecture du serveur — un serveur
 * d'avant la route vaut « rien de masqué, rien à retenir », un serveur d'avant
 * les marques ne sait retenir que le contrat d'origine, une vraie panne
 * remonte —, et la diffusion en direct : un `preferences:update` « hints »
 * relit la liste, sauf pendant une sauvegarde locale (l'optimiste ne doit pas
 * être écrasé par une lecture périmée).
 */

import { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DISMISSIBLE_HINTS } from "@tentacle-tv/shared";
import { DISMISSED_HINTS_KEY, SET_HINT_DISMISSED_KEY, applyHintChange, fetchDismissedHints } from "./useDismissedHints";
import { applyPreferencesUpdate, catchUpPreferences } from "./usePreferencesLive";

afterEach(() => {
  vi.unstubAllGlobals();
});

const KNOWN = [...DISMISSIBLE_HINTS];

describe("applyHintChange", () => {
  it("masque, sans doublon, puis réaffiche", () => {
    const empty = { dismissed: [], marks: {}, known: KNOWN };
    expect(applyHintChange(undefined, "trailerHelp", true).dismissed).toEqual(["trailerHelp"]);
    const hidden = applyHintChange(empty, "trailerHelp", true);
    expect(applyHintChange(hidden, "trailerHelp", true).dismissed).toEqual(["trailerHelp"]);
    expect(applyHintChange(hidden, "trailerHelp", false)).toEqual(empty);
    expect(applyHintChange(undefined, "trailerHelp", false).dismissed).toEqual([]);
  });

  it("retient la marque au masquage, la remplace, l'oublie au réaffichage", () => {
    const first = applyHintChange(undefined, "serverUpdate", true, "1.23.0");
    expect(first.marks).toEqual({ serverUpdate: "1.23.0" });
    expect(applyHintChange(first, "serverUpdate", true, "1.24.0").marks).toEqual({ serverUpdate: "1.24.0" });
    expect(applyHintChange(first, "serverUpdate", true).marks).toEqual({});
    expect(applyHintChange(first, "serverUpdate", false)).toEqual({ dismissed: [], marks: {}, known: [] });
  });
});

describe("fetchDismissedHints", () => {
  it("rend l'état du serveur, nettoyé des noms inconnus et des marques orphelines", async () => {
    const response = { dismissed: ["vieux", "trailerHelp", "serverUpdate"], marks: { serverUpdate: "1.23.0", tmdbKey: "x" }, known: KNOWN };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(response), { status: 200 })));
    await expect(fetchDismissedHints()).resolves.toEqual({
      dismissed: ["trailerHelp", "serverUpdate"], marks: { serverUpdate: "1.23.0" }, known: KNOWN,
    });
  });

  it("un serveur d'avant les marques ne sait retenir que le contrat d'origine", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ dismissed: ["trailerHelp"] }), { status: 200 })));
    await expect(fetchDismissedHints()).resolves.toEqual({ dismissed: ["trailerHelp"], marks: {}, known: ["trailerHelp"] });
  });

  it("un serveur d'avant la route (404) : rien de masqué, rien à retenir", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("Not Found", { status: 404 })));
    await expect(fetchDismissedHints()).resolves.toEqual({ dismissed: [], marks: {}, known: [] });
  });

  it("une vraie panne remonte : on ne devine pas un « rien de masqué »", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("boom", { status: 500 })));
    await expect(fetchDismissedHints()).rejects.toMatchObject({ status: 500 });
  });
});

describe("diffusion en direct de la portée « hints »", () => {
  function client() {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    qc.setQueryData(DISMISSED_HINTS_KEY, { dismissed: [], marks: {}, known: KNOWN });
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
