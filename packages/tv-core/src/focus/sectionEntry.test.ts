import { describe, expect, it } from "vitest";
import { FIRST_VISIT_ARMED, FIRST_VISIT_DONE, firstVisitAfterFocus, firstVisitEntry } from "./sectionEntry";

const episodes = (key: string) => key.startsWith("episode:");

describe("sectionEntry — l'entrée « première visite » d'une section", () => {
  it("armée, elle déclare l'ancre", () => {
    expect(firstVisitEntry(FIRST_VISIT_ARMED, "episode:4")).toBe("episode:4");
    expect(firstVisitEntry(FIRST_VISIT_ARMED, null)).toBeNull();
  });

  it("le premier focus d'une clé de la section la désarme : plus d'entrée (le plus proche)", () => {
    const after = firstVisitAfterFocus(FIRST_VISIT_ARMED, "episode:2", episodes);
    expect(after).toBe(FIRST_VISIT_DONE);
    expect(firstVisitEntry(after, "episode:4")).toBeNull();
  });

  it("un focus ailleurs ne la désarme pas", () => {
    expect(firstVisitAfterFocus(FIRST_VISIT_ARMED, "season:1", episodes)).toBe(FIRST_VISIT_ARMED);
  });

  it("désarmée, elle le reste jusqu'au réarmement", () => {
    const off = firstVisitAfterFocus(FIRST_VISIT_ARMED, "episode:0", episodes);
    expect(firstVisitAfterFocus(off, "episode:3", episodes)).toBe(off);
  });
});
