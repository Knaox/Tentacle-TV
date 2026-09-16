import { describe, expect, it } from "vitest";
import {
  decideHlsTimeline, HLS_LANDING_MAX_S, HLS_START_MARGIN_S, hlsSeekOutsideRun, hlsSessionStart,
} from "./hlsTimeline";

/**
 * Les valeurs sont celles relevées le 16 septembre 2026 (ffprobe sur les
 * segments de Jellyfin 10.11, One Piece S16E25 et S17E25, conteneurs partant de
 * zéro) : segment 0 annoncé à 0 s, audio à 10,000 s ; segment 166 annoncé à
 * 498 s, audio à 507,957 s — le même décalage de dix secondes partout, celui
 * du muxeur MPEG-TS (2 × max_delay), que hls.js absorbe dans `initPTS`.
 */
describe("decideHlsTimeline — le temps du film est celui de hls.js, sauf atterrissage prouvé", () => {
  it("une session partie du segment 0 n'a pas cherché : son initPTS devient la base", () => {
    expect(decideHlsTimeline({ initPtsS: 10, firstFragmentSn: 0, knownBaseS: null }))
      .toEqual({ landingS: 0, baseS: 10, reason: "start" });
    expect(decideHlsTimeline({ initPtsS: 677.2 + 10, firstFragmentSn: 0, knownBaseS: null }))
      .toEqual({ landingS: 0, baseS: 687.2, reason: "start" });
  });

  it("sans base connue, un initPTS n'est PAS un atterrissage : rien n'est corrigé", () => {
    // Le cas qui affichait 22 min 49 à la fin d'un épisode de 22 min 39.
    expect(decideHlsTimeline({ initPtsS: 9.957, firstFragmentSn: 166, knownBaseS: null }))
      .toEqual({ landingS: 0, baseS: null, reason: "unknown-base" });
  });

  it("avec la base apprise, l'écart est un atterrissage et se corrige — même infime, même négatif", () => {
    const d = decideHlsTimeline({ initPtsS: 9.957, firstFragmentSn: 166, knownBaseS: 10 });
    expect(d.reason).toBe("landing");
    expect(d.landingS).toBeCloseTo(-0.043, 6);
    expect(d.baseS).toBe(10);
    const late = decideHlsTimeline({ initPtsS: 677.2 + 10 + 2.5, firstFragmentSn: 93, knownBaseS: 687.2 });
    expect(late.reason).toBe("landing");
    expect(late.landingS).toBeCloseTo(2.5, 6);
  });

  it("un écart qu'aucune image clé n'explique laisse tout en place", () => {
    const d = decideHlsTimeline({ initPtsS: 10 + 60, firstFragmentSn: 163, knownBaseS: 10 });
    expect(d).toEqual({ landingS: 0, baseS: 10, reason: "unknown-base" });
    expect(HLS_LANDING_MAX_S).toBeLessThan(60);
  });

  it("une valeur non finie ne corrige rien, et ne fait pas de base", () => {
    expect(decideHlsTimeline({ initPtsS: NaN, firstFragmentSn: 5, knownBaseS: 10 }).landingS).toBe(0);
    expect(decideHlsTimeline({ initPtsS: NaN, firstFragmentSn: 0, knownBaseS: null }).baseS).toBeNull();
  });
});

describe("hlsSeekOutsideRun — seul un retour avant la passe la quitte", () => {
  it("avant le début de la passe : session neuve", () => {
    expect(hlsSeekOutsideRun(330, 342)).toBe(true);
  });
  it("dans la passe, ou loin devant : la session tient, hls.js demande le segment", () => {
    expect(hlsSeekOutsideRun(400, 342)).toBe(false);
    expect(hlsSeekOutsideRun(900, 342)).toBe(false);
    expect(hlsSeekOutsideRun(342, 342)).toBe(false);
  });
});

describe("hlsSessionStart — où faire partir une session", () => {
  it("sans atterrissage, on vise la cible", () => {
    expect(hlsSessionStart(491.3, 0)).toBe(491.3);
    expect(hlsSessionStart(491.3, -0.043)).toBeCloseTo(491.343, 6);
    expect(hlsSessionStart(491.3, NaN)).toBe(491.3);
  });
  it("un atterrissage positif connu se retranche, avec un segment de marge", () => {
    expect(hlsSessionStart(491.3, 8.7)).toBeCloseTo(491.3 - 8.7 - HLS_START_MARGIN_S, 6);
  });
  it("ne passe jamais sous zéro", () => {
    expect(hlsSessionStart(5, 9.4)).toBe(0);
  });
});
