/**
 * Un droit retiré AU BUREAU s'applique au titre gardé sur le téléphone, sans
 * redémarrage : `rights:changed` invalide la requête du verdict
 * (`applyRightsChanged`), le serveur juge le titre caché, il quitte la liste
 * et ne se lit plus — et le dernier verdict tient hors ligne. Le droit rendu,
 * il revient.
 */

import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyRightsChanged } from "@tentacle-tv/api-client";
import type { LibraryVisibilityDto } from "@tentacle-tv/shared";
import { configureOfflineHidden, filterHiddenOffline, isHiddenOffline } from "./offlineHiddenStore";
import { offlineVerdictsEnabled, offlineVerdictsKey, syncOfflineVerdicts } from "./offlineVerdictSync";

const TOY = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const PULP = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const kept = [{ itemId: TOY, name: "Toy Story" }, { itemId: PULP, name: "Pulp Fiction" }];

let disk: string | null = null;
const changed = vi.fn();

beforeEach(() => {
  disk = null;
  changed.mockClear();
  configureOfflineHidden({ read: () => disk, write: (value) => { disk = value; }, changed });
});

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("titres gardés et droits changés au bureau", () => {
  it("rights:changed → verdict relu → le titre caché quitte la liste, sans redémarrage", async () => {
    let serverHides: string[] = [];
    const fetcher = vi.fn(async (ids: readonly string[]): Promise<LibraryVisibilityDto> => ({
      visible: ids.filter((id) => !serverHides.includes(id)), hidden: ids.filter((id) => serverHides.includes(id)), gone: [],
    }));
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 5 * 60_000 } } });
    const observer = new QueryObserver(qc, {
      queryKey: offlineVerdictsKey("membre", `${TOY},${PULP}`),
      queryFn: () => syncOfflineVerdicts("membre", [TOY, PULP], fetcher),
    });
    const off = observer.subscribe(() => undefined);
    await flush();
    expect(filterHiddenOffline("membre", kept)).toHaveLength(2);

    // Au bureau, le propriétaire retire la bibliothèque de Pulp Fiction ; le serveur annonce rights:changed.
    serverHides = [PULP];
    applyRightsChanged(qc);
    await flush();
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(filterHiddenOffline("membre", kept).map((e) => e.name)).toEqual(["Toy Story"]);
    expect(isHiddenOffline("membre", PULP)).toBe(true);
    expect(changed).toHaveBeenCalledTimes(1);

    // Redémarrage HORS LIGNE : le dernier verdict, relu de la base locale, tient.
    configureOfflineHidden({ read: () => disk, write: (value) => { disk = value; }, changed });
    expect(isHiddenOffline("membre", PULP)).toBe(true);

    // Le droit rendu : le verdict suivant le rend.
    serverHides = [];
    applyRightsChanged(qc);
    await flush();
    expect(isHiddenOffline("membre", PULP)).toBe(false);
    off();
  });

  it("une erreur du serveur garde le dernier verdict", async () => {
    await syncOfflineVerdicts("m", [PULP], async () => ({ visible: [], hidden: [PULP], gone: [] }));
    await expect(syncOfflineVerdicts("m", [PULP], async () => { throw new Error("hors ligne"); })).rejects.toThrow();
    expect(isHiddenOffline("m", PULP)).toBe(true);
  });

  it("aucun titre gardé : rien à demander, l'entrée s'efface", async () => {
    await syncOfflineVerdicts("m", [PULP], async () => ({ visible: [], hidden: [PULP], gone: [] }));
    const fetcher = vi.fn();
    await syncOfflineVerdicts("m", [], fetcher);
    expect(fetcher).not.toHaveBeenCalled();
    expect(isHiddenOffline("m", PULP)).toBe(false);
  });

  it("on ne demande qu'en ligne, à un serveur qui sait juger, pour une identité connue", () => {
    expect(offlineVerdictsEnabled({ online: true, capable: true, identity: "m" })).toBe(true);
    expect(offlineVerdictsEnabled({ online: false, capable: true, identity: "m" })).toBe(false);
    expect(offlineVerdictsEnabled({ online: true, capable: false, identity: "m" })).toBe(false);
    expect(offlineVerdictsEnabled({ online: true, capable: true, identity: null })).toBe(false);
  });
});
