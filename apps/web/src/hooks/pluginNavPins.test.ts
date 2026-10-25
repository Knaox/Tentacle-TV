import { describe, expect, it } from "vitest";
import { isPluginNavPinnedBy, readKeyList, withPluginNavPinned, type PluginNavPins } from "./pluginNavPins";

const NONE: PluginNavPins = { pluginsUnpinned: [], pluginsPinned: [] };
const KEY = "ext:/x/page";

describe("page d'extension dans la barre", () => {
  it("sans avis de l'extension (serveur d'avant) : dans la barre, comme avant", () => {
    expect(isPluginNavPinnedBy(NONE, KEY)).toBe(true);
    expect(isPluginNavPinnedBy({ ...NONE, pluginsUnpinned: [KEY] }, KEY)).toBe(false);
  });

  it("le défaut de l'extension décide tant que l'appareil n'a rien choisi", () => {
    expect(isPluginNavPinnedBy(NONE, KEY, true)).toBe(true);
    expect(isPluginNavPinnedBy(NONE, KEY, false)).toBe(false);
  });

  it("le geste de l'appareil l'emporte sur le défaut", () => {
    const pinned = withPluginNavPinned(NONE, KEY, true, false);
    expect(pinned).toEqual({ pluginsPinned: [KEY], pluginsUnpinned: [] });
    expect(isPluginNavPinnedBy(pinned, KEY, false)).toBe(true);
    const unpinned = withPluginNavPinned(NONE, KEY, false, true);
    expect(isPluginNavPinnedBy(unpinned, KEY, true)).toBe(false);
  });

  it("revenir au défaut efface le geste : l'appareil suit ensuite l'administrateur", () => {
    const back = withPluginNavPinned(withPluginNavPinned(NONE, KEY, true, false), KEY, false, false);
    expect(back).toEqual(NONE);
    expect(isPluginNavPinnedBy(back, KEY, true)).toBe(true);
  });

  it("un retrait d'avant (pluginsUnpinned) reste un retrait face au nouveau défaut", () => {
    expect(isPluginNavPinnedBy({ ...NONE, pluginsUnpinned: [KEY] }, KEY, true)).toBe(false);
  });

  it("sans avis : retirer puis remettre redonne la liste d'avant", () => {
    const removed = withPluginNavPinned(NONE, KEY, false);
    expect(removed).toEqual({ pluginsPinned: [], pluginsUnpinned: [KEY] });
    expect(withPluginNavPinned(removed, KEY, true)).toEqual(NONE);
  });

  it("lecture tolérante du stockage", () => {
    expect(readKeyList(["a", 3, null, "b"])).toEqual(["a", "b"]);
    expect(readKeyList(undefined)).toEqual([]);
  });
});
