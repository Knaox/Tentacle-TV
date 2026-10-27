import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ConnectivityState, KeptMusicTrack } from "@tentacle-tv/offline-core";
import { NO_MUSIC_OFFLINE, type MusicOfflineSurface } from "./keepRules";
import { OfflineSurfaceContext } from "./offlineSurfaceContext";

/**
 * Octave — où se trouvent « Passer hors ligne » / « Revenir en ligne » : le menu du profil, l'en-tête de « Sur cet
 * appareil », l'avis hors ligne ; et le geste pose le MÊME état que le mode films (`setManualOffline`).
 */
const h = vi.hoisted(() => ({
  state: "online" as ConnectivityState,
  desktop: true,
  profile: null as { id: string } | null,
  tracks: [] as Partial<KeptMusicTrack>[],
  manual: [] as boolean[],
  probes: 0,
}));

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("../../../offline/useConnectivity", () => ({ useConnectivity: () => ({ state: h.state }) }));
vi.mock("../../../offline/connectivityStore", () => ({
  setManualOffline: (on: boolean) => h.manual.push(on),
  probeNow: async () => {
    h.probes += 1;
  },
}));
vi.mock("../../../auth/profileSession", () => ({ useActiveProfile: () => h.profile }));
vi.mock("../../../desktop/bridge", () => ({ supportsDownloads: () => h.desktop }));
vi.mock("./useKeptMusic", () => ({ useKeptMusic: () => ({ tracks: h.tracks }) }));
vi.mock("../../../components/ui/glass/PressableGlass", () => ({
  PressableGlass: ({ children, title }: { children?: ReactNode; title?: string }) => <button title={title}>{children}</button>,
}));
vi.mock("../components/CollectionHeader", () => ({ SECONDARY_CAPSULE_PROPS: {} }));

const { applyOfflineSwitch, OfflineNotice, OfflineSwitchButton, OfflineSwitchMenuItem } = await import("./OfflineSwitch");

const VISIBLE: MusicOfflineSurface = { visible: true, library: true, externalFrom: null };
const render = (node: ReactNode, surface: MusicOfflineSurface = VISIBLE) =>
  renderToStaticMarkup(<OfflineSurfaceContext.Provider value={surface}>{node}</OfflineSurfaceContext.Provider>);
const menu = () => render(<OfflineSwitchMenuItem className="item" onDone={() => undefined} />);

beforeEach(() => {
  h.state = "online";
  h.desktop = true;
  h.profile = null;
  h.tracks = [{ status: "complete" }];
  h.manual = [];
  h.probes = 0;
});

describe("« Passer hors ligne » dans Octave", () => {
  it("en ligne : dans le menu du profil et dans l'en-tête de « Sur cet appareil »", () => {
    expect(menu()).toContain('data-octave-offline-switch="goOffline"');
    expect(menu()).toContain("switch.goOffline");
    const button = render(<OfflineSwitchButton />);
    expect(button).toContain("switch.goOffline");
    expect(button).toContain('title="switch.goOfflineHint"');
  });

  it("le web, une session de profil, sans la porte, sans rien de gardé en entier : nulle part", () => {
    h.desktop = false;
    expect(menu()).toBe("");
    h.desktop = true;
    h.profile = { id: "p" };
    expect(menu()).toBe("");
    expect(render(<OfflineSwitchButton />)).toBe("");
    h.profile = null;
    expect(render(<OfflineSwitchButton />, NO_MUSIC_OFFLINE)).toBe("");
    h.tracks = [{ status: "downloading" }];
    expect(menu()).toBe("");
  });

  it("hors ligne par choix : « Revenir en ligne » dans le menu et dans l'avis ; plus de capsule", () => {
    h.state = "offline-manual";
    expect(menu()).toContain("switch.goOnline");
    expect(render(<OfflineSwitchButton />)).toBe("");
    const notice = render(<OfflineNotice />);
    expect(notice).toContain("switch.manualHint");
    expect(notice).toContain('data-octave-offline-switch="goOnline"');
  });

  it("hors ligne subi : l'avis propose « Réessayer la connexion », le menu rien", () => {
    h.state = "offline-auto";
    expect(menu()).toBe("");
    const notice = render(<OfflineNotice />);
    expect(notice).toContain("view.offlineHint");
    expect(notice).toContain('data-octave-offline-switch="retry"');
  });

  it("le geste pose le même état que le mode films ; « Réessayer » relance la sonde", async () => {
    await applyOfflineSwitch("goOffline");
    await applyOfflineSwitch("goOnline");
    await applyOfflineSwitch("retry");
    await applyOfflineSwitch(null);
    expect(h.manual).toEqual([true, false]);
    expect(h.probes).toBe(1);
  });
});
