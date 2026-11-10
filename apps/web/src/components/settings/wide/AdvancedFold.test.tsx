import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { WIDE_SETTINGS_SECTIONS, type WideSettingsContext } from "@tentacle-tv/shared";

/** Le repli « Avancé », monté sans navigateur : `t()` rend la clé (et sa liste). */

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string, options?: { list?: string }) => (options?.list ? `${key}(${options.list})` : key) }),
}));

const { AdvancedSettings } = await import("./AdvancedFold");
const { SettingItem } = await import("./SettingItem");
const { SettingTargetCtx, WideSettingsCtx } = await import("./wideSettingsMeta");

const browser = {
  platform: "web", capabilities: new Set(), offline: false, isAdmin: false, offlineVisible: false, canGoOffline: false,
  family: false, canSwitchProfile: false, liquidGlass: false, advancedEngine: false, engineOptions: false,
  liveTransfers: false, bootIntro: false, abilities: new Set(), profileSession: false,
  desktopApp: false, glassToggle: false, octave: false, downloads: false, hardwareDecoding: false, hdrAuto: false,
  linuxSession: false,
} as WideSettingsContext;

const fold = (
  <AdvancedSettings settings={["skipPassages"]}>
    <SettingItem setting="skipPassages" />
  </AdvancedSettings>
);

describe("le repli « Avancé »", () => {
  it("fermé : il NOMME ce qu'il contient, et ne monte pas ses lignes", () => {
    const html = renderToStaticMarkup(fold);
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain("advanced.summary(settingsWeb:entries.skipPassages.label)");
    expect(html).not.toContain('id="setting-skipPassages"');
  });

  it("l'adresse qui vise une de ses lignes (#skipPassages) l'ouvre", () => {
    const html = renderToStaticMarkup(<SettingTargetCtx.Provider value="skipPassages">{fold}</SettingTargetCtx.Provider>);
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('id="setting-skipPassages"');
  });

  it("ouvert d'emblée quand on y a déjà réglé quelque chose", () => {
    const html = renderToStaticMarkup(
      <AdvancedSettings settings={["skipPassages"]} defaultOpen><SettingItem setting="skipPassages" /></AdvancedSettings>,
    );
    expect(html).toContain('id="setting-skipPassages"');
  });

  it("rien si aucun de ses réglages n'existe ici (la vidéo de l'ordinateur, dans un navigateur)", () => {
    const html = renderToStaticMarkup(
      <WideSettingsCtx.Provider value={browser}>
        <AdvancedSettings settings={["hardwareDecoding", "linuxSession"]}><SettingItem setting="hardwareDecoding" /></AdvancedSettings>
      </WideSettingsCtx.Provider>,
    );
    expect(html).toBe("");
  });
});

describe("les réglages rares du catalogue", () => {
  it("restent des lignes du catalogue comme les autres : libellé, phrase, mots-clés — la recherche les trouve", () => {
    const advanced = WIDE_SETTINGS_SECTIONS.flatMap((s) => s.groups.flatMap((g) => g.entries)).filter((e) => e.advanced);
    expect(advanced.map((e) => e.id).sort()).toEqual(["hardwareDecoding", "linuxSession", "skipPassages"]);
    for (const entry of advanced) expect(entry.keywords, entry.id).toBeDefined();
  });
});
