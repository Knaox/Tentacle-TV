/**
 * Le cache persisté de la home appartient à UN compte.
 *
 * Le défaut que ces tests verrouillent : ce persister sauvegarde aussi sur
 * `beforeunload` et `pagehide`. Un code qui change de compte efface donc le
 * stockage puis navigue — et la navigation réécrit aussitôt le cache en
 * mémoire, qui appartient encore au compte qu'on quitte. Un admin sorti du
 * mode impersonation retrouvait ainsi les reprises de lecture de l'autre.
 */

import { describe, expect, it } from "vitest";
import { attachQueryPersister, hydrateQueryClient, type PersistStorage } from "./queryPersister";

const CLE = "tentacle_query_cache_v1";
const ADMIN = "admin-1";
const CIBLE = "cible-2";
const WHITELIST = ["resume-items"] as const;

function stockage(initial?: string): PersistStorage & { lu(): string | null } {
  let valeur: string | null = initial ?? null;
  return {
    getItem: () => valeur,
    setItem: (_k: string, v: string) => {
      valeur = v;
    },
    removeItem: () => {
      valeur = null;
    },
    lu: () => valeur,
  };
}

interface EtatQuery {
  queryKey: unknown;
  state: { status: string; data: unknown; dataUpdatedAt: number };
}

/** Faux QueryClient : on n'a besoin que des deux méthodes que le persister utilise. */
function client(queries: EtatQuery[] = []) {
  const hydratees: Array<{ key: unknown; data: unknown }> = [];
  return {
    hydratees,
    qc: {
      setQueryData: (queryKey: unknown, data: unknown): unknown => {
        hydratees.push({ key: queryKey, data });
        return data;
      },
      getQueryCache: () => ({ findAll: () => queries }),
    },
  };
}

function sauvegarde(owner: string | null, entries: Record<string, unknown>): string {
  return JSON.stringify({ owner, entries });
}

function entree(data: unknown): { data: unknown; dataUpdatedAt: number } {
  return { data, dataUpdatedAt: Date.now() };
}

describe("hydratation", () => {
  it("rend le cache a son proprietaire", async () => {
    const store = stockage(sauvegarde(ADMIN, { '["resume-items"]': entree(["film-admin"]) }));
    const { qc, hydratees } = client();

    await hydrateQueryClient(qc, store, { whitelist: WHITELIST, owner: ADMIN });

    expect(hydratees).toHaveLength(1);
    expect(hydratees[0]?.data).toEqual(["film-admin"]);
  });

  it("refuse et efface le cache d'un autre compte", async () => {
    const store = stockage(sauvegarde(CIBLE, { '["resume-items"]': entree(["film-de-la-cible"]) }));
    const { qc, hydratees } = client();

    await hydrateQueryClient(qc, store, { whitelist: WHITELIST, owner: ADMIN });

    expect(hydratees).toHaveLength(0);
    // Le contenu de quelqu'un d'autre n'a pas a rester en attente.
    expect(store.lu()).toBeNull();
  });

  it("ecarte une sauvegarde heritee des qu'un proprietaire est exige", async () => {
    // Ancien format : la carte d'entrees NUE, sans proprietaire connu.
    const store = stockage(JSON.stringify({ '["resume-items"]': entree(["ancien"]) }));
    const { qc, hydratees } = client();

    await hydrateQueryClient(qc, store, { whitelist: WHITELIST, owner: ADMIN });

    expect(hydratees).toHaveLength(0);
  });

  it("hydrate le format herite quand aucun proprietaire n'est exige", async () => {
    // Mobile et TV n'etiquettent pas : leur comportement ne doit pas bouger.
    const store = stockage(JSON.stringify({ '["resume-items"]': entree(["ancien"]) }));
    const { qc, hydratees } = client();

    await hydrateQueryClient(qc, store, { whitelist: WHITELIST });

    expect(hydratees).toHaveLength(1);
    expect(hydratees[0]?.data).toEqual(["ancien"]);
  });
});

describe("sauvegarde", () => {
  it("etiquette au compte dont les donnees sont EN MEMOIRE", () => {
    const store = stockage();
    const { qc } = client([
      { queryKey: ["resume-items"], state: { status: "success", data: ["x"], dataUpdatedAt: Date.now() } },
    ]);

    // Detacher declenche la meme sauvegarde que `pagehide`.
    attachQueryPersister(qc, store, { whitelist: WHITELIST, owner: CIBLE })();

    const ecrit = JSON.parse(store.lu() ?? "{}") as { owner?: string };
    expect(ecrit.owner).toBe(CIBLE);
  });

  it("la sortie d'impersonation ne rend pas le contenu de l'autre", async () => {
    const store = stockage();

    // 1. Session impersonee : le cache en memoire est celui de la cible.
    const impersonee = client([
      {
        queryKey: ["resume-items"],
        state: { status: "success", data: ["film-de-la-cible"], dataUpdatedAt: Date.now() },
      },
    ]);
    const detacher = attachQueryPersister(impersonee.qc, store, {
      whitelist: WHITELIST,
      owner: CIBLE,
    });

    // 2. Sortie : le code efface le stockage, puis navigue — et la navigation
    //    declenche une derniere sauvegarde du cache en memoire.
    store.removeItem(CLE);
    detacher();
    expect(store.lu()).not.toBeNull(); // la sauvegarde a bien eu lieu

    // 3. Rechargement en admin : rien de la cible ne doit remonter.
    const admin = client();
    await hydrateQueryClient(admin.qc, store, { whitelist: WHITELIST, owner: ADMIN });
    expect(admin.hydratees).toHaveLength(0);
  });
});
