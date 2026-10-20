import { describe, expect, it } from "vitest";
import { currentStep, reduceFirstRun, startFirstRun } from "./firstRunFlow";

describe("le premier lancement, pas à pas", () => {
  it("chaque étape à son tour, jamais deux surfaces : carte → passage → feuille → passage → carte suivante", () => {
    let flow = startFirstRun(["pinSetup", "homeRows", "photoSetup"]);
    expect([currentStep(flow), flow.surface]).toEqual(["pinSetup", "card"]);
    flow = reduceFirstRun(flow, "openSheet");
    expect(flow.surface).toBe("toSheet");
    // Rien ne bouge tant que la carte n'est pas retirée.
    expect(reduceFirstRun(flow, "next")).toBe(flow);
    flow = reduceFirstRun(flow, "presented");
    expect(flow.surface).toBe("sheet");
    flow = reduceFirstRun(flow, "sheetClosed");
    expect([currentStep(flow), flow.surface]).toEqual(["homeRows", "toCard"]);
    flow = reduceFirstRun(flow, "presented");
    expect([currentStep(flow), flow.surface]).toEqual(["homeRows", "card"]);
    flow = reduceFirstRun(flow, "next");
    expect(currentStep(flow)).toBe("photoSetup");
    flow = reduceFirstRun(reduceFirstRun(reduceFirstRun(flow, "openSheet"), "presented"), "sheetClosed");
    expect(flow.surface).toBe("done");
    expect(currentStep(flow)).toBeNull();
  });

  it("« Passer » va à l'étape suivante, puis termine", () => {
    let flow = startFirstRun(["homeRows"]);
    flow = reduceFirstRun(flow, "next");
    expect(flow.surface).toBe("done");
    expect(startFirstRun([]).surface).toBe("done");
  });

  it("un geste en double ne saute jamais une étape", () => {
    let flow = startFirstRun(["pinSetup", "homeRows"]);
    flow = reduceFirstRun(flow, "openSheet");
    flow = reduceFirstRun(flow, "openSheet");
    flow = reduceFirstRun(flow, "presented");
    flow = reduceFirstRun(flow, "sheetClosed");
    flow = reduceFirstRun(flow, "sheetClosed");
    expect(currentStep(flow)).toBe("homeRows");
  });
});
