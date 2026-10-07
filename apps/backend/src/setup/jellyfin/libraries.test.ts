import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startFakeJellyfin, type FakeJellyfin } from "../../../test/setup/fakeJellyfin";
import { configureJellyfinGuard } from "./guardedFetch";
import { browseDirectory, createLibraries, listLibraries } from "./libraries";

let jf: FakeJellyfin;
beforeAll(async () => {
  jf = await startFakeJellyfin();
  configureJellyfinGuard({ allowLoopback: true });
});
afterAll(() => jf.close());
beforeEach(() => jf.requests.splice(0));

const LOCALE = { metadataLanguage: "fr", metadataCountry: "FR" };

describe("bibliothèques", () => {
  it("liste ce qui existe, champ par champ", async () => {
    jf.on("GET /Library/VirtualFolders", { status: 200, json: [{ Name: "Films", CollectionType: "movies", Locations: ["/media/films"], ItemId: "x" }] });
    expect(await listLibraries(jf.url, "cle")).toEqual([{ name: "Films", type: "movies", paths: ["/media/films"] }]);
  });

  it("crée ce qui manque, laisse ce qui existe, signale un dossier absent — un seul scan", async () => {
    jf.on("GET /Library/VirtualFolders", { status: 200, json: [{ Name: "films", CollectionType: "movies", Locations: [] }] });
    jf.on("POST /Environment/ValidatePath", ({ body }) => ((body as { Path: string }).Path === "/media/absent" ? { status: 404 } : { status: 204 }));
    jf.on("POST /Library/VirtualFolders", { status: 204 });
    jf.on("POST /Library/Refresh", { status: 204 });
    const outcomes = await createLibraries(jf.url, "cle", [
      { name: "Films", type: "movies", paths: ["/media/films"] },
      { name: "Séries, saison 1", type: "tvshows", paths: ["/media/series"] },
      { name: "Animés", type: "tvshows", paths: ["/media/absent"] },
      { name: "Divers", type: "mixed", paths: ["/media/divers"] },
    ], LOCALE);
    expect(outcomes).toEqual([
      { name: "Films", status: "exists" },
      { name: "Séries, saison 1", status: "created" },
      { name: "Animés", status: "failed", error: "jf_path_not_found" },
      { name: "Divers", status: "created" },
    ]);
    const [series, mixed] = jf.calls("POST /Library/VirtualFolders");
    expect(series.query.get("name")).toBe("Séries, saison 1");
    expect(series.query.get("collectionType")).toBe("tvshows");
    expect(series.query.get("paths")).toBeNull();
    expect(series.body).toEqual({
      LibraryOptions: { PathInfos: [{ Path: "/media/series" }], PreferredMetadataLanguage: "fr", MetadataCountryCode: "FR", EnableRealtimeMonitor: true },
    });
    expect(mixed.query.has("collectionType")).toBe(false);
    expect(jf.calls("POST /Library/Refresh")).toHaveLength(1);
  });

  it("parcourt les dossiers que voit Jellyfin, avec leur parent", async () => {
    jf.on("GET /Environment/DirectoryContents", ({ query }) =>
      query.get("path") === "/media"
        ? { status: 200, json: [{ Name: "films", Path: "/media/films", Type: "Directory" }, { Name: "series", Path: "/media/series", Type: "Directory" }] }
        : { status: 404 },
    );
    jf.on("GET /Environment/ParentPath", { status: 200, json: "/" });
    jf.on("GET /Environment/Drives", { status: 200, json: [{ Name: "/", Path: "/", Type: "Directory" }] });
    expect(await browseDirectory(jf.url, "cle", "/media")).toEqual({
      path: "/media", parent: "/", entries: [{ name: "films", path: "/media/films" }, { name: "series", path: "/media/series" }], style: "posix",
    });
    expect(jf.calls("GET /Environment/DirectoryContents")[0].query.get("includeFiles")).toBe("false");
    expect(await browseDirectory(jf.url, "cle", null)).toEqual({ path: null, parent: null, entries: [{ name: "/", path: "/" }], style: "posix" });
    await expect(browseDirectory(jf.url, "cle", "/nulle-part")).rejects.toMatchObject({ code: "jf_path_not_found" });
  });

  it("un Jellyfin sous Windows : ses lecteurs, et la forme de ses chemins le dit", async () => {
    jf.on("GET /Environment/Drives", { status: 200, json: [{ Name: "C:\\", Path: "C:\\" }, { Name: "D:\\", Path: "D:\\" }] });
    jf.on("GET /Environment/DirectoryContents", { status: 200, json: [{ Name: "Films", Path: "D:\\Films" }] });
    jf.on("GET /Environment/ParentPath", { status: 200, json: "" });
    expect(await browseDirectory(jf.url, "cle", null)).toMatchObject({ entries: [{ path: "C:\\" }, { path: "D:\\" }], style: "windows" });
    expect(await browseDirectory(jf.url, "cle", "D:\\")).toEqual({ path: "D:\\", parent: null, entries: [{ name: "Films", path: "D:\\Films" }], style: "windows" });
  });
});
