import { describe, expect, it } from "vitest";
import { afterChoiceLabel, countdownChoiceLabel, stillWatchingChoices } from "./stillWatchingChoices";

// Une traduction factice qui dit la clé et le nombre : on teste le CHOIX de la clé.
const t = (key: string, options?: { count: number }) => (options ? `${key}:${options.count}` : key);

describe("stillWatchingChoices", () => {
  it("dit les durées avant la question en heures, et 1 h 30 à part", () => {
    expect(afterChoiceLabel(3_600_000, t)).toBe("stillWatchingHours:1");
    expect(afterChoiceLabel(5_400_000, t)).toBe("stillWatchingHourHalf");
    expect(afterChoiceLabel(7_200_000, t)).toBe("stillWatchingHours:2");
    expect(afterChoiceLabel(10_800_000, t)).toBe("stillWatchingHours:3");
  });

  it("dit les délais de réponse en secondes, et la minute à part", () => {
    expect(countdownChoiceLabel(10_000, t)).toBe("stillWatchingSeconds:10");
    expect(countdownChoiceLabel(30_000, t)).toBe("stillWatchingSeconds:30");
    expect(countdownChoiceLabel(60_000, t)).toBe("stillWatchingMinute");
  });

  it("reprend la liste FERMÉE de shared, valeurs en millisecondes", () => {
    const { after, countdown } = stillWatchingChoices(t);
    expect(after.map((option) => option.value)).toEqual(["3600000", "5400000", "7200000", "10800000"]);
    expect(countdown.map((option) => option.value)).toEqual(["10000", "30000", "60000"]);
  });
});
