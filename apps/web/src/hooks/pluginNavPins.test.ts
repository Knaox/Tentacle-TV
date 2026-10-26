import { describe, expect, it } from "vitest";
import { isPluginNavPinnedBy, pluginNavPinnable, readKeyList, withPluginNavPinned, type PluginNavPins } from "./pluginNavPins";

const NONE: PluginNavPins = { pluginsUnpinned: [], pluginsPinned: [] };
const KEY = "ext:/x/page";

describe("page d'extension dans la barre", () => {
  it("sans avis de l'extension (serveur d'avant) : dans la barre, comme avant", () => {
    expect(isPluginNavPinnedBy(NONE, KEY)).toBe(true);
    expect(isPluginNavPinnedBy({ ...NONE, pluginsUnpinned: [KEY] }, KEY)).toBe(false);
    expect(pluginNavPinnable(undefined)).toBe(true);
  });

  // Damien, 26/10 : « si je désactive "Afficher dans la barre de navigation principale", je ne dois PAS pouvoir l'épingler ».
  it("cachée par l'extension (`primary: false`) : jamais dans la barre, jamais épinglable", () => {
    expect(pluginNavPinnable(false)).toBe(false);
    expect(isPluginNavPinnedBy(NONE, KEY, false)).toBe(false);
    expect(withPluginNavPinned(NONE, KEY, true, false)).toEqual(NONE);
  });

  it("épinglée puis cachée : disparaît de la barre, l'épingle de l'appareil reste ; réaffichée : elle revient", () => {
    const pins = { pluginsPinned: [KEY], pluginsUnpinned: [] };
    expect(isPluginNavPinnedBy(pins, KEY, false)).toBe(false);
    expect(withPluginNavPinned(pins, KEY, false, false)).toBe(pins);
    expect(isPluginNavPinnedBy(pins, KEY, true)).toBe(true);
  });

  it("affichée par l'extension : dans la barre, sauf si l'appareil l'en a retirée", () => {
    expect(isPluginNavPinnedBy(NONE, KEY, true)).toBe(true);
    const unpinned = withPluginNavPinned(NONE, KEY, false, true);
    expect(unpinned).toEqual({ pluginsPinned: [], pluginsUnpinned: [KEY] });
    expect(isPluginNavPinnedBy(unpinned, KEY, true)).toBe(false);
    expect(withPluginNavPinned(unpinned, KEY, true, true)).toEqual(NONE);
  });

  it("un retrait d'avant (pluginsUnpinned) reste un retrait", () => {
    expect(isPluginNavPinnedBy({ ...NONE, pluginsUnpinned: [KEY] }, KEY, true)).toBe(false);
  });

  it("lecture tolérante du stockage", () => {
    expect(readKeyList(["a", 3, null, "b"])).toEqual(["a", "b"]);
    expect(readKeyList(undefined)).toEqual([]);
  });
});
