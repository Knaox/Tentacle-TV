import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * Octave — la bascule : un vrai interrupteur (`role="switch"`, état annoncé),
 * absente sans musique, allumée dans Octave ; et le réglage du démarrage,
 * absent sans musique, ses trois choix visibles sinon.
 */
const h = vi.hoisted(() => ({ available: true, mode: false, live: [] as boolean[], offline: false, profile: false, mirror: false }));

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("react-router-dom", () => ({ useNavigate: () => () => undefined }));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({}) }));
vi.mock("../../engine/engineAuth", () => ({ useMusicEngineAuth: () => ({ baseUrl: "", token: null, useCredentials: true }) }));
vi.mock("./useOctaveAvailability", () => ({
  useOctaveAvailability: (enabled = true) => ({ available: enabled && h.available, settled: true }),
}));
vi.mock("@tentacle-tv/api-client", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useMusicStatus: () => ({ isError: false }),
  useServerCapabilities: () => ({ known: !h.offline }),
}));
vi.mock("../../../offline/useOfflineMode", () => ({ useOfflineMode: () => h.offline }));
vi.mock("../../../auth/profileSession", () => ({ useActiveProfile: () => (h.profile ? { id: "p" } : null) }));
vi.mock("../cache/octaveOwner", () => ({ octaveOwner: () => "srv|u1" }));
vi.mock("./octaveLaunchStore", async (importOriginal) => ({ ...(await importOriginal<object>()), launchOctaveMirror: () => (h.mirror ? { owner: "srv|u1", available: true } : null) }));
vi.mock("./useOctaveAccessLive", () => ({ useOctaveAccessLive: (enabled: boolean) => void h.live.push(enabled) }));
vi.mock("./octaveMode", () => ({
  OCTAVE_BASE_PATH: "/octave",
  isOctaveMode: () => h.mode,
  useOctaveMode: () => h.mode,
  setOctaveMode: () => undefined,
}));

const { OctaveModeSwitch } = await import("./OctaveModeSwitch");
const { OctaveStartupSetting } = await import("./OctaveStartupSetting");
const { OCTAVE_GLYPH_PATHS } = await import("../../../components/ui/octaveLogo.generated");

beforeEach(() => {
  h.available = true;
  h.mode = false;
  h.live = [];
  h.offline = false;
  h.profile = false;
  h.mirror = false;
});

describe("bascule du mode", () => {
  // Damien, 26/10 : « la note de musique sur le slide toggle plutôt que le poulpe ».
  it("le pouce porte la NOTE d'Octave (le glyphe généré, à `currentColor`), jamais la mascotte", () => {
    for (const html of [
      renderToStaticMarkup(<OctaveModeSwitch placement="tentacle" />),
      renderToStaticMarkup(<OctaveModeSwitch placement="octave" onExit={() => undefined} showLabel />),
    ]) {
      const thumb = /<span class="octave-switch-thumb">([\s\S]*?)<\/span>/.exec(html)?.[1] ?? "";
      expect(thumb).toContain('fill="currentColor"');
      for (const d of OCTAVE_GLYPH_PATHS) expect(thumb).toContain(`d="${d}"`);
      expect(thumb).not.toMatch(/<img|data:image/);
    }
  });

  // Lot « fl » (30/10) : hors ligne, la bascule mène à la musique gardée — d'après le dernier passage en ligne.
  it("barre de Tentacle HORS LIGNE : la bascule reste si Octave était disponible (miroir), jamais pour un profil", () => {
    h.available = false;
    h.offline = true;
    expect(renderToStaticMarkup(<OctaveModeSwitch placement="tentacle" />)).toBe("");
    h.mirror = true;
    expect(renderToStaticMarkup(<OctaveModeSwitch placement="tentacle" />)).toContain('role="switch"');
    h.profile = true;
    expect(renderToStaticMarkup(<OctaveModeSwitch placement="tentacle" />)).toBe("");
  });

  it("barre de Tentacle, sans musique : aucune trace", () => {
    h.available = false;
    expect(renderToStaticMarkup(<OctaveModeSwitch placement="tentacle" />)).toBe("");
  });

  it("barre de Tentacle, même sans musique, écoute l'accès en direct (il peut revenir) ; Octave l'écoute déjà", () => {
    h.available = false;
    renderToStaticMarkup(<OctaveModeSwitch placement="tentacle" />);
    renderToStaticMarkup(<OctaveModeSwitch placement="octave" onExit={() => undefined} />);
    expect(h.live).toEqual([true, false]);
  });

  it("barre de Tentacle : un interrupteur éteint, nommé, qui dit où il mène", () => {
    const html = renderToStaticMarkup(<OctaveModeSwitch placement="tentacle" />);
    expect(html).toContain('role="switch"');
    expect(html).toContain('aria-checked="false"');
    expect(html).toContain('aria-label="mode.switchLabel"');
    expect(html).toContain('title="mode.enterHint"');
  });

  // Damien, 26/10 : au retour de « Gérer les profils », l'interrupteur restait allumé et recliquer l'éteignait.
  it("barre de Tentacle, mode encore allumé : éteint quand même (on est dans Tentacle), un clic y ramène", () => {
    h.mode = true;
    const html = renderToStaticMarkup(<OctaveModeSwitch placement="tentacle" />);
    expect(html).toContain('aria-checked="false"');
    expect(html).toContain('title="mode.enterHint"');
  });

  it("dans Octave : allumé, et propose de revenir", () => {
    const html = renderToStaticMarkup(<OctaveModeSwitch placement="octave" onExit={() => undefined} showLabel />);
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain('title="mode.exitHint"');
    expect(html).toContain(">mode.switchLabel<");
  });
});

describe("réglage « Au démarrage, ouvrir »", () => {
  it("sans musique : aucune trace", () => {
    h.available = false;
    expect(renderToStaticMarkup(<OctaveStartupSetting />)).toBe("");
  });

  it("avec musique : les trois choix, « dernier mode utilisé » par défaut", () => {
    const html = renderToStaticMarkup(<OctaveStartupSetting />);
    for (const key of ["mode.startupLast", "mode.startupOctave", "mode.startupTentacle", "mode.startupLabel"]) expect(html).toContain(key);
    const checked = [...html.matchAll(/role="radio" aria-checked="true"[^>]*>([\s\S]*?)<\/button>/g)].map((m) => m[1]);
    expect(checked).toHaveLength(1);
    expect(checked[0]).toContain("mode.startupLast");
  });
});
