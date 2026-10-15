import { describe, expect, it } from "vitest";
import {
  CARD_ENTER_MS, CARD_SPREAD_MS, CARD_STEP_MS, ROW_BATCH_WINDOW_MS, ROW_MAX_DELAY_MS, ROW_STEP_MS,
  cardEntranceDelays, createEntranceClock, entranceKeyframes, CARD_FROM,
} from "./rowEntrance";

describe("cardEntranceDelays", () => {
  it("rien à animer, rien à attendre", () => {
    expect(cardEntranceDelays(0)).toEqual([]);
    expect(cardEntranceDelays(1)).toEqual([0]);
  });

  it("peu de cartes : l'écart idéal, dans l'ordre de la piste", () => {
    expect(cardEntranceDelays(3)).toEqual([0, CARD_STEP_MS, 2 * CARD_STEP_MS]);
  });

  it("beaucoup de cartes : la cascade tient dans sa fenêtre, la rangée sous 450 ms", () => {
    for (const count of [7, 9, 14]) {
      const delays = cardEntranceDelays(count);
      expect(delays).toHaveLength(count);
      expect(delays[count - 1]).toBeLessThanOrEqual(CARD_SPREAD_MS);
      expect(delays[count - 1] + CARD_ENTER_MS).toBeLessThanOrEqual(450);
      // Strictement croissante : l'ordre se lit encore.
      delays.slice(1).forEach((d, i) => expect(d).toBeGreaterThan(delays[i]));
    }
  });
});

describe("createEntranceClock", () => {
  it("une rangée qui entre seule part tout de suite", () => {
    const clock = createEntranceClock();
    expect(clock.slot(1_000)).toBe(0);
    expect(clock.slot(5_000)).toBe(0);
  });

  it("des rangées qui entrent ensemble se suivent, sans dépasser le plafond", () => {
    const clock = createEntranceClock();
    const delays = [0, 1, 2, 3, 4, 5].map((i) => clock.slot(2_000 + i));
    expect(delays).toEqual([0, ROW_STEP_MS, 2 * ROW_STEP_MS, ROW_MAX_DELAY_MS, ROW_MAX_DELAY_MS, ROW_MAX_DELAY_MS]);
  });

  it("le lot se referme passé sa fenêtre", () => {
    const clock = createEntranceClock();
    clock.slot(0);
    expect(clock.slot(ROW_BATCH_WINDOW_MS - 1)).toBe(ROW_STEP_MS);
    expect(clock.slot(10 * ROW_BATCH_WINDOW_MS)).toBe(0);
  });
});

describe("entranceKeyframes", () => {
  it("transform et opacité seulement, et l'arrivée rend la carte à ses propres styles", () => {
    const frames = entranceKeyframes(CARD_FROM);
    const props = new Set(frames.flatMap((f) => Object.keys(f)).filter((k) => k !== "offset"));
    expect([...props].sort()).toEqual(["opacity", "transform"]);
    expect(frames[frames.length - 1]).toMatchObject({ opacity: 1, transform: "none" });
  });
});
