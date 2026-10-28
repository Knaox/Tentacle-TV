import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";

/**
 * Réglages d'Octave : chaque groupe dit ce qu'il touche (Damien, 26/10) — « Octave seulement » pour ce que Tentacle
 * ne voit pas (l'apparence d'Octave : son thème clair ne change rien à Tentacle ; la transition douce ; la tenue à
 * jour des playlists gardées), puis, « aussi dans Tentacle », la langue et les profils (le compte) et « Au
 * démarrage, ouvrir » (cet appareil). Les réglages de la vidéo n'y sont pas.
 */

const h = vi.hoisted(() => ({ language: [] as string[] }));

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@tentacle-tv/ui", () => ({
  SettingsSection: ({ title, badge, children }: { title?: string; badge?: ReactNode; children: ReactNode }) => (
    <section data-title={title}>{badge}{children}</section>
  ),
  SettingsRow: ({ label }: { label: string }) => <div data-row={label} />,
}));
vi.mock("../../../components/settings/ScopeBadge", () => ({ ScopeBadge: ({ scope }: { scope: string }) => <b data-scope={scope} /> }));
vi.mock("../../../components/settings/SegmentedChoice", () => ({
  SegmentedChoice: ({ options, onChange }: { options: { value: string; label: string }[]; onChange: (v: string) => void }) => {
    onChange("en");
    return <div>{options.map((o) => <span key={o.value}>{o.label}</span>)}</div>;
  },
}));
vi.mock("../../../components/settings/ToggleSwitch", () => ({ ToggleSwitch: () => <button /> }));
vi.mock("../../../components/settings/useInterfaceLanguage", () => ({
  INTERFACE_LANGUAGE_CODES: ["fr", "en"],
  useInterfaceLanguage: () => ({ language: "fr", setLanguage: (lng: string) => void h.language.push(lng) }),
}));
vi.mock("../../../theme/useLiquidGlass", () => ({ useLiquidGlass: () => ({ toggleVisible: false }) }));
vi.mock("../mode/useOctaveAvailability", () => ({ useOctaveAvailability: () => ({ available: true, settled: true }) }));
vi.mock("../offline/offlineSurfaceContext", () => ({ useOfflineSurface: () => ({ library: true }) }));
vi.mock("../../../downloads/backgroundTransfersStore", () => ({ useBackgroundTransfers: () => true, setBackgroundTransfers: async () => undefined }));
vi.mock("../profiles", () => ({
  OctaveProfilesSettings: ({ badge }: { badge?: ReactNode }) => <section data-title="settings.profiles">{badge}</section>,
}));

const { OctaveSettingsView } = await import("./OctaveSettingsView");

/** La portée posée sur chaque groupe, par son titre. */
function scopes(html: string): Record<string, string> {
  return Object.fromEntries([...html.matchAll(/<section data-title="([^"]+)"><b data-scope="([^"]+)"/g)].map((m) => [m[1], m[2]]));
}

describe("Réglages d'Octave : la portée de chaque groupe", () => {
  const html = renderToStaticMarkup(<OctaveSettingsView />);

  it("Octave seulement : apparence, lecture, playlists gardées", () => {
    const found = scopes(html);
    expect(found["settings.appearance"]).toBe("octave");
    expect(found["crossfade.section"]).toBe("octave");
    expect(found["autosync.section"]).toBe("octave");
  });

  it("aussi dans Tentacle : langue et profils (compte), démarrage (cet appareil)", () => {
    const found = scopes(html);
    expect(found["settings.language"]).toBe("account");
    expect(found["settings.profiles"]).toBe("account");
    expect(found["settings.startup"]).toBe("device");
    // « Continuer en arrière-plan » : le réglage de Réglages › Téléchargements, sur CET appareil.
    expect(found["groups.downloads.transfers"]).toBe("device");
    expect(html.indexOf("settings.shared")).toBeLessThan(html.indexOf('data-title="settings.language"'));
    expect(html.indexOf('data-title="autosync.section"')).toBeLessThan(html.indexOf("settings.shared"));
  });

  it("la langue : le geste unique de Tentacle (aucune copie), les langues dites dans leur langue", () => {
    expect(h.language).toContain("en");
    expect(html).toContain("Français");
    expect(html).toContain("English");
  });

  it("rien de la vidéo", () => {
    expect(html).not.toMatch(/subtitle|playback\.|trailer|hero/i);
  });
});
