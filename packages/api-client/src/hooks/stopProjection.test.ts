import { describe, expect, it } from "vitest";
import { judgeServerUserData, projectionPatch, projectStop, stopWorthDefending } from "./stopProjection";

const T = 10_000_000; // ticks par seconde
const FILM = 7314 * T; // 2 h 01 min 54 s

describe("projectStop — la règle de Jellyfin, de ce côté-ci", () => {
  it("le milieu d'un film : la position, et plus « vu »", () => {
    expect(projectStop({ positionSeconds: 1826, runtimeTicks: FILM })).toEqual({ positionTicks: 1826 * T, played: false });
  });

  it("sous 5 % : position 0, l'état « vu » n'est pas touché", () => {
    expect(projectStop({ positionSeconds: 300, runtimeTicks: FILM })).toEqual({ positionTicks: 0, played: null });
  });

  it("au-delà de MaxResumePct : « vu », position 0", () => {
    expect(projectStop({ positionSeconds: 7000, runtimeTicks: FILM })).toEqual({ positionTicks: 0, played: true });
    expect(projectStop({ positionSeconds: 6000, runtimeTicks: FILM, maxResumePct: 80 })).toEqual({ positionTicks: 0, played: true });
  });

  it("au bout, même sous le seuil réglé : « vu »", () => {
    expect(projectStop({ positionSeconds: 7314, runtimeTicks: FILM, maxResumePct: 100 })).toEqual({ positionTicks: 0, played: true });
  });

  it("un titre de moins de 5 min : « vu », jamais repris", () => {
    expect(projectStop({ positionSeconds: 120, runtimeTicks: 240 * T })).toEqual({ positionTicks: 0, played: true });
  });

  it("arrêt à 0 : rien ne change", () => {
    expect(projectStop({ positionSeconds: 0, runtimeTicks: FILM })).toEqual({ positionTicks: 0, played: null });
  });

  it("durée inconnue : le serveur tranche seul", () => {
    expect(projectStop({ positionSeconds: 1826, runtimeTicks: undefined })).toBeNull();
    expect(projectStop({ positionSeconds: 1826, runtimeTicks: 0 })).toBeNull();
    expect(projectStop({ positionSeconds: Number.NaN, runtimeTicks: FILM })).toBeNull();
  });
});

describe("projectionPatch — ce que la fiche et les listes montrent", () => {
  it("la reprise et son pourcentage, plus « vu »", () => {
    expect(projectionPatch({ positionTicks: 1826 * T, played: false }, FILM)).toEqual({
      PlaybackPositionTicks: 1826 * T, PlayedPercentage: (1826 / 7314) * 100, Played: false,
    });
  });

  it("sous le seuil : l'état « vu » reste celui qu'il était", () => {
    expect(projectionPatch({ positionTicks: 0, played: null }, FILM)).toEqual({ PlaybackPositionTicks: 0, PlayedPercentage: 0 });
  });
});

describe("stopWorthDefending — seulement le milieu du titre", () => {
  it("un film quitté à 25 % : défendu", () => {
    expect(stopWorthDefending({ positionTicks: 1826 * T, played: false }, FILM)).toBe(true);
  });

  it("trop près du début ou de la fin : le serveur décide", () => {
    expect(stopWorthDefending({ positionTicks: 600 * T, played: false }, FILM)).toBe(false); // 8 %
    expect(stopWorthDefending({ positionTicks: 6400 * T, played: false }, FILM)).toBe(false); // 87,5 %
  });

  it("un titre court, ou fini : jamais", () => {
    expect(stopWorthDefending({ positionTicks: 200 * T, played: false }, 500 * T)).toBe(false);
    expect(stopWorthDefending({ positionTicks: 0, played: true }, FILM)).toBe(false);
  });
});

describe("judgeServerUserData — la date gagne", () => {
  const stoppedAt = Date.parse("2026-10-01T16:22:39.341Z");
  const stop = { positionTicks: 2411 * T, played: false, stoppedAt };

  it("le cas mesuré : l'instantané du DÉBUT écrit en dernier — plus ancien, à corriger", () => {
    const data = { PlaybackPositionTicks: 1826 * T, Played: false, LastPlayedDate: "2026-10-01T16:21:26.000Z" };
    expect(judgeServerUserData(stop, data)).toBe("older");
  });

  it("une écriture en retard (position encore à 0) : plus ancienne", () => {
    expect(judgeServerUserData(stop, { PlaybackPositionTicks: 0, Played: false })).toBe("older");
  });

  it("le serveur a écrit notre arrêt : d'accord", () => {
    const data = { PlaybackPositionTicks: 2412 * T, Played: false, LastPlayedDate: "2026-10-01T16:21:26.000Z" };
    expect(judgeServerUserData(stop, data)).toBe("agrees");
  });

  it("une lecture commencée APRÈS notre arrêt (un autre appareil) : le serveur a raison", () => {
    const data = { PlaybackPositionTicks: 300 * T, Played: false, LastPlayedDate: "2026-10-01T16:23:10.000Z" };
    expect(judgeServerUserData(stop, data)).toBe("newer");
  });

  it("à deux secondes près de l'arrêt, le doute profite au serveur", () => {
    const data = { PlaybackPositionTicks: 0, Played: false, LastPlayedDate: "2026-10-01T16:22:38.000Z" };
    expect(judgeServerUserData(stop, data)).toBe("newer");
  });

  it("« vu » attendu mais pas écrit : plus ancien", () => {
    const done = { positionTicks: 0, played: true, stoppedAt };
    expect(judgeServerUserData(done, { PlaybackPositionTicks: 0, Played: false })).toBe("older");
    expect(judgeServerUserData(done, { PlaybackPositionTicks: 0, Played: true })).toBe("agrees");
  });
});
