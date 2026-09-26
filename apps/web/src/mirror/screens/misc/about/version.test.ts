import { describe, expect, it } from "vitest";
import { displayVersion } from "./version";

describe("displayVersion", () => {
  it("retire le suffixe de pré-version", () => {
    expect(displayVersion("1.4.0-beta.2")).toBe("1.4.0");
    expect(displayVersion("2.0.0-rc")).toBe("2.0.0");
  });
  it("laisse une version stable intacte", () => {
    expect(displayVersion("1.21.4")).toBe("1.21.4");
  });
});
