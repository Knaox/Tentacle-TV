import { describe, expect, it } from "vitest";
import { followDocumentLanguage } from "./documentLanguage";

describe("followDocumentLanguage", () => {
  it("pose la langue courante, puis suit chaque changement", () => {
    const listeners: Array<(lang: string) => void> = [];
    const i18n = { language: "fr", on: (_event: "languageChanged", cb: (lang: string) => void) => listeners.push(cb) };
    const root = { lang: "en" };
    followDocumentLanguage(i18n, root);
    expect(root.lang).toBe("fr");
    listeners.forEach((cb) => cb("en"));
    expect(root.lang).toBe("en");
  });

  it("garde la valeur de la page tant qu'i18next n'a pas de langue", () => {
    const root = { lang: "en" };
    followDocumentLanguage({ on: () => undefined }, root);
    expect(root.lang).toBe("en");
  });
});
