import { describe, expect, it, vi } from "vitest";

/**
 * « Lire / Reprendre » d'une série gardée DIT l'épisode qu'il va lancer : le défaut E du relevé
 * lançait l'épisode 1 au lieu du 3 ; la logique est corrigée, l'écran ne doit plus laisser de
 * doute — le code dans le bouton, la phrase dessous.
 */

vi.mock("../../components/detail/DetailPlayButton", () => ({
  remainingLabel: (minutes: number) => `reste ${minutes} min`,
}));

const { seriesPlayAction } = await import("./seriesPlayAction");
const { pickSeriesPlayTarget } = await import("@tentacle-tv/offline-core");

const MINUTE = 600_000_000;
const t = (key: string, values?: Record<string, unknown>) => (values ? `${key} ${JSON.stringify(values)}` : key);

const episode = (n: number, state: { played?: boolean; ratio?: number } = {}, season = 1) =>
  ({
    itemId: `e${season}-${n}`, title: `Épisode ${n}`, kind: "episode", status: "complete", seriesId: "s", seriesName: "Série",
    parentIndexNumber: season, indexNumber: n, runtimeTicks: 20 * MINUTE, played: state.played ?? false,
    positionTicks: Math.round(20 * MINUTE * (state.ratio ?? 0)), lastPlayedAt: state.ratio ? 10 : null, createdAt: 1,
  }) as never;

describe("seriesPlayAction", () => {
  it("reprend à l'épisode 3 quand les deux premiers sont vus et le troisième entamé", () => {
    const episodes = [episode(1, { played: true }), episode(2, { played: true }), episode(3, { ratio: 0.4 }), episode(4)];
    const action = seriesPlayAction(t, episodes, pickSeriesPlayTarget(episodes));
    expect(action?.itemId).toBe("e1-3");
    expect(action?.label).toBe("common:resume S1 · E3");
    expect(action?.targetLine).toContain("downloads:playTargetResume");
    expect(action?.targetLine).toContain('"episode":3');
    expect(action?.remaining).toBe("reste 12 min");
  });

  it("continue avec le premier épisode pas encore vu", () => {
    const episodes = [episode(1, { played: true }), episode(2, { played: true }), episode(3)];
    const action = seriesPlayAction(t, episodes, pickSeriesPlayTarget(episodes));
    expect(action?.label).toBe("common:resume S1 · E3");
    expect(action?.targetLine).toContain("downloads:playTargetNext");
  });

  it("dit aussi l'épisode d'une série jamais commencée — la machine ne garde pas toujours le premier", () => {
    const episodes = [episode(4), episode(5)];
    const action = seriesPlayAction(t, episodes, pickSeriesPlayTarget(episodes));
    expect(action?.itemId).toBe("e1-4");
    expect(action?.label).toBe("common:play S1 · E4");
    expect(action?.targetLine).toContain("downloads:playTargetStart");
  });

  it("série vue en entier : repart du premier épisode gardé, et le dit", () => {
    const episodes = [episode(1, { played: true }), episode(2, { played: true })];
    const action = seriesPlayAction(t, episodes, pickSeriesPlayTarget(episodes));
    expect(action?.label).toBe("common:play S1 · E1");
    expect(action?.targetLine).toContain("downloads:playTargetAgain");
  });

  it("rien à lancer sans épisode", () => {
    expect(seriesPlayAction(t, [], null)).toBeNull();
  });
});
