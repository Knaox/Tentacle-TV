import { describe, expect, it } from "vitest";
import { isPluginActive, isVigieActive, SEER_PLUGIN_ID } from "./pluginPresence";

describe("présence d'un plugin", () => {
  it("est vraie pour un plugin listé et activé", () => {
    expect(isPluginActive([{ pluginId: "seer", configEnabled: true }], SEER_PLUGIN_ID)).toBe(true);
    expect(isVigieActive([{ pluginId: "other", configEnabled: true }, { pluginId: "seer", configEnabled: true }])).toBe(true);
  });

  it("est fausse pour un plugin listé mais désactivé, ou sans drapeau", () => {
    expect(isVigieActive([{ pluginId: "seer", configEnabled: false }])).toBe(false);
    expect(isVigieActive([{ pluginId: "seer" }])).toBe(false);
  });

  it("est fausse sans le plugin, ou sans liste (chargement, hors ligne)", () => {
    expect(isVigieActive([{ pluginId: "other", configEnabled: true }])).toBe(false);
    expect(isVigieActive([])).toBe(false);
    expect(isVigieActive(undefined)).toBe(false);
    expect(isVigieActive(null)).toBe(false);
  });
});
