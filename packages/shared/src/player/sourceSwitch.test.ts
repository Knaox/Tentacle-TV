import { describe, expect, it } from "vitest";
import { SOURCE_SWITCH_TIMEOUT_MS, beginSourceSwitch, sourceSwitchPending } from "./sourceSwitch";

describe("sourceSwitchPending — l'indicateur s'allume au geste", () => {
  const sw = beginSourceSwitch("ancienne", 1_000);

  it("allumé dès le geste, tant que la source posée est l'ancienne (ou aucune)", () => {
    expect(sourceSwitchPending(sw, "ancienne", 1_001)).toBe(true);
    expect(sourceSwitchPending(sw, null, 1_500)).toBe(true);
  });

  it("la nouvelle source posée : le lecteur prend le relais", () => {
    expect(sourceSwitchPending(sw, "nouvelle", 2_000)).toBe(false);
  });

  it("jamais éternel", () => {
    expect(sourceSwitchPending(sw, "ancienne", 1_000 + SOURCE_SWITCH_TIMEOUT_MS + 1)).toBe(false);
  });

  it("sans geste, rien", () => {
    expect(sourceSwitchPending(null, "ancienne", 0)).toBe(false);
  });
});
