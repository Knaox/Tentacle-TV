import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { WideSettingsContext } from "@tentacle-tv/shared";

/** Une ligne du web large, montée sans navigateur : `t()` rend la clé. */

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const { SettingItem } = await import("./SettingItem");
const { SettingTargetCtx, WideSettingsCtx } = await import("./wideSettingsMeta");

const browser = {
  platform: "web", capabilities: new Set(), offline: false, isAdmin: false, offlineVisible: false, canGoOffline: false,
  family: false, canSwitchProfile: false, liquidGlass: false, advancedEngine: false, engineOptions: false,
  liveTransfers: false, bootIntro: false, abilities: new Set(), profileSession: false,
  desktopApp: false, glassToggle: false, octave: false, downloads: false, hardwareDecoding: false, hdrAuto: false,
  linuxSession: false,
} as WideSettingsContext;

describe("SettingItem", () => {
  it("dit le libellé, la portée et ce que fait le réglage, et porte son ancre", () => {
    const html = renderToStaticMarkup(<SettingItem setting="theme" trailing={<span>contrôle</span>} />);
    expect(html).toContain("settingsWeb:entries.theme.label");
    expect(html).toContain("settingsWeb:entries.theme.description");
    expect(html).toContain("scope.device");
    expect(html).toContain('id="setting-theme"');
    expect(html).toContain("contrôle");
  });

  it("un réglage du compte porte la pastille « Compte »", () => {
    expect(renderToStaticMarkup(<SettingItem setting="libraryTracks" />)).toContain("scope.account");
  });

  it("une ligne dont les conditions ne tiennent pas ici ne se dessine pas", () => {
    const html = renderToStaticMarkup(
      <WideSettingsCtx.Provider value={browser}><SettingItem setting="hardwareDecoding" /></WideSettingsCtx.Provider>,
    );
    expect(html).toBe("");
  });

  it("visée par l'adresse (#theme), elle se souligne", () => {
    const html = renderToStaticMarkup(
      <SettingTargetCtx.Provider value="theme"><SettingItem setting="theme" /></SettingTargetCtx.Provider>,
    );
    expect(html).toContain('data-setting="theme"');
  });
});
