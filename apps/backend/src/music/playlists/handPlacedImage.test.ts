/** La règle « image posée à la main » d'après les chemins relevés sur Jellyfin 10.11 (28/10). */

import { describe, expect, it } from "vitest";
import { isHandPlacedImage } from "./playlistJellyfin";

const PLAYLIST = "/config/data/playlists/Probe";

describe("isHandPlacedImage", () => {
  it("le collage de Jellyfin vit dans ses métadonnées : pas posé à la main", () => {
    expect(isHandPlacedImage(PLAYLIST, "/config/metadata/library/4d/4d3915cb/poster.png")).toBe(false);
  });

  it("une image envoyée s'écrit dans le dossier de la playlist, JPEG comme PNG", () => {
    expect(isHandPlacedImage(PLAYLIST, `${PLAYLIST}/folder.jpg`)).toBe(true);
    expect(isHandPlacedImage(`${PLAYLIST}/`, `${PLAYLIST}/folder.png`)).toBe(true);
  });

  it("un dossier voisin au nom plus long n'est pas le dossier de la playlist", () => {
    expect(isHandPlacedImage(PLAYLIST, "/config/data/playlists/Probe 2/folder.jpg")).toBe(false);
  });

  it("chemins Windows (Tentacle Server pour Windows)", () => {
    expect(isHandPlacedImage("C:\\ProgramData\\Jellyfin\\data\\playlists\\New", "C:\\ProgramData\\Jellyfin\\data\\playlists\\New\\folder.jpg")).toBe(true);
    expect(isHandPlacedImage("C:\\ProgramData\\Jellyfin\\data\\playlists\\New", "C:\\ProgramData\\Jellyfin\\metadata\\library\\ab\\x\\poster.png")).toBe(false);
  });

  it("sans chemin : jamais « posée à la main »", () => {
    expect(isHandPlacedImage(undefined, `${PLAYLIST}/folder.jpg`)).toBe(false);
    expect(isHandPlacedImage(PLAYLIST, undefined)).toBe(false);
  });
});
