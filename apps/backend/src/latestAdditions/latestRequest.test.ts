import { describe, expect, it } from "vitest";
import { LATEST_SCAN_LIMIT, latestDetailsPath, latestScanPath, matchLatestRequest } from "./latestRequest";

/** Les requêtes de l'api-client (`latestItemsQueryOptions`), telles qu'elles partent. */
const PRESENTATION = "&Fields=PrimaryImageAspectRatio,SeriesName,SeriesId,ParentIndexNumber,IndexNumber,MediaSources"
  + "&EnableImageTypes=Primary,Backdrop,Thumb&ImageTypeLimit=1&EnableUserData=true";
const SERIES_ROW = "?ParentId=lib1&Recursive=true&IncludeItemTypes=Episode&SortBy=DateCreated&SortOrder=Descending"
  + `&Limit=100${PRESENTATION}`;
const MIXED_ROW = "?ParentId=lib3&Recursive=true&SortBy=DateCreated&SortOrder=Descending&Limit=16"
  + "&Fields=Overview,Genres,PrimaryImageAspectRatio,MediaSources,ProviderIds&EnableImageTypes=Primary,Backdrop,Thumb"
  + "&ImageTypeLimit=1&EnableUserData=true";

describe("matchLatestRequest", () => {
  it("reconnaît la rangée d'une bibliothèque de séries : vingt cartes au plus, la présentation du client gardée", () => {
    const req = matchLatestRequest("Users/u1/Items", SERIES_ROW);
    expect(req).toEqual({
      userId: "u1",
      parentId: "lib1",
      kind: "episodes",
      cards: 20,
      presentation: [
        ["Fields", "PrimaryImageAspectRatio,SeriesName,SeriesId,ParentIndexNumber,IndexNumber,MediaSources"],
        ["EnableImageTypes", "Primary,Backdrop,Thumb"],
        ["ImageTypeLimit", "1"],
        ["EnableUserData", "true"],
      ],
    });
  });

  it("la fenêtre du mode économie (40) rend aussi vingt cartes", () => {
    expect(matchLatestRequest("Users/u1/Items", SERIES_ROW.replace("Limit=100", "Limit=40"))?.cards).toBe(20);
  });

  it("une bibliothèque mixte : la rangée demandée (16), tous types confondus", () => {
    expect(matchLatestRequest("Users/u1/Items", MIXED_ROW)).toMatchObject({ kind: "mixed", cards: 16, parentId: "lib3" });
  });

  it("les films partent tels quels : rien à regrouper", () => {
    expect(matchLatestRequest("Users/u1/Items", SERIES_ROW.replace("IncludeItemTypes=Episode", "IncludeItemTypes=Movie"))).toBeNull();
  });

  it("le catalogue d'une bibliothèque, trié lui aussi par date d'ajout, n'est pas la rangée", () => {
    const catalog = "?ParentId=lib1&SortBy=DateCreated&SortOrder=Descending&IncludeItemTypes=Movie,Series&Recursive=true"
      + "&Fields=RecursiveItemCount&ExcludeLocationTypes=Virtual&IsMissing=false&EnableImageTypes=Primary,Backdrop"
      + "&ImageTypeLimit=1&Limit=30&StartIndex=0&EnableTotalRecordCount=true&EnableUserData=true";
    expect(matchLatestRequest("Users/u1/Items", catalog)).toBeNull();
  });

  it("le moindre paramètre de plus — un filtre, une page — et ce n'est plus la rangée", () => {
    expect(matchLatestRequest("Users/u1/Items", `${SERIES_ROW}&Filters=IsUnplayed`)).toBeNull();
    expect(matchLatestRequest("Users/u1/Items", `${SERIES_ROW}&StartIndex=20`)).toBeNull();
    expect(matchLatestRequest("Users/u1/Items", `${SERIES_ROW}&Limit=5`)).toBeNull();
  });

  it("chaque condition de la rangée compte", () => {
    expect(matchLatestRequest("Users/u1/Items", SERIES_ROW.replace("SortOrder=Descending", "SortOrder=Ascending"))).toBeNull();
    expect(matchLatestRequest("Users/u1/Items", SERIES_ROW.replace("SortBy=DateCreated", "SortBy=SortName"))).toBeNull();
    expect(matchLatestRequest("Users/u1/Items", SERIES_ROW.replace("Recursive=true", "Recursive=false"))).toBeNull();
    expect(matchLatestRequest("Users/u1/Items", SERIES_ROW.replace("ParentId=lib1", "ParentId="))).toBeNull();
    expect(matchLatestRequest("Users/u1/Items", SERIES_ROW.replace("Limit=100", "Limit=beaucoup"))).toBeNull();
  });

  it("se lit sans égard à la casse, avec ou sans « ? », jeton en query compris", () => {
    const lower = SERIES_ROW.slice(1).toLowerCase().replace("parentid=lib1", "parentid=LIB1");
    expect(matchLatestRequest("users/u1/items", `${lower}&api_key=jeton`)).toMatchObject({ kind: "episodes", parentId: "LIB1" });
  });

  it("ni `Users/Me`, ni une autre route", () => {
    expect(matchLatestRequest("Users/Me/Items", SERIES_ROW)).toBeNull();
    expect(matchLatestRequest("Users/u1/Items/Latest", SERIES_ROW)).toBeNull();
    expect(matchLatestRequest("Items", SERIES_ROW)).toBeNull();
  });
});

describe("les requêtes faites à Jellyfin", () => {
  const series = matchLatestRequest("Users/u1/Items", SERIES_ROW)!;
  const mixed = matchLatestRequest("Users/u1/Items", MIXED_ROW)!;

  it("l'inventaire : champs minimaux, sans images ni données du compte, saisons et séries comprises", () => {
    const params = new URLSearchParams(latestScanPath(series).split("?")[1]);
    expect(latestScanPath(series).startsWith("Items?")).toBe(true);
    expect(Object.fromEntries(params)).toEqual({
      userId: "u1", ParentId: "lib1", Recursive: "true", SortBy: "DateCreated", SortOrder: "Descending",
      Limit: String(LATEST_SCAN_LIMIT), Fields: "DateCreated", EnableImages: "false", EnableUserData: "false",
      EnableTotalRecordCount: "false", ExcludeLocationTypes: "Virtual", IncludeItemTypes: "Episode,Season,Series",
    });
  });

  it("l'inventaire d'une bibliothèque mixte garde tous les types, comme le client", () => {
    expect(new URLSearchParams(latestScanPath(mixed).split("?")[1]).has("IncludeItemTypes")).toBe(false);
  });

  it("les cartes : en un appel, avec la présentation du client", () => {
    const params = new URLSearchParams(latestDetailsPath(series, ["s1", "e2", "m3"]).split("?")[1]);
    expect(Object.fromEntries(params)).toEqual({
      userId: "u1", Ids: "s1,e2,m3", EnableTotalRecordCount: "false",
      Fields: "PrimaryImageAspectRatio,SeriesName,SeriesId,ParentIndexNumber,IndexNumber,MediaSources",
      EnableImageTypes: "Primary,Backdrop,Thumb", ImageTypeLimit: "1", EnableUserData: "true",
    });
  });
});
