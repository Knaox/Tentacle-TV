import { describe, expect, it } from "vitest";
import { playlistShareShown } from "./useMusicPlaylistShare";

describe("règle 15 : « Partager » et l'import par lien n'existent qu'avec le droit", () => {
  it("serveur sans la capacité, sans la musique, ou compte sans « Partage public » (invité compris) : absent", () => {
    expect(playlistShareShown({ music: true, capable: true, allowed: true })).toBe(true);
    expect(playlistShareShown({ music: true, capable: true, allowed: false })).toBe(false);
    expect(playlistShareShown({ music: true, capable: false, allowed: true })).toBe(false);
    expect(playlistShareShown({ music: false, capable: true, allowed: true })).toBe(false);
  });
});
