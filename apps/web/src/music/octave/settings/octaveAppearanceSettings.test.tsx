import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * Réglages › Apparence (Damien, 26/10) : au WEB, aucune ligne Liquid Glass (ni de Tentacle, ni d'Octave) ; sur un
 * macOS compatible, les deux, nommées « dans Tentacle » et « dans Octave » ; le thème d'Octave partout où Octave
 * existe ; sans Octave (pas de musique, pas le droit), aucun groupe Octave.
 */

const h = vi.hoisted(() => ({ native: false, octave: true }));

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("react-router-dom", () => ({ useLocation: () => ({ hash: "" }) }));
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
