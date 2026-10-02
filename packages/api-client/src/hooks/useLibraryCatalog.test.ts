import { describe, expect, it } from "vitest";
import { getLibraryCatalogKey, prefetchLibraryCatalog, type CatalogFilters } from "./useLibraryCatalog";

/** L'URL de la première page, telle que la requête partirait. */
async function firstPageUrl(filters: CatalogFilters): Promise<string> {
  const urls: string[] = [];
  const client = {
    fetch: async <T,>(url: string): Promise<T> => {
      urls.push(url);
      return { Items: [], TotalRecordCount: 0 } as T;
    },
  };
  const qc = {
    prefetchInfiniteQuery: async (options: Record<string, unknown>) => {
      await (options.queryFn as (ctx: { pageParam?: unknown }) => Promise<unknown>)({ pageParam: 0 });
    },
  };
  await prefetchLibraryCatalog(qc, client, "user", "lib", filters);
  return urls[0];
}

const fieldsOf = (url: string) => new URL(url, "http://x").searchParams.get("Fields");

describe("useLibraryCatalog — champs demandés", () => {
  it("la grille d'Apple TV (« grid ») ne demande que le décompte des séries", async () => {
    const url = await firstPageUrl({ fields: "grid", limit: 60 });
    expect(fieldsOf(url)).toBe("RecursiveItemCount");
    expect(url).toContain("Limit=60");
  });

  it("Android TV (« light ») garde les sources, pour ses puces de qualité", async () => {
    expect(fieldsOf(await firstPageUrl({ fields: "light" }))).toBe("PrimaryImageAspectRatio,RecursiveItemCount,MediaSources");
  });

  it("le web (« full », défaut) garde studios et identifiants", async () => {
    expect(fieldsOf(await firstPageUrl({}))).toBe("PrimaryImageAspectRatio,ProviderIds,Studios,RecursiveItemCount,MediaSources");
  });

  it("les champs font partie de la clé : deux jeux, deux caches", () => {
    expect(getLibraryCatalogKey("lib", { fields: "grid" })).not.toEqual(getLibraryCatalogKey("lib", { fields: "light" }));
  });
});
