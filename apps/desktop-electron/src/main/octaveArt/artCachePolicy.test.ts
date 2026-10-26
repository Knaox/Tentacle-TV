import { describe, expect, it } from "vitest";
import { ART_UNTAGGED_MAX_AGE_MS, artEvictionPlan, artKey, isFetchableArt, isFreshArt, sniffImageType, type ArtFile } from "./artCachePolicy";

/** Octave — le cache disque des pochettes : une clé sans jeton, rangé par identité, borné. */

describe("la clé d'une pochette", () => {
  it("sans jeton, paramètres triés : un jeton renouvelé garde la même entrée", () => {
    const a = artKey("http://srv:3001/api/music/artwork/abc?tag=t1&size=128&api_key=JETON1");
    const b = artKey("http://srv:3001/api/music/artwork/abc?api_key=JETON2&size=128&tag=t1");
    expect(a).toBe("http://srv:3001/api/music/artwork/abc?size=128&tag=t1");
    expect(b).toBe(a);
    expect(artKey("https://x.test/a.jpg?ApiKey=z")).toBe("https://x.test/a.jpg");
  });

  it("une autre étiquette ou une autre taille : une autre entrée (la pochette changée se recharge)", () => {
    expect(artKey("http://srv/api/music/artwork/abc?tag=t2")).not.toBe(artKey("http://srv/api/music/artwork/abc?tag=t1"));
    expect(artKey("http://srv/api/music/artwork/abc?tag=t1&size=128")).not.toBe(artKey("http://srv/api/music/artwork/abc?tag=t1"));
  });

  it("http(s) seulement, sans identifiants dans l'adresse, bornée", () => {
    expect(isFetchableArt("file:///etc/passwd")).toBe(false);
    expect(isFetchableArt("tentacle://local/media/a.jpg")).toBe(false);
    expect(isFetchableArt("https://user:pw@x.test/a.jpg")).toBe(false);
    expect(isFetchableArt(`https://x.test/${"a".repeat(2_100)}`)).toBe(false);
    expect(artKey("pas une adresse")).toBeNull();
  });
});

describe("fraîcheur et type", () => {
  it("une image étiquetée vaut toujours ; une autre se relit après 30 jours", () => {
    expect(isFreshArt("http://s/a?tag=t", 0, 10 * ART_UNTAGGED_MAX_AGE_MS)).toBe(true);
    expect(isFreshArt("https://x/a.jpg", 0, ART_UNTAGGED_MAX_AGE_MS + 1)).toBe(false);
    expect(isFreshArt("https://x/a.jpg", 0, ART_UNTAGGED_MAX_AGE_MS)).toBe(true);
  });

  it("le type se lit dans les octets, jamais dans ce que dit le serveur", () => {
    const head = (bytes: number[]) => new Uint8Array([...bytes, ...new Array(12).fill(0)]);
    expect(sniffImageType(head([0xff, 0xd8, 0xff]))).toBe("image/jpeg");
    expect(sniffImageType(head([0x89, 0x50, 0x4e, 0x47]))).toBe("image/png");
    expect(sniffImageType(new TextEncoder().encode("<html><body>404</body>"))).toBeNull();
  });
});

describe("l'éviction", () => {
  const f = (owner: string, path: string, size: number, usedAt: number): ArtFile => ({ owner, path, size, usedAt });

  it("par identité, les moins récemment servis au-delà du plafond", () => {
    const files = [f("a", "a1", 60, 1), f("a", "a2", 60, 3), f("a", "a3", 60, 2), f("b", "b1", 60, 9)];
    expect(artEvictionPlan(files, "a", 130)).toEqual(["a1"]);
  });

  it("au-delà de 4 identités, les plus anciennes partent — jamais celle en cours", () => {
    const files = ["u1", "u2", "u3", "u4", "u5"].map((o, i) => f(o, `${o}/x`, 1, 100 - i));
    files.push(f("moi", "moi/x", 1, 0));
    expect(artEvictionPlan(files, "moi", 1_000, 4).sort()).toEqual(["u4/x", "u5/x"]);
  });
});
