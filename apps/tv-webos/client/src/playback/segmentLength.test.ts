import { describe, expect, it } from "vitest";
import { avecSegmentsCourts, LONGUEUR_SEGMENT_S } from "./segmentLength";

/**
 * La leçon qui a coûté une régression : sur ce manifeste, on AJOUTE, on ne
 * retire pas. Retirer `MediaSourceId` — qui semblait pourtant facultatif à la
 * lecture du code de Jellyfin — a fait répondre 400 et empêché toute lecture.
 * Ce qui suit borne donc autant ce qu'on touche que ce qu'on obtient.
 */

const MANIFESTE = "/api/jellyfin/videos/abc/master.m3u8"
  + "?DeviceId=xyz&MediaSourceId=abc123&VideoCodec=hevc&AudioStreamIndex=2";

describe("manifeste HLS", () => {
  it("impose la longueur de segment", () => {
    expect(avecSegmentsCourts(MANIFESTE)).toContain(`segmentLength=${LONGUEUR_SEGMENT_S}`);
  });

  it("ne retire ni ne modifie aucun paramètre existant", () => {
    const rendu = avecSegmentsCourts(MANIFESTE)!;
    // MediaSourceId surtout : sans lui, le serveur répond 400.
    expect(rendu).toContain("MediaSourceId=abc123");
    expect(rendu).toContain("DeviceId=xyz");
    expect(rendu).toContain("VideoCodec=hevc");
    expect(rendu).toContain("AudioStreamIndex=2");
  });

  it("respecte une longueur déjà demandée par l'appelant", () => {
    const deja = "/api/jellyfin/videos/abc/master.m3u8?segmentLength=4&x=1";
    expect(avecSegmentsCourts(deja)).toBe(deja);
  });

  it("vaut pour la variante comme pour le manifeste maître", () => {
    const variante = "/api/jellyfin/videos/abc/main.m3u8?x=1";
    expect(avecSegmentsCourts(variante)).toContain("segmentLength=");
  });

  it("garde la forme relative — le proxy sert sur la même origine", () => {
    const rendu = avecSegmentsCourts(MANIFESTE)!;
    expect(rendu.startsWith("/api/jellyfin/")).toBe(true);
    expect(rendu).not.toContain("tentacle.invalid");
  });
});

describe("ce à quoi on ne touche pas", () => {
  it("laisse la lecture directe intacte", () => {
    // Pas de segments à découper : le fichier est servi tel quel.
    const direct = "/api/jellyfin/Videos/abc/stream?Static=true&MediaSourceId=abc123";
    expect(avecSegmentsCourts(direct)).toBe(direct);
  });

  it("rend l'absence d'URL telle quelle", () => {
    expect(avecSegmentsCourts(null)).toBeNull();
  });

  it("ne casse pas sur une URL inexploitable", () => {
    expect(avecSegmentsCourts("://pas-une-url")).toBe("://pas-une-url");
  });
});
