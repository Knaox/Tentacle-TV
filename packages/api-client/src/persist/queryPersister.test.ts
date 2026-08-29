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

const KEY = "tentacle_query_cache_v1";
const ADMIN = "admin-1";
const TARGET = "cible-2";
const WHITELIST = ["resume-items"] as const;

function storage(initial?: string): PersistStorage & { loaded(): string | null } {
  let value: string | null = initial ?? null;
  return {
    getItem: () => value,
    setItem: (_k: string, v: string) => {
      value = v;
    },
    removeItem: () => {
      value = null;
    },
    loaded: () => value,
  };
}

interface QueryState {
  queryKey: unknown;
  state: { status: string; data: unknown; dataUpdatedAt: number };
}

/** Faux QueryClient : on n'a besoin que des deux méthodes que le persister utilise. */
function client(queries: QueryState[] = []) {
  const hydrated: Array<{ key: unknown; data: unknown }> = [];
  return {
    hydrated,
    qc: {
      setQueryData: (queryKey: unknown, data: unknown): unknown => {
        hydrated.push({ key: queryKey, data });
        return data;
      },
      getQueryCache: () => ({ findAll: () => queries }),
    },
  };
}

function save(owner: string | null, entries: Record<string, unknown>): string {
  return JSON.stringify({ owner, entries });
}

function entry(data: unknown): { data: unknown; dataUpdatedAt: number } {
  return { data, dataUpdatedAt: Date.now() };
}

describe("hydratation", () => {
  it("rend le cache a son proprietaire", async () => {
    const store = storage(save(ADMIN, { '["resume-items"]': entry(["film-admin"]) }));
    const { qc, hydrated } = client();

    await hydrateQueryClient(qc, store, { whitelist: WHITELIST, owner: ADMIN });

    expect(hydrated).toHaveLength(1);
    expect(hydrated[0]?.data).toEqual(["film-admin"]);
  });

  it("refuse et efface le cache d'un autre compte", async () => {
    const store = storage(save(TARGET, { '["resume-items"]': entry(["film-de-la-cible"]) }));
    const { qc, hydrated } = client();

    await hydrateQueryClient(qc, store, { whitelist: WHITELIST, owner: ADMIN });

    expect(hydrated).toHaveLength(0);
    // Le contenu de quelqu'un d'autre n'a pas a rester en attente.
    expect(store.loaded()).toBeNull();
  });

  it("ecarte une sauvegarde heritee des qu'un proprietaire est exige", async () => {
    // Ancien format : la carte d'entrees NUE, sans proprietaire connu.
    const store = storage(JSON.stringify({ '["resume-items"]': entry(["ancien"]) }));
    const { qc, hydrated } = client();

    await hydrateQueryClient(qc, store, { whitelist: WHITELIST, owner: ADMIN });

    expect(hydrated).toHaveLength(0);
  });

  it("hydrate le format herite quand aucun proprietaire n'est exige", async () => {
    // Mobile et TV n'etiquettent pas : leur comportement ne doit pas bouger.
    const store = storage(JSON.stringify({ '["resume-items"]': entry(["ancien"]) }));
    const { qc, hydrated } = client();

    await hydrateQueryClient(qc, store, { whitelist: WHITELIST });

    expect(hydrated).toHaveLength(1);
    expect(hydrated[0]?.data).toEqual(["ancien"]);
  });
});

describe("sauvegarde", () => {
  it("etiquette au compte dont les donnees sont EN MEMOIRE", () => {
    const store = storage();
    const { qc } = client([
      { queryKey: ["resume-items"], state: { status: "success", data: ["x"], dataUpdatedAt: Date.now() } },
    ]);

    // Detacher declenche la meme sauvegarde que `pagehide`.
    attachQueryPersister(qc, store, { whitelist: WHITELIST, owner: TARGET })();

    const written = JSON.parse(store.loaded() ?? "{}") as { owner?: string };
    expect(written.owner).toBe(TARGET);
  });

  it("la sortie d'impersonation ne rend pas le contenu de l'autre", async () => {
    const store = storage();

    // 1. Session impersonee : le cache en memoire est celui de la cible.
    const impersonated = client([
      {
        queryKey: ["resume-items"],
        state: { status: "success", data: ["film-de-la-cible"], dataUpdatedAt: Date.now() },
      },
    ]);
    const detach = attachQueryPersister(impersonated.qc, store, {
      whitelist: WHITELIST,
      owner: TARGET,
    });

    // 2. Sortie : le code efface le stockage, puis navigue — et la navigation
    //    declenche une derniere sauvegarde du cache en memoire.
    store.removeItem(KEY);
    detach();
    expect(store.loaded()).not.toBeNull(); // la sauvegarde a bien eu lieu

    // 3. Rechargement en admin : rien de la cible ne doit remonter.
    const admin = client();
    await hydrateQueryClient(admin.qc, store, { whitelist: WHITELIST, owner: ADMIN });
    expect(admin.hydrated).toHaveLength(0);
  });
});
