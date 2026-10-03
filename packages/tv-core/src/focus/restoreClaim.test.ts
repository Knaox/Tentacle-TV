import { describe, expect, it } from "vitest";
import { RESTORE_WITHIN_MS, restoreStep, watchRestore } from "./restoreClaim";

describe("restoreClaim — réclamer encore après une restauration de la plateforme", () => {
  const watch = watchRestore("nav:Home", 10_000);

  it("la surveillance dure 900 ms", () => {
    expect(RESTORE_WITHIN_MS).toBe(900);
    expect(watch.until).toBe(10_900);
  });

  it("un focus ailleurs dans le délai : une nouvelle réclamation", () => {
    expect(restoreStep(watch, "nav:Search", true, 10_400)).toBe("reclaim");
    expect(restoreStep(watch, "nav:Search", true, 10_900)).toBe("reclaim");
  });

  it("passé le délai : on cesse, sans réclamer", () => {
    expect(restoreStep(watch, "nav:Search", true, 10_901)).toBe("stop");
  });

  it("le focus pris par la clé elle-même, ou une perte, ne changent rien", () => {
    expect(restoreStep(watch, "nav:Home", true, 10_100)).toBe("ignore");
    expect(restoreStep(watch, "nav:Search", false, 10_100)).toBe("ignore");
  });
});
