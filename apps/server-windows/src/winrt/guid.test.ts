import { describe, expect, it } from "vitest";
import { IITERABLE_STORE_PACKAGE_UPDATE_SIGNATURE, guidBuffer, parameterizedIid } from "./guid";

describe("guidBuffer", () => {
  it("écrit les trois premiers champs en petit-boutiste et le reste brut", () => {
    expect(guidBuffer("{00000036-0000-0000-C000-000000000046}").toString("hex")).toBe("3600000000000000c000000000000046");
    expect(guidBuffer("ee5b60bd-a148-41a7-b26e-e8b88a1e62f8").toString("hex")).toBe("bd605bee48a1a741b26ee8b88a1e62f8");
  });

  it("refuse un GUID tronqué", () => {
    expect(() => guidBuffer("ee5b60bd-a148")).toThrow();
  });
});

describe("parameterizedIid", () => {
  // Valeurs de référence : celles que tient déjà le test du bureau.
  it("rend IIterable<String>, l'exemple connu", () => {
    expect(parameterizedIid("pinterface({faa585ea-6214-4217-afda-7f46de5869b3};string)").toString("hex")).toBe(
      guidBuffer("E2FCC7C1-3BFC-5A0B-B2B0-72E769D1CB7E").toString("hex"),
    );
  });

  it("rend IIterable<StorePackageUpdate>, l'interface attendue par le Store", () => {
    expect(parameterizedIid(IITERABLE_STORE_PACKAGE_UPDATE_SIGNATURE).toString("hex")).toBe(
      guidBuffer("6B076C51-849E-5EC5-AED5-9B0585591902").toString("hex"),
    );
  });
});
