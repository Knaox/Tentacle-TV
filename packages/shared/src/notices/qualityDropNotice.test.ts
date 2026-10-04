import { describe, expect, it } from "vitest";
import { NOTICE_AUTO_HIDE_MS } from "./noticePolicy";
import { QUALITY_DROP_NOTICE_MS, qualityDropNoticeDue, type QualityDropNoticeInput } from "./qualityDropNotice";
import { DISMISSIBLE_HINTS } from "../help/dismissibleHints";

const network = { cause: "network", measuredBps: 6e6, neededBps: 14e6 } as const;

function input(over: Partial<QualityDropNoticeInput>): QualityDropNoticeInput {
  return { drop: network, started: true, dismissed: false, shown: new Set(), ...over };
}

describe("qualityDropNoticeDue", () => {
  it("dit une baisse à la première image", () => {
    expect(qualityDropNoticeDue(input({}))).toBe("network");
    expect(qualityDropNoticeDue(input({ started: false }))).toBeNull();
  });

  it("attend les rappels du compte, et se tait si le compte l'a masqué", () => {
    expect(qualityDropNoticeDue(input({ dismissed: undefined }))).toBeNull();
    expect(qualityDropNoticeDue(input({ dismissed: true }))).toBeNull();
  });

  it("ne répète pas la même baisse, mais dit une cause nouvelle", () => {
    const shown = new Set(["network"]);
    expect(qualityDropNoticeDue(input({ shown }))).toBeNull();
    expect(qualityDropNoticeDue(input({ shown, drop: { cause: "server", conversion: "hdr" } }))).toBe("server:hdr");
  });

  it("suit la politique : une info de six secondes, un rappel de la liste fermée", () => {
    expect(QUALITY_DROP_NOTICE_MS).toBe(NOTICE_AUTO_HIDE_MS);
    expect(DISMISSIBLE_HINTS).toContain("autoQuality");
  });
});
