import { describe, expect, it } from "vitest";
import { sansSourceDesignee } from "./sourceDesignee";

/**
 * Les deux erreurs possibles ne se voient ni l'une ni l'autre au moment où on
 * les commet. Retirer trop peu, et le téléviseur se refige au même endroit —
 * cinquante secondes d'image morte que rien ne relance. Retirer trop, et
 * Jellyfin sert un AUTRE fichier que celui qu'on croit lire : durée différente,
 * pistes décalées, et personne pour le dire.
 */

const MANIFESTE = "/api/jellyfin/videos/abc/master.m3u8"
  + "?DeviceId=xyz&MediaSourceId=abc123&VideoCodec=hevc&AudioStreamIndex=2";

describe("source unique", () => {
  it("retire la source désignée du manifeste", () => {
    const rendu = sansSourceDesignee(MANIFESTE, 1)!;
    expect(rendu).not.toContain("MediaSourceId");
    expect(rendu.startsWith("/api/jellyfin/videos/abc/master.m3u8?")).toBe(true);
  });

  it("ne touche à rien d'autre dans la requête", () => {
    const rendu = sansSourceDesignee(MANIFESTE, 1)!;
    // Les index de pistes surtout : c'est eux qui désignent la langue.
    expect(rendu).toContain("AudioStreamIndex=2");
    expect(rendu).toContain("VideoCodec=hevc");
    expect(rendu).toContain("DeviceId=xyz");
  });

  it("vaut aussi pour la variante, pas seulement le manifeste maître", () => {
    const variante = "/api/jellyfin/videos/abc/main.m3u8?MediaSourceId=abc123&x=1";
    expect(sansSourceDesignee(variante, 1)).toBe("/api/jellyfin/videos/abc/main.m3u8?x=1");
  });
});

describe("ce à quoi on ne touche pas", () => {
  /**
   * La régression à ne pas commettre. Sur un film à plusieurs versions, la
   * source désignée est le SEUL moyen de lire la bonne : sans elle, Jellyfin
   * retombe sur la source par défaut de l'item et sert l'autre fichier.
   */
  it("laisse le manifeste intact dès qu'il y a plusieurs versions", () => {
    expect(sansSourceDesignee(MANIFESTE, 2)).toBe(MANIFESTE);
    expect(sansSourceDesignee(MANIFESTE, 5)).toBe(MANIFESTE);
  });

  it("laisse la lecture directe intacte", () => {
    // Là, l'URL ne demande pas un découpage : elle désigne le fichier à servir.
    const direct = "/api/jellyfin/Videos/abc/stream?Static=true&MediaSourceId=abc123";
    expect(sansSourceDesignee(direct, 1)).toBe(direct);
  });

  it("ne s'invente rien quand il n'y a pas de source à retirer", () => {
    const sans = "/api/jellyfin/videos/abc/master.m3u8?DeviceId=xyz";
    expect(sansSourceDesignee(sans, 1)).toBe(sans);
  });

  it("rend l'absence d'URL telle quelle", () => {
    expect(sansSourceDesignee(null, 1)).toBeNull();
  });

  it("ne casse pas sur une URL inexploitable", () => {
    expect(sansSourceDesignee("://pas-une-url", 1)).toBe("://pas-une-url");
  });

  it("garde la forme relative — le proxy sert sur la même origine", () => {
    const rendu = sansSourceDesignee(MANIFESTE, 1)!;
    expect(rendu.startsWith("/")).toBe(true);
    expect(rendu).not.toContain("tentacle.invalid");
  });
});
