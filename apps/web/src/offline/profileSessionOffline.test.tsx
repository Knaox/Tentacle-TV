import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * Bureau, session d'un PROFIL et serveur muet (recette du 14/10) : rien de ce
 * qui est gardé sur la machine — c'est le contenu du COMPTE. Ni « Sur cet
 * appareil », ni « Gérer les téléchargements », ni un lien qui ne mène nulle
 * part : la cause, dans les mots partagés, puis l'attente. En session
 * personnelle, rien ne change.
 */

const state = vi.hoisted(() => ({
  profile: null as null | { id: string; kind: string },
  offline: true,
  reason: "backend" as string | null,
  diskReads: 0,
  entries: [] as Array<{ status: string }>,
}));

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("react-router-dom", () => ({
  Navigate: ({ to }: { to: string }) => <a data-navigate={to} />,
  useLocation: () => ({ pathname: "/" }),
  useNavigate: () => () => undefined,
}));
vi.mock("../auth/profileSession", () => ({ useActiveProfile: () => state.profile }));
vi.mock("./useOfflineMode", () => ({ useOfflineMode: () => state.offline }));
vi.mock("./useConnectivity", () => ({
  useConnectivity: () => ({ state: "offline-auto", manual: false, reachable: false, reason: state.reason, linkQuality: "good" }),
}));
vi.mock("../desktop/bridge", () => ({ supportsDownloads: () => true, isDesktopApp: () => true }));
vi.mock("@tanstack/react-query", () => ({ useQuery: () => ({ data: state.entries, isFetched: true }) }));
vi.mock("@tentacle-tv/offline-core/react", () => ({ LOCAL_QUERY: {} }));
vi.mock("@tentacle-tv/api-client", () => ({
  // Le cache gardé d'Octave se branche au chargement de son module (`octaveCacheBoot.ts`).
  configureOctaveCacheBackend: () => undefined,
  useUserId: () => "lea",
  // Les droits de la session : un serveur qui ne les dit pas (règle d'avant de chaque écran).
  useAccountAbilities: () => ({ kind: "legacy" }),
  mayShow: (_state: unknown, _ability: unknown, legacy = true) => legacy,
  useConnectivityNotice: () => ({
    kind: "server",
    titleKey: "errors:connectivityServerTitle",
    hintKey: "errors:connectivityServerHint",
    occasion: "1:server",
    durationMs: 10_000,
    done: () => undefined,
  }),
}));
vi.mock("../downloads/api", () => ({}));
vi.mock("../downloads/useDownloadCapabilities", () => ({
  useDownloadCapabilities: () => ({ capabilities: { downloads: true, lightDownloads: true } }),
}));
// Le catalogue du compte : seulement de quoi savoir s'il a lu le disque.
vi.mock("../components/PageTransition", () => ({ PageTransition: ({ children }: { children: unknown }) => <main>{children as never}</main> }));
vi.mock("../components/hero/HeroBillboard", () => ({ CARD_HEIGHT: 0, FRAME_GUTTER: 0 }));
vi.mock("../downloads/home/useOfflineHome", () => ({
  ALL_LIBRARIES: "all",
  useOfflineHome: () => {
    state.diskReads += 1;
    return { ready: true, complete: [], libraries: [], hero: [] };
  },
}));
vi.mock("../downloads/home/useEntriesWithBackdrop", () => ({ useEntriesWithBackdrop: () => ({ settled: true, entries: [] }) }));
vi.mock("../downloads/home/OfflineBillboard", () => ({ OfflineBillboard: () => null }));
vi.mock("../downloads/home/OfflineCardRow", () => ({ OfflineCardRow: () => null }));
vi.mock("../downloads/home/OfflineLibrarySection", () => ({ OfflineLibrarySection: () => null }));
vi.mock("../downloads/DownloadsEmptyState", () => ({ DownloadsEmptyState: () => <i data-empty-online /> }));
vi.mock("../downloads/OfflineDeviceSummary", () => ({ OfflineDeviceSummary: () => <a href="/downloads" /> }));
// La barre du haut : chaque pièce réduite à sa marque.
vi.mock("../components/nav/useScrollScrim", () => ({ useScrollScrim: () => ({ ref: () => undefined }) }));
vi.mock("../components/nav/NavBrand", () => ({ NavBrand: () => <i data-brand /> }));
vi.mock("../components/nav/NavTabs", () => ({ NavTabs: () => <i data-server-tabs /> }));
vi.mock("../components/search/SearchLauncher", () => ({ SearchLauncher: () => null }));
vi.mock("../components/NotificationBell", () => ({ NotificationBell: () => null }));
vi.mock("../components/UserAvatarMenu", () => ({ UserAvatarMenu: () => <i data-avatar /> }));
vi.mock("../watchTogether/WatchTogetherButton", () => ({ WatchTogetherButton: () => null }));
vi.mock("./ConnectivityChip", () => ({ ConnectivityChip: () => <i data-chip /> }));
vi.mock("./DataSaverChip", () => ({ DataSaverChip: () => null }));
vi.mock("../music/octave/mode/OctaveModeSwitch", () => ({ OctaveModeSwitch: () => null }));
vi.mock("./OfflineNavLinks", () => ({ OfflineNavLinks: () => <i data-offline-links /> }));
// Le message de bascule : ses lignes, à plat.
vi.mock("../components/notices/NoticeCard", () => ({
  NoticeCard: ({ title, lines }: { title: string; lines: string[] }) => <p>{[title, ...lines].join(" | ")}</p>,
}));
vi.mock("../components/session/useMessageCountdown", () => ({ useMessageCountdown: () => 1 }));

