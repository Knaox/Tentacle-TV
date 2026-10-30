import { describe, expect, it } from "vitest";
import type { MusicTrack } from "../../music";
import { bridgeTrackMeta } from "./bridgeAudioEngine";

const track = {
  key: "jf:t1",
  title: "Titre",
  artists: [{ name: "Artiste", mbid: null, jellyfinId: null }],
  album: { title: "Album", mbid: null, jellyfinId: "a1" },
  artworkUrl: "/api/music/art/a1?tag=x",
} as unknown as MusicTrack;
const auth = { baseUrl: "https://srv.example", token: "jeton", useCredentials: false };

describe("bridgeTrackMeta : la pochette de l'écran verrouillé", () => {
  it("en ligne : l'adresse du serveur, authentifiée", () => {
    expect(bridgeTrackMeta(track, auth).artworkUrl).toBe("https://srv.example/api/music/art/a1?tag=x&api_key=jeton");
  });

  it("la pochette GARDÉE sur l'appareil passe d'abord (hors ligne, le serveur ne répond pas)", () => {
    expect(bridgeTrackMeta(track, auth, "file:///kept/cover.jpg").artworkUrl).toBe("file:///kept/cover.jpg");
  });
});

describe("un titre lu depuis « Sur cet appareil » (sa pochette EST un fichier gardé)", () => {
  it("le fichier passe tel quel — jamais préfixé du serveur ni porteur du jeton", () => {
    const kept = { ...track, artworkUrl: "file:///var/app/Documents/offline/media/x/cover.jpg" } as MusicTrack;
    expect(bridgeTrackMeta(kept, auth).artworkUrl).toBe("file:///var/app/Documents/offline/media/x/cover.jpg");
  });
});
