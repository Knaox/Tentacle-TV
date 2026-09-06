/**
 * Hermes (l'app mobile) n'a pas `Intl.DisplayNames` : ces tests le simulent.
 * Les membres d'`Intl` ne sont pas énumérables — `{ ...Intl }` ne copierait
 * rien —, d'où `getOwnPropertyNames`.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { formatLocalTrackLabel } from "./localTrackLabels";

const fr = { locale: "fr", fallback: "Piste 3" };
const en = { locale: "en", fallback: "Track 3" };

const intlWithoutDisplayNames = Object.fromEntries(
  Object.getOwnPropertyNames(Intl)
    .filter((key) => key !== "DisplayNames")
    .map((key) => [key, (Intl as unknown as Record<string, unknown>)[key]]),
);

describe("formatLocalTrackLabel sans Intl.DisplayNames (Hermes)", () => {
  beforeAll(() => vi.stubGlobal("Intl", intlWithoutDisplayNames));
  afterAll(() => vi.unstubAllGlobals());

  it("le moteur n'a pas DisplayNames", () => {
    expect((globalThis.Intl as { DisplayNames?: unknown }).DisplayNames).toBeUndefined();
  });

  it("nomme les langues courantes dans les deux langues d'interface", () => {
    expect(formatLocalTrackLabel({ lang: "fre" }, fr)).toBe("Français");
    expect(formatLocalTrackLabel({ lang: "fr-BE" }, fr)).toBe("Français (Belgique)");
    expect(formatLocalTrackLabel({ lang: "jpn" }, en)).toBe("Japanese");
    expect(formatLocalTrackLabel({ lang: "ger", codec: "aac" }, fr)).toBe("Allemand - AAC");
  });

  it("garde les drapeaux et le repli sur le code brut", () => {
    expect(formatLocalTrackLabel({ lang: "fr", forced: true }, fr)).toBe("Français — Forced");
    expect(formatLocalTrackLabel({ lang: "zzz" }, fr)).toBe("ZZZ");
    expect(formatLocalTrackLabel({}, fr)).toBe("Piste 3");
  });
});
