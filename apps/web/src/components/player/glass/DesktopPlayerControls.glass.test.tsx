import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement, ReactNode } from "react";

/**
 * L'aiguillage de l'habillage du lecteur de bureau : le verre ne remplace
 * l'habillage d'avant QUE là où le verre natif se pose. Partout ailleurs —
 * lecteur sans fournisseur, réglage coupé, OS ou montage sans verre natif —
 * le rendu d'avant, inchangé.
 *
 * Rendu statique, comme les autres bancs de composants : `t()` rend la clé,
 * l'api-client est remplacé (chargé en vrai, il tire une seconde copie de React).
 */

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: "fr" } }),
}));
// framer-motion embarque sa propre copie de React sous Node : remplacé, comme ailleurs.
vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children?: ReactNode }) => <>{children}</>,
  useIsPresent: () => true,
  useReducedMotion: () => false,
  motion: { div: ({ children }: { children?: ReactNode }) => <div>{children}</div> },
}));
vi.mock("@tentacle-tv/api-client", () => ({ useEndCardRating: () => null }));
// Les panneaux d'épisodes tirent le moteur hors ligne (et `main.tsx`) : fermés ici, remplacés.
vi.mock("../EpisodeSelectorPanel", () => ({ EpisodeSelectorPanel: () => null }));
vi.mock("../LocalEpisodeSelectorPanel", () => ({ LocalEpisodeSelectorPanel: () => null }));
vi.mock("../../../watchTogether/WatchTogetherProvider", () => ({ useWatchTogether: () => ({ isInGroup: false }) }));

const { DesktopPlayerControls } = await import("../DesktopPlayerControls");
const { PlayerGlassModeContext, PlayerGlassProvider } = await import("./PlayerGlassContext");

const noop = () => undefined;
const seekbar = {
  seekBarRef: { current: null }, dragProgress: null, hoverTime: null, hoverX: 0, barWidth: 0,
  setBarWidth: noop, onScrubStart: noop, onBarMouseMove: noop, endHover: noop,
  trickplay: { info: null }, trickplayFrame: null,
};

const controls = (visible = true): ReactElement => (
  <DesktopPlayerControls
    visible={visible} state={{ paused: false, muted: false, volume: 80, fullscreen: false } as never}
    title="Le Film" isDirectPlay isEpisode={false} useLocalEpisodes={false}
    displayAudio={[]} displaySubs={[]} curAudio={0} curSub={null} currentQuality={"original" as never}
    hasSettings={false} dur={100} actualPos={10} displayProgress={0.1} bufProg={0.2}
    seekbar={seekbar as never}
    showSettings={false} showEpisodes={false} setShowSettings={noop} setShowEpisodes={noop}
    closePanels={{ settings: noop, episodes: noop }}
    goBack={noop} togglePause={noop} skipBy={noop} toggleMute={noop} setVolume={noop}
    setSpeed={noop} toggleFullscreen={noop} handleAudioChange={noop} handleSubtitleChange={noop}
  />
);

const LEGACY = renderToStaticMarkup(controls());

describe("l'habillage du lecteur de bureau", () => {
  it("sans fournisseur (lecteur web, aperçus) : l'habillage d'avant, sans une classe du verre", () => {
    expect(LEGACY).toContain("bg-gradient-to-t");
    expect(LEGACY).not.toContain("lgp-");
  });

  it("verre natif disponible : les deux capsules, plus aucun dégradé d'assombrissement", () => {
    const html = renderToStaticMarkup(
      <PlayerGlassModeContext.Provider value="native">{controls()}</PlayerGlassModeContext.Provider>,
    );
    expect(html).toContain("lgp-topbar");
    expect(html).toContain("lgp-bar");
    expect(html).not.toContain("bg-gradient-to-t");
    // La matière est native : en mode natif, la page ne peint aucun fond d'aperçu.
    expect(html).not.toContain("lgp-surface--preview");
  });

  it("réglage allumé mais aucun verre natif (avant la fusion du socle, Intel, macOS < 26) : au pixel près l'habillage d'avant", () => {
    const html = renderToStaticMarkup(<PlayerGlassProvider>{controls()}</PlayerGlassProvider>);
    expect(html).toBe(LEGACY);
  });

  it("contrôles masqués : les surfaces se déclarent absentes (régions natives retirées)", () => {
    const html = renderToStaticMarkup(
      <PlayerGlassModeContext.Provider value="native">{controls(false)}</PlayerGlassModeContext.Provider>,
    );
    expect(html).toContain('data-lgp-present="false"');
    expect(html).not.toContain('data-lgp-present="true"');
  });
});
