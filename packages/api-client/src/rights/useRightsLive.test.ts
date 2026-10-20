/**
 * Un droit changé au bureau s'applique sur l'appareil sans redémarrage : à
 * `rights:changed`, la liste À L'ÉCRAN se relit (un titre devenu interdit en
 * sort), ce qui n'est pas affiché est oublié, la configuration du serveur reste.
 */

import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { applyRightsChanged } from "./useRightsLive";

describe("applyRightsChanged", () => {
  it("relit la liste affichée, oublie les autres, garde la configuration", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    let library = ["toy-story", "pulp-fiction"];
    const observer = new QueryObserver(qc, { queryKey: ["items", "films"], queryFn: async () => library });
    const seen: string[][] = [];
    const off = observer.subscribe((result) => { if (result.data) seen.push(result.data); });
    await qc.fetchQuery({ queryKey: ["items", "films"], queryFn: async () => library });
    qc.setQueryData(["item", "pulp-fiction"], { Name: "Pulp Fiction" });
    qc.setQueryData(["app-config", "https://srv"], { capabilities: ["rights.live"] });

    // Au bureau, le propriétaire retire la bibliothèque : le serveur ne rend plus le titre.
    library = ["toy-story"];
    applyRightsChanged(qc);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(qc.getQueryData(["items", "films"])).toEqual(["toy-story"]);
    expect(seen.at(-1)).toEqual(["toy-story"]);
    expect(qc.getQueryData(["item", "pulp-fiction"])).toBeUndefined();
    expect(qc.getQueryData(["app-config", "https://srv"])).toEqual({ capabilities: ["rights.live"] });
    off();
  });
});
