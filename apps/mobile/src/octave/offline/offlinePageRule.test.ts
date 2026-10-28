import { describe, expect, it } from "vitest";
import { pageView } from "./offlinePageRule";

const base = { hasData: false, isPending: false, isError: false, offline: false, keptCollection: false };

describe("ce qu'une page montre, en ligne comme hors ligne", () => {
  it("une donnée gardée se montre, même si sa relecture a échoué (hors ligne après un redémarrage)", () => {
    expect(pageView({ ...base, hasData: true, isError: true, offline: true })).toBe("content");
    expect(pageView({ ...base, hasData: true, isError: true })).toBe("content");
  });
  it("hors ligne sans donnée : la collection gardée si elle existe, jamais une attente sans fin", () => {
    expect(pageView({ ...base, offline: true, isPending: true, keptCollection: true })).toBe("kept");
    expect(pageView({ ...base, offline: true, isPending: true })).toBe("offlineMissing");
    expect(pageView({ ...base, offline: true, isError: true })).toBe("offlineMissing");
  });
  it("en ligne : l'attente, puis l'erreur", () => {
    expect(pageView({ ...base, isPending: true })).toBe("loading");
    expect(pageView({ ...base, isPending: true, isError: true })).toBe("error");
    expect(pageView({ ...base })).toBe("error");
  });
});
