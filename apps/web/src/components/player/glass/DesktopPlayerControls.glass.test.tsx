import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement, ReactNode } from "react";

/**
 * L'aiguillage de l'habillage du lecteur de bureau : le verre ne remplace
 * l'habillage peint par la page QUE là où le verre natif se pose. Partout
 * ailleurs — lecteur sans fournisseur, réglage coupé, OS ou montage sans verre
 * natif — les capsules de la refonte (`chrome/`), sans une classe du verre.
 *
 * Rendu statique, comme les autres bancs de composants : `t()` rend la clé,
 * l'api-client est remplacé (chargé en vrai, il tire une seconde copie de React).
 */

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: "fr" } }),
}));
// framer-motion embarque sa propre copie de React sous Node : remplacé, comme ailleurs.
vi.mock("framer-motion", async () => {
  const { createElement } = await import("react");
  return {
    AnimatePresence: ({ children }: { children?: ReactNode }) => <>{children}</>,
    useIsPresent: () => true,
    useReducedMotion: () => false,
    // Toute balise : `motion.div` des panneaux, `motion.span` des graines de métamorphose.
    motion: new Proxy({}, {
      get: (_, tag: string) => ({ children }: { children?: ReactNode }) => createElement(tag, null, children),
    }),
  };
});
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
  it("sans fournisseur (lecteur web, aperçus) : l'habillage de la page, sans une classe du verre", () => {
    expect(LEGACY).toContain('class="pl-chrome"');
    // Deux capsules : le transport, puis le son et les réglages.
    expect(LEGACY.match(/class="pl-caps"/g)?.length).toBe(2);
    expect(LEGACY).not.toContain("lgp-");
  });

  it("la SORTIE est le premier contrôle de l'habillage : visible dès que les contrôles le sont", () => {
    expect(LEGACY).toMatch(/<div class="pl-bar pl-bar--top"><button[^>]*data-player-back/);
    expect(LEGACY).toContain('aria-label="player:back"');
  });

  it("la barre de lecture porte la jauge en `scaleX`, jamais une largeur", () => {
    expect(LEGACY).toMatch(/class="pl-seek__fill" style="transform:scaleX\(0\.1\)"/);
    expect(LEGACY).not.toMatch(/pl-seek[^>]*style="[^"]*width/);
  });

  it("contrôles masqués hors verre : plus rien dans le DOM", () => {
    expect(renderToStaticMarkup(controls(false))).toBe("");
  });

  it("verre natif disponible : la MÊME disposition que sans verre — sortie, barre, deux capsules —, en verre", () => {
    const html = renderToStaticMarkup(
      <PlayerGlassModeContext.Provider value="native">{controls()}</PlayerGlassModeContext.Provider>,
    );
    // Un voile en haut, un en bas, peints par la page.
    expect(html).toContain("lgp-scrim--top");
    expect(html).toContain("lgp-scrim--bottom");
    // Le titre et la barre sont du TEXTE sur le voile.
    expect(html).toMatch(/class="lgp-heading lgp-nude"/);
    expect(html).toMatch(/class="lgp-timeline lgp-nude"/);
    // Trois formes de verre, celles de l'habillage sans verre : le rond de la sortie, la capsule
    // du transport, la capsule du son et des réglages — plus de ronds séparés (lot rf2).
    expect(html.match(/lgp-surface lgp-orb/g)?.length).toBe(1);
    expect(html.match(/lgp-surface lgp-caps/g)?.length).toBe(2);
    expect(html.match(/data-lgp-materialize=""/g)?.length).toBe(3);
    // Elles se MATÉRIALISENT à leur rang : le transport, les réglages, puis la sortie.
    expect(html.match(/--lgp-mat-delay:(\d+)ms/g)).toEqual(
      ["--lgp-mat-delay:80ms", "--lgp-mat-delay:20ms", "--lgp-mat-delay:50ms"],
    );
    expect(html).not.toContain("pl-chrome");
    // La matière est native : en mode natif, la page ne peint aucun fond d'aperçu.
    expect(html).not.toContain("lgp-surface--preview");
  });

  it("verre : mêmes commandes, dans le même ORDRE, que l'habillage sans verre", () => {
    const labels = (html: string): string[] => [...html.matchAll(/<(?:button|input)[^>]*aria-label="([^"]+)"/g)].map((m) => m[1]!);
    const glass = renderToStaticMarkup(
      <PlayerGlassModeContext.Provider value="native">{controls()}</PlayerGlassModeContext.Provider>,
    );
    expect(labels(glass)).toEqual(labels(LEGACY));
    // Le temps se lit au même endroit, dans la même écriture : « position / durée ».
    expect(LEGACY).toMatch(/class="pl-time">0:10 \/ 1:40</);
    expect(glass).toMatch(/class="lgp-time lgp-time--row lgp-nude"[^>]*>0:10 \/ 1:40</);
    // Lire / pause reste le disque plein de la capsule.
    expect(glass.match(/lgp-btn--main/g)?.length).toBe(1);
  });

  it("réglage allumé mais aucun verre natif (avant la fusion du socle, Intel, macOS < 26) : au pixel près l'habillage de la page", () => {
    const html = renderToStaticMarkup(<PlayerGlassProvider>{controls()}</PlayerGlassProvider>);
    expect(html).toBe(LEGACY);
  });

  it("contrôles masqués : les surfaces se déclarent absentes (régions natives retirées)", () => {
    const html = renderToStaticMarkup(
      <PlayerGlassModeContext.Provider value="native">{controls(false)}</PlayerGlassModeContext.Provider>,
    );
    expect(html).toContain('data-lgp-present="false"');
    expect(html).not.toContain('data-lgp-present="true"');
    // Le voile et le texte nu partent avec eux.
    expect(html).toMatch(/lgp-scrim lgp-scrim--bottom" data-lgp-present="false"/);
  });
});
