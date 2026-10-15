import { describe, expect, it } from "vitest";
import { fetchDeletableEntries, fetchLibraryDeletableIndex } from "./deletableIndex";

/** Une bibliothèque de `count` titres, que Jellyfin sert par pages ; « CanDelete » faux pour ceux de `refused`. */
function fakeJellyfin(count: number, refused: Set<number> = new Set()) {
  const urls: string[] = [];
  const items = Array.from({ length: count }, (_, i) => ({
    Id: `id${i}`,
    Name: `Titre ${i}`,
    Type: i === 3 ? "Series" : "Movie",
    // La série n°3 n'a aucun épisode : la grille ne la montre pas.
    RecursiveItemCount: i === 3 ? 0 : undefined,
    CanDelete: !refused.has(i),
  }));
  const client = {
    fetch: async <T,>(url: string): Promise<T> => {
      urls.push(url);
      const params = new URL(url, "http://x").searchParams;
      const ids = params.get("Ids");
      if (ids) return { Items: items.filter((it) => ids.split(",").includes(it.Id)) } as T;
      const start = Number(params.get("StartIndex"));
      const limit = Number(params.get("Limit"));
      return { Items: items.slice(start, start + limit), TotalRecordCount: count } as T;
    },
  };
  return { client, urls };
}

describe("fetchLibraryDeletableIndex — « tout sélectionner » porte sur la bibliothèque filtrée entière", () => {
  it("relève TOUS les titres au-delà de la page chargée, dans l'ordre, avec le verdict de Jellyfin", async () => {
    const { client, urls } = fakeJellyfin(1234, new Set([7]));
    const index = await fetchLibraryDeletableIndex(client, "u", "lib", { sortBy: "SortName", sortOrder: "Ascending", genreIds: ["g1"], searchTerm: "jet" });
    expect(urls).toHaveLength(3);
    expect(index.order).toHaveLength(1233);
    expect(index.order.slice(0, 4)).toEqual(["id0", "id1", "id2", "id4"]);
    expect(index.entries.get("id7")?.canDelete).toBe(false);
    expect(index.entries.get("id1200")).toEqual({ id: "id1200", name: "Titre 1200", type: "Movie", canDelete: true });
    const params = new URL(urls[0], "http://x").searchParams;
    expect(params.get("Fields")).toBe("CanDelete,RecursiveItemCount");
    expect(params.get("EnableImages")).toBe("false");
    expect(params.get("EnableUserData")).toBe("true");
    // Mêmes filtres et même tri que la grille.
    expect([params.get("SortBy"), params.get("GenreIds"), params.get("searchTerm"), params.get("IncludeItemTypes")])
      .toEqual(["SortName", "g1", "jet", "Movie,Series"]);
  });
});

describe("fetchLibraryDeletableIndex — une bibliothèque de séries", () => {
  /**
   * Comme Jellyfin : `RecursiveItemCount` d'un dossier n'est rempli que par le
   * calcul des données de visionnage (`Folder.FillUserDataDtoValues`), donc
   * jamais avec `EnableUserData=false`.
   */
  function fakeSeriesLibrary() {
    const items = [
      { Id: "s0", Name: "Dark", Type: "Series", episodes: 26 },
      { Id: "s1", Name: "Vide", Type: "Series", episodes: 0 },
      { Id: "s2", Name: "Breaking Bad", Type: "Series", episodes: 62 },
    ];
    return {
      fetch: async <T,>(url: string): Promise<T> => {
        const params = new URL(url, "http://x").searchParams;
        const userData = params.get("EnableUserData") === "true";
        return {
          Items: items.map(({ episodes, ...item }) => ({
            ...item,
            CanDelete: true,
            ...(userData ? { RecursiveItemCount: episodes } : {}),
          })),
          TotalRecordCount: items.length,
        } as T;
      },
    };
  }

  it("garde les séries qui ont des épisodes — un compte qui peut supprimer a de quoi sélectionner", async () => {
    const index = await fetchLibraryDeletableIndex(fakeSeriesLibrary(), "u", "lib", {});
    expect(index.order).toEqual(["s0", "s2"]);
    expect([...index.entries.values()].every((entry) => entry.canDelete)).toBe(true);
  });
});

describe("fetchDeletableEntries", () => {
  it("demande les titres nommés par paquets de cent, et ignore ceux que Jellyfin ne rend pas", async () => {
    const { client, urls } = fakeJellyfin(250, new Set([2]));
    const ids = [...Array.from({ length: 150 }, (_, i) => `id${i}`), "inconnu"];
    const index = await fetchDeletableEntries(client, "u", ids);
    expect(urls).toHaveLength(2);
    expect(urls[0]).toContain("Fields=CanDelete");
    expect(index.order).toHaveLength(150);
    expect(index.entries.get("id2")?.canDelete).toBe(false);
    expect(index.entries.has("inconnu")).toBe(false);
  });
});
