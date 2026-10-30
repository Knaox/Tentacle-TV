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
