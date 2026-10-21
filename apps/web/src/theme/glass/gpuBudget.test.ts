import { describe, expect, it } from "vitest";

import {
  gpuBusyPercent,
  judgeScenario,
  parseAgxGpuTime,
  parseIoregUtilization,
  parsePowermetrics,
  summarize,
} from "./gpuBudget";

const POWERMETRICS = `
*** Sampled system activity (Tue Oct 21 22:10:01 2026 +0200) (1004.12ms elapsed) ***

**** GPU usage ****

GPU HW active frequency: 338 MHz
GPU HW active residency:  18.42% (338 MHz: 18% 618 MHz:   0%)
GPU SW requested state: (P1 : 100%)
GPU idle residency:  81.58%
GPU Power: 41 mW

*** Sampled system activity (Tue Oct 21 22:10:02 2026 +0200) (1001.80ms elapsed) ***

**** GPU usage ****

GPU HW active frequency: 338 MHz
GPU HW active residency:  21.10% (338 MHz: 21% 618 MHz:   0%)
GPU idle residency:  78.90%
GPU Power: 52 mW
`;

describe("budget GPU — lecture des mesures", () => {
  it("lit l'occupation et la puissance de powermetrics, bloc par bloc", () => {
    expect(parsePowermetrics(POWERMETRICS)).toEqual([
      { busy: 18.42, powerMw: 41 },
      { busy: 21.1, powerMw: 52 },
    ]);
    expect(parsePowermetrics("rien")).toEqual([]);
  });

  it("lit l'occupation d'ioreg, le plus occupé des accélérateurs", () => {
    const text = `"PerformanceStatistics" = {"Device Utilization %"=12,"Renderer Utilization %"=10}
    "PerformanceStatistics" = {"Device Utilization %"=31}`;
    expect(parseIoregUtilization(text)).toBe(31);
    expect(parseIoregUtilization("")).toBeNull();
  });

  it("résume par médiane et 90e centile", () => {
    expect(summarize([1, 2, 3, 4, 100])).toEqual({ n: 5, median: 3, p90: 61.6, mean: 22, max: 100 });
  });

  it("juge en écart à la référence de la même passe", () => {
    const ref = summarize([10, 10, 11]);
    expect(judgeScenario("idle", summarize([10, 10, 11]), ref)).toMatchObject({ delta: 0, ok: true });
    expect(judgeScenario("pointerSweep", summarize([20, 21, 22]), ref)).toMatchObject({ delta: 11, ok: false });
  });

  it("juge un geste répété par son temps GPU unitaire", () => {
    const ref = summarize([0, 0, 0]);
    // 10 points pendant une période de 400 ms : 40 ms de GPU par appui.
    expect(judgeScenario("pressPulse", summarize([10, 10, 10]), ref)).toMatchObject({
      gestureMs: 40,
      unit: "ms/geste",
      ok: true,
    });
    expect(judgeScenario("fusion", summarize([10, 10, 10]), ref)).toMatchObject({ gestureMs: 70, ok: false });
  });

  it("lit le temps GPU cumulé de chaque processus (clients AGX)", () => {
    const text = `      "IOUserClientCreator" = "pid 395, WindowServer"
      "AppUsage" = ({"API"="Metal","lastSubmittedTime"=1,"accumulatedGPUTime"=1000},{"API"="Metal","accumulatedGPUTime"=500})
      "IOUserClientCreator" = "pid 402, runningboardd"
      "IOUserClientCreator" = "pid 395, WindowServer"
      "AppUsage" = ({"API"="Metal","accumulatedGPUTime"=250})
      "IOUserClientCreator" = "pid 900, Electron Helper (GPU)"
      "AppUsage" = ({"API"="Metal","accumulatedGPUTime"=42})`;
    expect([...parseAgxGpuTime(text)]).toEqual([
      [395, 1750],
      [900, 42],
    ]);
  });

  it("convertit un écart de temps GPU en occupation", () => {
    const before = new Map([[900, 0], [1, 5]]);
    const after = new Map([[900, 250_000_000], [1, 5]]);
    // 250 ms de GPU sur une seconde : 25 %.
    expect(gpuBusyPercent(before, after, [900, 1], 1000)).toBe(25);
    expect(gpuBusyPercent(before, after, [777], 1000)).toBe(0);
  });
});
