import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * « Voir la question maintenant » est un outil de DÉBOGAGE : les Réglages du
 * web et le panneau Lecture du miroir ne le montrent que derrière la porte du
 * débogage du web (`lib/webDebug.ts` — serveur en `TENTACLE_WEB_DEBUG=on`,
 * Vite, build instrumenté). Porte fermée, rien : ni la ligne, ni son état.
 * `t()` rend la clé.
 */

const debug = { open: false };

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("../../lib/webDebug", () => ({ isWebDebugEnabled: () => debug.open }));
vi.mock("@tentacle-tv/api-client", () => ({
  useStillWatchingSettings: () => ({
    available: true,
    supported: true,
    settings: { enabled: true, afterMs: 5_400_000, countdownMs: 60_000 },
    set: vi.fn(),
  }),
  useStillWatchingTrial: () => ({ armed: false, arm: vi.fn(), cancel: vi.fn() }),
}));

const { StillWatchingSetting } = await import("./StillWatchingSetting");
const { StillWatchingRows } = await import("../../mirror/screens/settings/catalog/controls/StillWatchingRows");
const StillWatchingSection = () => <StillWatchingRows scope="account" last />;

const TRIAL = "stillWatchingTrialTitle";

describe("« Voir la question maintenant » — derrière la porte du débogage", () => {
  beforeEach(() => {
    debug.open = false;
  });

  it("porte fermée : ni les Réglages ni le miroir ne montrent l'essai, les deux durées restent", () => {
    for (const markup of [renderToStaticMarkup(<StillWatchingSetting />), renderToStaticMarkup(<StillWatchingSection />)]) {
      expect(markup).not.toContain(TRIAL);
      expect(markup).toContain("stillWatchingCountdown");
    }
  });

  it("porte ouverte (serveur en debug) : l'essai paraît sous les deux durées", () => {
    debug.open = true;
    expect(renderToStaticMarkup(<StillWatchingSetting />)).toContain(TRIAL);
    expect(renderToStaticMarkup(<StillWatchingSection />)).toContain(TRIAL);
  });
});