const { OfflineCatalog } = await import("../downloads/OfflineCatalog");
const { useDownloadsVisibility } = await import("../downloads/useDownloadState");
const { DownloadsNavButton } = await import("../downloads/DownloadsNavButton");
const { TopNav } = await import("../components/nav/TopNav");
const { OfflineSwitchBanner } = await import("./OfflineSwitchBanner");

function Visibility() {
  return <pre>{JSON.stringify(useDownloadsVisibility())}</pre>;
}

const SEPARATOR = "h-6 w-px";

describe("hors ligne, la session d'un profil", () => {
  beforeEach(() => {
    state.profile = { id: "lea", kind: "guest" };
    state.offline = true;
    state.reason = "backend";
    state.diskReads = 0;
    state.entries = [{ status: "complete" }];
  });

  it("l'accueil dit la cause (mots partagés) et l'attente, sans lire le disque ni mener à /downloads", () => {
    const html = renderToStaticMarkup(<OfflineCatalog />);
    expect(html).toContain("errors:connectivityServerTitle");
    expect(html).toContain("errors:connectivityServerHint");
    expect(html).toContain("profilePicker:session.offlineMessage");
    expect(html).not.toContain("/downloads");
    expect(state.diskReads).toBe(0);
  });

  it("sans réseau sur l'appareil, c'est l'appareil qui est hors ligne", () => {
    state.reason = "network";
    expect(renderToStaticMarkup(<OfflineCatalog />)).toContain("errors:connectivityDeviceTitle");
  });

  it("en ligne, « Sur cet appareil » n'existe pas pour lui : retour à l'accueil", () => {
    state.offline = false;
    expect(renderToStaticMarkup(<OfflineCatalog />)).toContain('data-navigate="/"');
    expect(state.diskReads).toBe(0);
  });

  it("aucune entrée du contenu gardé, même avec des titres sur la machine", () => {
    const visibility = JSON.parse(renderToStaticMarkup(<Visibility />).replace(/<\/?pre>/g, "").replace(/&quot;/g, '"'));
    expect(visibility).toEqual({ visible: false, canDownload: false, canLight: false, hasContent: false });
    expect(renderToStaticMarkup(<DownloadsNavButton />)).toBe("");
  });

  it("la barre du haut : ni onglets hors ligne, ni séparateur qui ne sépare rien", () => {
    const html = renderToStaticMarkup(<TopNav />);
    expect(html).not.toContain("data-offline-links");
    expect(html).not.toContain(SEPARATOR);
    expect(html).toContain("data-chip");
    expect(html).toContain("data-avatar");
  });

  it("le message de bascule dit la cause, sans « ce qui est sur cet appareil reste lisible »", () => {
    const html = renderToStaticMarkup(<OfflineSwitchBanner />);
    expect(html).toContain("errors:connectivityServerHint");
    expect(html).not.toContain("errors:connectivityOfflineMode");
  });
});

describe("hors ligne, la session personnelle (inchangée)", () => {
  beforeEach(() => {
    state.profile = null;
    state.offline = true;
    state.reason = "backend";
    state.diskReads = 0;
    state.entries = [{ status: "complete" }];
  });

  it("l'accueil est le catalogue de la machine", () => {
    renderToStaticMarkup(<OfflineCatalog />);
    expect(state.diskReads).toBeGreaterThan(0);
  });

  it("le contenu gardé reste atteignable", () => {
    expect(renderToStaticMarkup(<Visibility />)).toContain("&quot;visible&quot;:true");
    expect(renderToStaticMarkup(<DownloadsNavButton />)).toContain("<button");
  });

  it("la barre garde ses onglets hors ligne, après le séparateur", () => {
    const html = renderToStaticMarkup(<TopNav />);
    expect(html).toContain("data-offline-links");
    expect(html).toContain(SEPARATOR);
  });

  it("le message de bascule dit aussi ce qui reste lisible", () => {
    expect(renderToStaticMarkup(<OfflineSwitchBanner />)).toContain("errors:connectivityOfflineMode");
  });
});
