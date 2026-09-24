/**
 * Les défauts des préférences push : tickets et demandes activés, tous les
 * ajouts en opt-in ; une ligne absente vaut ces défauts, une valeur posée
 * l'emporte.
 */

import { describe, expect, it } from "vitest";
import { PUSH_PREF_DEFAULTS, isPushPrefEnabled, toPushPrefs } from "./pushPreferences";

describe("préférences push", () => {
  it("sans ligne : tickets et demandes oui, tous les ajouts non", () => {
    expect(toPushPrefs(null)).toEqual({ libraryAdded: false, seerAvailable: true, tickets: true });
    expect(PUSH_PREF_DEFAULTS.seerAvailable).toBe(true);
  });

  it("une valeur posée l'emporte sur le défaut", () => {
    expect(isPushPrefEnabled({ seerAvailable: false }, "seerAvailable")).toBe(false);
    expect(isPushPrefEnabled({ libraryAdded: true }, "libraryAdded")).toBe(true);
    expect(isPushPrefEnabled({ libraryAdded: true }, "seerAvailable")).toBe(true);
  });
});
