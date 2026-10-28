import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { NO_MUSIC_OFFLINE, type MusicOfflineSurface } from "./keepRules";
import { OfflineSurfaceContext } from "./offlineSurfaceContext";

/**
 * Octave — le lecteur dit d'où il lit (Damien, 28/10 : « il m'affiche qu'il lit le titre en Opus quand je lis un
 * titre hors ligne… ») : « Sur cet appareil » quand la source est la copie gardée, rien en flux ; jamais la couleur
 * seule ; rien hors de la portée du hors ligne (web, session de profil).
 */
const h = vi.hoisted(() => ({ snapshot: { fromDevice: false } as Record<string, unknown> }));

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("../player/OctavePlayerProvider", () => ({
  usePlayerSelector: (select: (s: Record<string, unknown>) => unknown) => select(h.snapshot),
}));

const { FromDeviceMark } = await import("./FromDeviceMark");

const VISIBLE: MusicOfflineSurface = { visible: true, library: true, externalFrom: null };
const render = (variant: "icon" | "chip", surface: MusicOfflineSurface = VISIBLE) =>
  renderToStaticMarkup(
    <OfflineSurfaceContext.Provider value={surface}>
      <FromDeviceMark variant={variant} />
    </OfflineSurfaceContext.Provider>,
  );

beforeEach(() => {
  h.snapshot = { fromDevice: true };
});

describe("« Sur cet appareil » dans le lecteur", () => {
  it("le dock : l'icône seule, le mot pour les lecteurs d'écran et en infobulle", () => {
    const html = render("icon");
    expect(html).toContain("data-octave-from-device");
    expect(html).toContain('title="player.fromDeviceHint"');
    expect(html).toMatch(/<span class="sr-only">player\.fromDevice<\/span>/);
  });

  it("le lecteur « en cours » : la pastille avec le mot", () => {
    const html = render("chip");
    expect(html).toMatch(/<\/svg>player\.fromDevice<\/span>$/);
    expect(html).not.toContain("sr-only");
  });

  it("en flux : rien", () => {
    h.snapshot = { fromDevice: false };
    expect(render("icon")).toBe("");
    expect(render("chip")).toBe("");
  });

  it("hors de la portée du hors ligne (web, session de profil) : rien, même lu depuis une copie", () => {
    expect(render("icon", NO_MUSIC_OFFLINE)).toBe("");
    expect(render("chip", NO_MUSIC_OFFLINE)).toBe("");
  });
});
