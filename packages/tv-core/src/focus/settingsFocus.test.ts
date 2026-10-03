import { describe, expect, it } from "vitest";
import {
  NAV_SETTINGS_AFTER_RESET,
  SETTINGS_DEFAULT_TAB,
  navSettingsLockedKeys,
  navSettingsRowKey,
  settingsChoiceEntryIndex,
  settingsChoiceKey,
  settingsEntryKey,
} from "./settingsFocus";

describe("onglets des réglages", () => {
  it("l'entrée et la colonne visent l'onglet AFFICHÉ ; Compte par défaut", () => {
    expect(settingsEntryKey("navigation")).toBe("settings:tab:navigation");
    expect(settingsEntryKey(SETTINGS_DEFAULT_TAB)).toBe("settings:tab:account");
  });
});

describe("liste de choix", () => {
  it("s'ouvre sur la valeur retenue, sinon sur la première", () => {
    expect(settingsChoiceEntryIndex(["fr", "en", "auto"], "auto")).toBe(2);
    expect(settingsChoiceEntryIndex(["fr", "en"], "de")).toBe(0);
    expect(settingsChoiceEntryIndex(["fr", "en"], undefined)).toBe(0);
    expect(settingsChoiceKey(2)).toBe("settings:choice:2");
  });
});

describe("Réglages › Navigation", () => {
  it("les lignes, et ce qui se verrouille pendant un déplacement", () => {
    expect(navSettingsRowKey(3)).toBe("settings:nav:3");
    expect(navSettingsLockedKeys(2)).toEqual([
      "settings:nav:0:visibility", "settings:nav:1:visibility", "settings:nav:showAll", "settings:nav:resetOrder",
    ]);
  });

  it("après « Tout afficher » ou « Ordre par défaut » : la première ligne", () => {
    expect(NAV_SETTINGS_AFTER_RESET).toBe("settings:nav:0");
  });
});
