import { describe, expect, it } from "vitest";
import { isLibraryViewsPath, isSupportedLibrary, keepSupportedLibraries } from "./libraryViews";

/** Une réponse `Users/{id}/Views` de Jellyfin 10.11, une vue de chaque sorte. */
const VIEWS = [
  { Name: "Films", Type: "CollectionFolder", CollectionType: "movies" },
  { Name: "Séries", Type: "CollectionFolder", CollectionType: "tvshows" },
  { Name: "Animés", Type: "CollectionFolder", CollectionType: "tvshows" },
  // « Films et séries mélangés » : Jellyfin ne lui donne AUCUN type.
  { Name: "Tout", Type: "CollectionFolder" },
  // Option « Regrouper » : une vue synthétique, typée.
  { Name: "Films regroupés", Type: "UserView", CollectionType: "movies" },
  { Name: "Musique", Type: "CollectionFolder", CollectionType: "music" },
  { Name: "Livres", Type: "CollectionFolder", CollectionType: "books" },
  { Name: "Photos", Type: "CollectionFolder", CollectionType: "photos" },
  { Name: "Vidéos perso", Type: "CollectionFolder", CollectionType: "homevideos" },
  { Name: "Clips", Type: "CollectionFolder", CollectionType: "musicvideos" },
  { Name: "Collections", Type: "CollectionFolder", CollectionType: "boxsets" },
  { Name: "Listes de lecture", Type: "UserView", CollectionType: "playlists" },
  { Name: "Dossiers", Type: "UserView", CollectionType: "folders" },
  { Name: "TV en direct", Type: "UserView", CollectionType: "livetv" },
  // Une chaîne d'extension : sans type, comme une bibliothèque mixte.
  { Name: "Chaîne", Type: "Channel" },
];

function namesOf(buffer: Buffer): string[] {
  return (JSON.parse(buffer.toString("utf8")) as { Items: Array<{ Name: string }> }).Items.map((v) => v.Name);
}

describe("isSupportedLibrary", () => {
  it("films, séries et bibliothèques mixtes seulement", () => {
    expect(VIEWS.filter(isSupportedLibrary).map((v) => v.Name)).toEqual([
      "Films", "Séries", "Animés", "Tout", "Films regroupés",
    ]);
  });

  it("ne tient pas à la casse du type", () => {
    expect(isSupportedLibrary({ Type: "CollectionFolder", CollectionType: "TvShows" })).toBe(true);
  });

  it("« mixed » explicite : une bibliothèque, pas une chaîne", () => {
    expect(isSupportedLibrary({ Type: "CollectionFolder", CollectionType: "mixed" })).toBe(true);
    expect(isSupportedLibrary({ Type: "Channel", CollectionType: "mixed" })).toBe(false);
  });

  it("un type vide ou inattendu ne passe que sur un dossier de bibliothèque", () => {
    expect(isSupportedLibrary({ Type: "CollectionFolder", CollectionType: "" })).toBe(true);
    expect(isSupportedLibrary({ Type: "Folder" })).toBe(false);
    expect(isSupportedLibrary({ CollectionType: 42 })).toBe(false);
  });
});

describe("keepSupportedLibraries", () => {
  it("écarte le reste et recompte", () => {
    const body = Buffer.from(JSON.stringify({ Items: VIEWS, TotalRecordCount: VIEWS.length, StartIndex: 0 }));
    const out = JSON.parse(keepSupportedLibraries(body).toString("utf8"));
    expect(out.Items.map((v: { Name: string }) => v.Name)).toEqual(["Films", "Séries", "Animés", "Tout", "Films regroupés"]);
    expect(out.TotalRecordCount).toBe(5);
    expect(out.StartIndex).toBe(0);
  });

  it("rend le même tampon quand il n'y a rien à retirer", () => {
    const body = Buffer.from(JSON.stringify({ Items: VIEWS.slice(0, 3), TotalRecordCount: 3 }));
    expect(keepSupportedLibraries(body)).toBe(body);
  });

  it("une réponse illisible repart telle quelle", () => {
    for (const raw of ["<html>502</html>", "null", "[]", '{"Items":"x"}']) {
      const body = Buffer.from(raw);
      expect(keepSupportedLibraries(body)).toBe(body);
    }
  });

  it("une entrée qui n'est pas un objet est écartée", () => {
    const body = Buffer.from(JSON.stringify({ Items: [null, "Films", VIEWS[0]], TotalRecordCount: 3 }));
    expect(namesOf(keepSupportedLibraries(body))).toEqual(["Films"]);
  });
});

describe("isLibraryViewsPath", () => {
  it("la route des vues, quelle que soit la casse — la liste blanche l'accepte ainsi", () => {
    expect(isLibraryViewsPath("Users/abc/Views")).toBe(true);
    expect(isLibraryViewsPath("users/abc/views")).toBe(true);
  });

  it("rien d'autre", () => {
    expect(isLibraryViewsPath("Users/abc/Items")).toBe(false);
    expect(isLibraryViewsPath("Users/abc/Views/x")).toBe(false);
    expect(isLibraryViewsPath("UserViews")).toBe(false);
  });
});
