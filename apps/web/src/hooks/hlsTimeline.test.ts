import { describe, expect, it } from "vitest";
import {
  decideHlsTimeline, HLS_ADJACENT_S, HLS_LANDING_MAX_S, HLS_START_MARGIN_S, hlsSeekOutsideRun, hlsSessionStart,
} from "./hlsTimeline";

/**
 * Les valeurs sont celles relevées le 16 septembre 2026 sur One Piece S17 :
 * segment 163 annoncé à 489 s, contenu à 497,701 s (audio), soit un initPTS
 * de 8,701 s ; sur l'épisode suivant, 7,501 s.
 */
describe("decideHlsTimeline — le temps du film derrière celui de hls.js", () => {
  it("une session partie du segment 0 n'a pas cherché : son initPTS est la base", () => {
    expect(decideHlsTimeline({ initPtsS: 677.2, firstFragmentSn: 0, knownBaseS: null }))
      .toEqual({ landingS: 0, baseS: 677.2, reason: "start" });
  });

  it("un rechargement en cours de film, base zéro : l'atterrissage se corrige", () => {
    expect(decideHlsTimeline({ initPtsS: 8.701, firstFragmentSn: 163, knownBaseS: null }))
      .toEqual({ landingS: 8.701, baseS: null, reason: "landing" });
  });

  it("la base apprise se retranche avant de juger l'atterrissage", () => {
    const d = decideHlsTimeline({ initPtsS: 677.2 + 7.501, firstFragmentSn: 93, knownBaseS: 677.2 });
    expect(d.reason).toBe("landing");
    expect(d.landingS).toBeCloseTo(7.501, 6);
    expect(d.baseS).toBe(677.2);
  });

  it("un atterrissage avant l'image clé visée est négatif, et corrigé aussi", () => {
    expect(decideHlsTimeline({ initPtsS: -2.4, firstFragmentSn: 40, knownBaseS: null }).landingS).toBe(-2.4);
  });

  it("un initPTS qu'aucune image clé n'explique est une base inconnue : rien n'est corrigé", () => {
    const d = decideHlsTimeline({ initPtsS: 677.2 + 8.7, firstFragmentSn: 163, knownBaseS: null });
    expect(d).toEqual({ landingS: 0, baseS: null, reason: "unknown-base" });
    expect(HLS_LANDING_MAX_S).toBeLessThan(677);
  });

  it("une valeur non finie ne corrige rien", () => {
    expect(decideHlsTimeline({ initPtsS: NaN, firstFragmentSn: 5, knownBaseS: null }).landingS).toBe(0);
  });
});

describe("hlsSeekOutsideRun — un saut qui ferait relancer ffmpeg dans la session", () => {
  it("avant le début de la passe : session neuve", () => {
    expect(hlsSeekOutsideRun(330, 342, 500)).toBe(true);
  });
  it("dans la passe, ou juste devant le tampon : hls.js s'en charge", () => {
    expect(hlsSeekOutsideRun(400, 342, 500)).toBe(false);
    expect(hlsSeekOutsideRun(500 + HLS_ADJACENT_S - 0.1, 342, 500)).toBe(false);
  });
  it("loin devant le tampon : session neuve", () => {
    expect(hlsSeekOutsideRun(500 + HLS_ADJACENT_S + 0.1, 342, 500)).toBe(true);
  });
  it("tampon vide : seul le début de la passe compte", () => {
    expect(hlsSeekOutsideRun(900, 342, null)).toBe(false);
    expect(hlsSeekOutsideRun(300, 342, null)).toBe(true);
  });
});

describe("hlsSessionStart — une session part un segment avant sa cible", () => {
  it("retranche l'atterrissage et la marge", () => {
    expect(hlsSessionStart(491.3, 8.7)).toBeCloseTo(491.3 - 8.7 - HLS_START_MARGIN_S, 6);
  });
  it("sans atterrissage connu, seule la marge joue", () => {
    expect(hlsSessionStart(30, 0)).toBe(30 - HLS_START_MARGIN_S);
  });
  it("ne passe jamais sous zéro", () => {
    expect(hlsSessionStart(5, 9.4)).toBe(0);
  });
});
