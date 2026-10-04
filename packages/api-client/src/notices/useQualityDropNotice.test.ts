import { describe, expect, it } from "vitest";
import { qualityDropDismissal } from "./useQualityDropNotice";

describe("qualityDropDismissal", () => {
  it("lit le rappel du compte", () => {
    expect(qualityDropDismissal({ dismissed: ["autoQuality"], marks: {}, known: ["autoQuality"] }, false)).toBe(true);
    expect(qualityDropDismissal({ dismissed: ["trailerHelp"], marks: {}, known: ["autoQuality"] }, false)).toBe(false);
  });

  it("attend la réponse, mais un serveur muet vaut « rien de masqué »", () => {
    expect(qualityDropDismissal(undefined, false)).toBeUndefined();
    expect(qualityDropDismissal(undefined, true)).toBe(false);
  });
});
