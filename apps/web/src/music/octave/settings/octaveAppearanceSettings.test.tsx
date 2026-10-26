import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * Réglages › Apparence (Damien, 26/10) : au WEB, aucune ligne Liquid Glass (ni de Tentacle, ni d'Octave) ; sur un
 * macOS compatible, les deux, nommées « dans Tentacle » et « dans Octave » ; le thème d'Octave partout où Octave
 * existe ; sans Octave (pas de musique, pas le droit), aucun groupe Octave.
 */

const h = vi.hoisted(() => ({ native: false, octave: true }));

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("react-router-dom", () => ({
  useLocation: () => ({ hash: "" }),
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => <a href={to}>{children}</a>,
}));
vi.mock("../mode/OctaveStartupSetting", () => ({ OctaveStartupSetting: ({ title }: { title?: string }) => <section data-startup={title} /> }));
// Les groupes partagés (langue, profils) ont leurs propres tests (`octaveSettingsScopes.test.tsx`).
vi.mock("./LanguageSetting", () => ({ LanguageSetting: () => null }));
vi.mock("../profiles", () => ({ OctaveProfilesSettings: () => null }));
vi.mock("@tentacle-tv/ui", () => ({
  SettingsSection: ({ title, children }: { title?: string; children: React.ReactNode }) => <section data-title={title}>{children}</section>,
  SettingsRow: ({ label, trailing }: { label: string; trailing?: React.ReactNode }) => <div data-row={label}>{trailing}</div>,
}));
vi.mock("../../../components/settings/SegmentedChoice", () => ({
  SegmentedChoice: ({ options }: { options: { label: string }[] }) => <div>{options.map((o) => <span key={o.label}>{o.label}</span>)}</div>,
}));
vi.mock("../../../components/settings/ToggleSwitch", () => ({ ToggleSwitch: ({ label }: { label: string }) => <button aria-label={label} /> }));
vi.mock("../../../components/settings/TrailerPreviewSetting", () => ({ TrailerPreviewSetting: () => null }));
vi.mock("../../../theme/useThemeMode", () => ({ useThemeMode: () => ({ mode: "dark", setMode: () => undefined }) }));
vi.mock("../../../theme/useLiquidGlass", () => ({
  useLiquidGlass: () => ({ enabled: true, supported: true, nativeSupported: h.native, toggleVisible: h.native, setEnabled: () => undefined }),
}));
vi.mock("../mode/useOctaveAvailability", () => ({ useOctaveAvailability: () => ({ available: h.octave, settled: true }) }));

const { SettingsAppearance } = await import("../../../pages/settings/SettingsAppearance");
const { OctaveSettingsView } = await import("./OctaveSettingsView");
const { octavePaths } = await import("../octavePaths");
const { isOctavePath } = await import("../cache/pageResume");

beforeEach(() => {
  h.native = false;
  h.octave = true;
});

describe("Réglages › Apparence", () => {
  it("web : le thème d'Octave, AUCUNE ligne Liquid Glass", () => {
    const html = renderToStaticMarkup(<SettingsAppearance />);
    expect(html).toContain("appearance.themeSame");
    expect(html).not.toMatch(/liquidGlassTitle|appearance\.glass|appearance\.tentacleGlass/);
  });

  it("le groupe Octave renvoie aux réglages DANS Octave", () => {
    expect(renderToStaticMarkup(<SettingsAppearance />)).toContain(`href="${octavePaths.settings}"`);
  });

  it("macOS compatible : « Liquid Glass dans Tentacle » et « Liquid Glass dans Octave »", () => {
    h.native = true;
    const html = renderToStaticMarkup(<SettingsAppearance />);
    expect(html).toContain('data-row="appearance.tentacleGlass"');
    expect(html).toContain('data-row="appearance.glass"');
    expect(html).not.toContain("liquidGlassTitle");
  });

  it("sans Octave : pas de groupe Octave, l'interrupteur de Tentacle garde son nom", () => {
    h.native = true;
    h.octave = false;
    const html = renderToStaticMarkup(<SettingsAppearance />);
    expect(html).not.toContain("appearance.theme");
    expect(html).toContain('data-row="liquidGlassTitle"');
  });
});

describe("Réglages d'Octave, DANS Octave (/octave/settings)", () => {
  it("une adresse d'Octave : la coquille la sert, la surface reste Octave, la réouverture y revient", () => {
    expect(octavePaths.settings).toBe("/octave/settings");
    expect(isOctavePath(octavePaths.settings, "/octave")).toBe(true);
  });

  it("les MÊMES réglages : apparence (thème) et « Au démarrage, ouvrir » ; au web, aucune ligne Liquid Glass", () => {
    const html = renderToStaticMarkup(<OctaveSettingsView />);
    expect(html).toContain("settings.title");
    expect(html).toContain("appearance.themeSame");
    expect(html).toContain('data-startup="settings.startup"');
    expect(html).not.toMatch(/appearance\.glass|Liquid/);
  });

  it("macOS compatible : « Liquid Glass dans Octave » y est aussi", () => {
    h.native = true;
    expect(renderToStaticMarkup(<OctaveSettingsView />)).toContain('data-row="appearance.glass"');
  });
});
