import { describe, expect, it } from "vitest";
import { withShortSegments, SEGMENT_LENGTH_S } from "./segmentLength";

/**
 * La leçon qui a coûté une régression : sur ce manifeste, on AJOUTE, on ne
 * retire pas. Retirer `MediaSourceId` — qui semblait pourtant facultatif à la
 * lecture du code de Jellyfin — a fait répondre 400 et empêché toute lecture.
 * Ce qui suit borne donc autant ce qu'on touche que ce qu'on obtient.
 */

const MANIFEST = "/api/jellyfin/videos/abc/master.m3u8"
  + "?DeviceId=xyz&MediaSourceId=abc123&VideoCodec=hevc&AudioStreamIndex=2";

describe("manifeste HLS", () => {
  it("impose la longueur de segment", () => {
    expect(withShortSegments(MANIFEST)).toContain(`segmentLength=${SEGMENT_LENGTH_S}`);
  });

  it("ne retire ni ne modifie aucun paramètre existant", () => {
    const rendered = withShortSegments(MANIFEST)!;
    // MediaSourceId surtout : sans lui, le serveur répond 400.
    expect(rendered).toContain("MediaSourceId=abc123");
    expect(rendered).toContain("DeviceId=xyz");
    expect(rendered).toContain("VideoCodec=hevc");
    expect(rendered).toContain("AudioStreamIndex=2");
  });

  it("respecte une longueur déjà demandée par l'appelant", () => {
    const already = "/api/jellyfin/videos/abc/master.m3u8?segmentLength=4&x=1";
    expect(withShortSegments(already)).toBe(already);
  });

  it("vaut pour la variante comme pour le manifeste maître", () => {
    const variant = "/api/jellyfin/videos/abc/main.m3u8?x=1";
    expect(withShortSegments(variant)).toContain("segmentLength=");
  });

  it("garde la forme relative — le proxy sert sur la même origine", () => {
    const rendered = withShortSegments(MANIFEST)!;
    expect(rendered.startsWith("/api/jellyfin/")).toBe(true);
    expect(rendered).not.toContain("tentacle.invalid");
  });
});

describe("ce à quoi on ne touche pas", () => {
  it("laisse la lecture directe intacte", () => {
    // Pas de segments à découper : le fichier est servi tel quel.
    const direct = "/api/jellyfin/Videos/abc/stream?Static=true&MediaSourceId=abc123";
    expect(withShortSegments(direct)).toBe(direct);
  });

  it("rend l'absence d'URL telle quelle", () => {
    expect(withShortSegments(null)).toBeNull();
  });

  it("ne casse pas sur une URL inexploitable", () => {
    expect(withShortSegments("://pas-une-url")).toBe("://pas-une-url");
  });
});
