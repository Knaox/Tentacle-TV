import { afterEach, describe, expect, it, vi } from "vitest";
import { detectLanguage, uiLanguage } from "./index";

describe("detectLanguage", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("suit le navigateur, en français comme en anglais", () => {
    vi.stubGlobal("navigator", { language: "fr-FR" });
    expect(detectLanguage()).toBe("fr");
    vi.stubGlobal("navigator", { language: "en-US" });
    expect(detectLanguage()).toBe("en");
  });

  it("se replie sur la locale d'Intl sans navigator.language (React Native)", () => {
    vi.stubGlobal("navigator", { product: "ReactNative" });
    const spy = vi.spyOn(Intl, "DateTimeFormat").mockReturnValue({
      resolvedOptions: () => ({ locale: "fr-CA" }),
    } as Intl.DateTimeFormat);
    expect(detectLanguage()).toBe("fr");
    spy.mockReturnValue({ resolvedOptions: () => ({ locale: "de-DE" }) } as Intl.DateTimeFormat);
    expect(detectLanguage()).toBe("en");
    spy.mockRestore();
  });
});

describe("uiLanguage", () => {
  it("réduit toute langue aux deux de l'interface", () => {
    expect(uiLanguage("fr-FR")).toBe("fr");
    expect(uiLanguage("en")).toBe("en");
    expect(uiLanguage(undefined)).toBe("en");
  });
});
