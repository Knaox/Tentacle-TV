import { describe, expect, it, vi } from "vitest";

vi.mock("./phoneReleaseFiles", () => ({}));
const store = await import("./releaseSheetStore");

const file = (name: string) => ({ uri: `file:///cache/${name}`, name, size: 1, type: "audio/mpeg" });

describe("feuille « Importer une sortie » : les demandes", () => {
  it("des fichiers partagés l'un après l'autre se CUMULENT, et ne se prennent qu'une fois", () => {
    store.openReleaseSheet({ kind: "files", files: [file("01.mp3")] });
    store.openReleaseSheet({ kind: "files", files: [file("02.mp3")] });
    const taken = store.takeReleasePrefill();
    expect(taken?.kind === "files" && taken.files.map((f) => f.name)).toEqual(["01.mp3", "02.mp3"]);
    expect(store.takeReleasePrefill()).toBeNull();
    store.closeReleaseSheet();
    expect(store.readReleaseSheet()).toBeNull();
  });

  it("un lien remplace ce qui attendait ; l'entrée vide n'efface rien", () => {
    store.openReleaseSheet({ kind: "files", files: [file("01.mp3")] });
    store.openReleaseSheet({ kind: "link", url: "https://a.bandcamp.com/album/x", autoStart: true });
    store.openReleaseSheet();
    expect(store.takeReleasePrefill()).toEqual({ kind: "link", url: "https://a.bandcamp.com/album/x", autoStart: true });
    store.closeReleaseSheet();
  });
});
