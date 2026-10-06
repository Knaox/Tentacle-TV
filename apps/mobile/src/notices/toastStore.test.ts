import { describe, expect, it } from "vitest";
import { toastAppearance } from "./toastStore";

describe("toastAppearance — le ton d'un message bref", () => {
  it("une réussite porte la coche verte, jamais le triangle rouge", () => {
    expect(toastAppearance("success")).toEqual({ severity: "success", icon: "check" });
  });

  it("un échec — et un appel sans ton — garde le triangle rouge", () => {
    expect(toastAppearance("failure")).toEqual({ severity: "blocking", icon: "alert-triangle" });
    expect(toastAppearance(undefined)).toEqual({ severity: "blocking", icon: "alert-triangle" });
  });

  it("un simple constat est en violet, sans alarme", () => {
    expect(toastAppearance("info")).toEqual({ severity: "info", icon: "info" });
  });
});
