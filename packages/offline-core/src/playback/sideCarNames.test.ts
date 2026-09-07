import { describe, expect, it } from "vitest";
import { parseSideCarFileName } from "./sideCarNames";

describe("parseSideCarFileName", () => {
  it("lit index, langue et drapeaux", () => {
    expect(parseSideCarFileName("3-fre-forced.srt")).toEqual({
      jfIndex: 3, lang: "fre", forced: true, sdh: false, format: "srt",
    });
    expect(parseSideCarFileName("12-eng-sdh.ass")).toEqual({
      jfIndex: 12, lang: "eng", forced: false, sdh: true, format: "ass",
    });
    expect(parseSideCarFileName("4-fr-be.vtt")?.lang).toBe("fr");
  });

  it("rejette ce qui n'est pas un side-car", () => {
    expect(parseSideCarFileName("original-ms1.mkv")).toBeNull();
    expect(parseSideCarFileName("notes.txt")).toBeNull();
  });
});
