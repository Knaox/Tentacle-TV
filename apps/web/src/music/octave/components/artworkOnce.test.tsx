import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * Octave — une pochette ne « spawne » qu'une fois : déjà montrée (cette
 * session, règle de D5 ; une session d'avant, par identité), elle s'affiche
 * d'emblée, sans fondu ; au bureau, elle passe par le cache disque de la
 * coquille, sans jeton vers un autre hôte.
 */

const disk = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => disk.get(k) ?? null,
  setItem: (k: string, v: string) => void disk.set(k, v),
  removeItem: (k: string) => void disk.delete(k),
});
vi.mock("@tentacle-tv/api-client", () => ({ useJellyfinClient: () => ({ getToken: () => null, useCredentials: true }) }));
vi.mock("../../../lib/backendBase", () => ({ getBackendBase: () => "" }));

const USER = JSON.stringify({ Id: "u1" });

async function fresh(keys: Record<string, string> = {}) {
  disk.clear();
  disk.set("tentacle_user", USER);
  for (const [k, v] of Object.entries(keys)) disk.set(k, v);
  vi.resetModules();
  const known = await import("./artworkKnown");
  const seen = await import("../../../lib/seenImages");
  const { Artwork } = await import("./Artwork");
  return { known, seen, Artwork };
}

beforeEach(() => vi.stubGlobal("Image", class { src = ""; complete = false; naturalWidth = 0; }));
afterEach(() => {
  vi.useRealTimers();
});

describe("l'adresse d'une pochette", () => {
  it("au bureau, toute adresse http(s) passe par le cache disque ; le jeton seulement vers le serveur", async () => {
    const { artworkSrcOf } = await import("./artworkSrc");
    const auth = { baseUrl: "http://srv:3001", token: "JETON", useCredentials: false };
    const lib = artworkSrcOf("/api/music/artwork/a?tag=t", auth, { owner: "srv|u1" })!;
    expect(lib.startsWith("tentacle://art/?o=srv%7Cu1&u=")).toBe(true);
    expect(new URL(lib).searchParams.get("u")).toBe("http://srv:3001/api/music/artwork/a?tag=t&api_key=JETON");
    const ext = artworkSrcOf("https://img.test/x.jpg", auth, { owner: "srv|u1" })!;
    expect(new URL(ext).searchParams.get("u")).toBe("https://img.test/x.jpg");
    // Une image gardée sur l'appareil, et le web : inchangés.
    expect(artworkSrcOf("tentacle://local/media/a/cover.jpg", auth, { owner: "o" })).toBe("tentacle://local/media/a/cover.jpg");
    expect(artworkSrcOf("/api/music/artwork/a", { ...auth, useCredentials: true })).toBe("http://srv:3001/api/music/artwork/a");
  });
});

describe("les pochettes connues d'une session à l'autre", () => {
  it("la clé ignore le jeton et le cache de la coquille", async () => {
    const { known } = await fresh();
    const viaCache = `tentacle://art/?o=x&u=${encodeURIComponent("http://srv/api/music/artwork/a?tag=t&api_key=J1")}`;
    expect(known.artKnownKey(viaCache)).toBe("http://srv/api/music/artwork/a?tag=t");
    expect(known.artKnownKey("http://srv/api/music/artwork/a?api_key=J2&tag=t")).toBe("http://srv/api/music/artwork/a?tag=t");
  });

  it("retenue pour la prochaine session de CETTE identité, jamais d'une autre", async () => {
    vi.useFakeTimers();
    let m = await fresh();
    m.known.markArtworkKnown("/api/music/artwork/a?tag=t");
    vi.advanceTimersByTime(3_000);
    const saved = disk.get("tentacle_octave_art_known")!;
    m = await fresh({ tentacle_octave_art_known: saved });
    expect(m.known.isArtworkKnown("/api/music/artwork/a?tag=t")).toBe(true);
    disk.set("tentacle_user", JSON.stringify({ Id: "u2" }));
    vi.resetModules();
    const other = await import("./artworkKnown");
    expect(other.isArtworkKnown("/api/music/artwork/a?tag=t")).toBe(false);
  });

  it("une pochette NEUVE garde son apparition douce ; une connue, déjà montrée ou d'avant, s'affiche d'emblée", async () => {
    const { known, seen, Artwork } = await fresh();
    const html = (url: string) => renderToStaticMarkup(<Artwork url={url} alt="x" />);
    expect(html("/api/music/artwork/neuve?tag=1")).toContain("opacity-0");
    seen.markImageSeen("/api/music/artwork/vue?tag=1");
    expect(html("/api/music/artwork/vue?tag=1")).toContain("opacity-100");
    known.markArtworkKnown("/api/music/artwork/hier?tag=1");
    expect(html("/api/music/artwork/hier?tag=1")).toContain("opacity-100");
  });

  it("la déconnexion oublie tout", async () => {
    const { known } = await fresh();
    known.markArtworkKnown("/api/music/artwork/a?tag=t");
    known.forgetArtworkKnown();
    expect(known.isArtworkKnown("/api/music/artwork/a?tag=t")).toBe(false);
    expect(disk.has("tentacle_octave_art_known")).toBe(false);
  });
});
