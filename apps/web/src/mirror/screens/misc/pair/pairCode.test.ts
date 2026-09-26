import { describe, expect, it } from "vitest";
import { pairErrorKey, parsePastedCode, sanitizeCodeChar } from "./pairCode";

describe("sanitizeCodeChar", () => {
  it("garde la dernière frappe, en capitale", () => {
    expect(sanitizeCodeChar("ab")).toBe("B");
    expect(sanitizeCodeChar("-")).toBe("");
  });
});

describe("parsePastedCode", () => {
  it("découpe un code collé de quatre caractères", () => {
    expect(parsePastedCode(" a1-b2 ")).toEqual(["A", "1", "B", "2"]);
  });
  it("refuse un code trop court", () => {
    expect(parsePastedCode("ab")).toBeNull();
  });
});

describe("pairErrorKey", () => {
  it("classe les codes inconnus, expirés ou pris", () => {
    expect(pairErrorKey("HTTP 404")).toBe("codeInvalid");
    expect(pairErrorKey("Code déjà utilisé (409)")).toBe("codeInvalid");
  });
  it("renvoie le reste au relais", () => {
    expect(pairErrorKey("NetworkError")).toBe("relayError");
  });
});
