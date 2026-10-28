import { describe, expect, it } from "vitest";
import { coreReadsImport, extensionImportSource, recognizeImportUrl, recognizeTentacleShare } from "./musicImport";
import { playlistShareUrl, readSharedPlaylist, sharedDocumentUrl, sharedImportTracks } from "./musicShare";

const TOKEN = "AbCdEfGhIjKlMnOpQrStUv";

describe("lien de partage d'une playlist Tentacle", () => {
  it("reconnu sur n'importe quel serveur, port et préfixe gardés, requête et barre finale retirées", () => {
    expect(recognizeTentacleShare(`https://musique.ami.fr/octave/share/${TOKEN}`)).toEqual({
      source: "tentacle", kind: "playlist", id: TOKEN, url: `https://musique.ami.fr/octave/share/${TOKEN}`,
    });
    expect(recognizeTentacleShare(`https://ami.fr:8443/tentacle/octave/share/${TOKEN}/?lang=en#x`)?.url).toBe(`https://ami.fr:8443/tentacle/octave/share/${TOKEN}`);
    expect(recognizeImportUrl(`https://ami.fr/octave/share/${TOKEN}`)?.source).toBe("tentacle");
  });

  it("refusé : jeton d'une autre longueur, identifiants dans l'adresse, autre protocole, autre chemin", () => {
    expect(recognizeTentacleShare(`https://ami.fr/octave/share/${TOKEN}x`)).toBeNull();
    expect(recognizeTentacleShare(`https://ami.fr/octave/share/abc`)).toBeNull();
    expect(recognizeTentacleShare(`https://user:pw@ami.fr/octave/share/${TOKEN}`)).toBeNull();
    expect(recognizeTentacleShare(`ftp://ami.fr/octave/share/${TOKEN}`)).toBeNull();
    expect(recognizeTentacleShare(`https://ami.fr/share/${TOKEN}`)).toBeNull();
    expect(recognizeTentacleShare(`https://ami.fr/octave/share/${TOKEN}/extra`)).toBeNull();
  });

  it("le document vit à côté du lien, sur le même serveur et le même préfixe", () => {
    expect(sharedDocumentUrl(`https://ami.fr:8443/t/octave/share/${TOKEN}`)).toBe(`https://ami.fr:8443/t/api/music/share/${TOKEN}`);
    expect(sharedDocumentUrl("https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M")).toBeNull();
    expect(playlistShareUrl("https://moi.fr/", TOKEN)).toBe(`https://moi.fr/octave/share/${TOKEN}`);
  });

  it("le cœur ne lit un lien Tentacle que s'il le déclare ; l'extension le reçoit comme une liste collée", () => {
    expect(coreReadsImport("tentacle", false)).toBe(false);
    expect(coreReadsImport("tentacle", true)).toBe(true);
    expect(coreReadsImport("spotify", false)).toBe(true);
    expect(extensionImportSource("tentacle")).toBe("text");
    expect(extensionImportSource("deezer")).toBe("deezer");
  });
});

describe("document d'un partage lu d'un autre serveur", () => {
  it("revérifié champ par champ : texte nettoyé, durée et MBID valides seulement, rangs dans l'ordre", () => {
    const doc = readSharedPlaylist({
      v: 1,
      name: "  Été\u0007 ",
      ownerName: "Ami",
      total: 3,
      tracks: [
        { title: "Un", artists: ["A", 4, "B"], album: "X", durationMs: 200_000, recording: "0F6E4B6C-1111-2222-3333-444455556666" },
        { title: "", artists: [] },
        { title: "Deux", artists: "A", durationMs: -3, recording: "pas-un-mbid", jellyfinId: "secret" },
      ],
    });
    expect(doc).toMatchObject({ v: 1, name: "Été", ownerName: "Ami", total: 3, truncated: true });
    expect(doc!.tracks).toEqual([
      { title: "Un", artists: ["A", "B"], album: "X", durationMs: 200_000, recording: "0f6e4b6c-1111-2222-3333-444455556666" },
      { title: "Deux", artists: [], album: null, durationMs: null, recording: null },
    ]);
    expect(sharedImportTracks(doc!).map((t) => [t.index, t.title, t.sourceId])).toEqual([
      [0, "Un", "0f6e4b6c-1111-2222-3333-444455556666"],
      [1, "Deux", null],
    ]);
  });

  it("une autre forme (version, pas de liste) : rien", () => {
    expect(readSharedPlaylist({ v: 2, tracks: [] })).toBeNull();
    expect(readSharedPlaylist({ v: 1 })).toBeNull();
    expect(readSharedPlaylist("x")).toBeNull();
  });
});
