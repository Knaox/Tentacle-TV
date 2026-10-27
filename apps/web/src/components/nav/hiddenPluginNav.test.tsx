import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * Une page d'extension MASQUÉE (`hidden`, capacité `plugins.navigation`) dans
 * les vrais crochets de la navigation : ni barre, ni « Plus », ni
 * « Personnaliser la barre » (`useNavDestinations`), ni section du miroir
 * (`useExtensionPlugins`) — même épinglée sur l'appareil avant d'être masquée.
 * Une page « Plus » (`primary: false`) et une page d'un serveur d'avant gardent
 * leur place.
 */

const state = vi.hoisted(() => ({ plugins: [] as unknown[] }));

// L'appareil la tenait épinglée (liste d'avant le 26/10 comprise) : rien ne doit la ramener.
vi.hoisted(() => {
  const store = new Map<string, string>([["tentacle_pinned_nav", JSON.stringify({ pluginsUnpinned: [], pluginsPinned: ["x:/x/cachee"] })]]);
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  };
});

// Rendu serveur : les magasins de l'appareil (`usePinnedNav`, `useNavBarLayout`) se lisent tels quels.
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, useSyncExternalStore: (_subscribe: unknown, getSnapshot: () => unknown) => getSnapshot() };
});
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: "fr" } }) }));
vi.mock("@tentacle-tv/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tentacle-tv/api-client")>()),
  useLibraries: () => ({ data: [] }),
}));
vi.mock("@tentacle-tv/plugins-api", () => ({ useActivePluginsMeta: () => state.plugins }));
vi.mock("../../rights/useVisiblePlugins", () => ({ useVisiblePlugins: () => state.plugins }));
vi.mock("../../offline/useOfflineMode", () => ({ useOfflineMode: () => false }));

const { useNavDestinations } = await import("./useNavDestinations");
const { useExtensionPlugins } = await import("../../mirror/shell/useMirrorTabs");

const page = (path: string, extra: Record<string, unknown> = {}) => ({ path, icon: "clock", platforms: ["web", "desktop"], labels: { fr: path }, ...extra });

function extension(navItems: unknown[]) {
  return [{ id: "1", pluginId: "x", name: "X", version: "1", hasBundle: true, configEnabled: true, navItems }];
}

function readNav() {
  let seen: ReturnType<typeof useNavDestinations> | undefined;
  let mirror: ReturnType<typeof useExtensionPlugins> | undefined;
  function Probe() {
    seen = useNavDestinations();
    mirror = useExtensionPlugins();
    return null;
  }
  renderToStaticMarkup(<Probe />);
  return {
    bar: seen!.primary.map((e) => e.key).filter((k) => k.startsWith("plugin-")),
    customize: seen!.entries.map((e) => e.key).filter((k) => k.startsWith("plugin-")),
    more: seen!.extensions.map((e) => e.key),
    mirror: mirror!.flatMap((p) => p.sections.map((s) => s.path)),
  };
}

describe("page d'extension masquée dans la navigation du web", () => {
  it("serveur d'avant (ni `primary` ni `hidden`) : dans la barre, « Plus », « Personnaliser » et le miroir", () => {
    state.plugins = extension([page("/x/page")]);
    expect(readNav()).toEqual({ bar: ["plugin-x:/x/page"], customize: ["plugin-x:/x/page"], more: ["plugin-x:/x/page"], mirror: ["/x/page"] });
  });

  it("« Plus » (`primary: false`) : seulement dans « Plus » et le miroir", () => {
    state.plugins = extension([page("/x/page", { primary: false })]);
    expect(readNav()).toEqual({ bar: [], customize: [], more: ["plugin-x:/x/page"], mirror: ["/x/page"] });
  });

  it("masquée, épinglée sur l'appareil avant : nulle part ; les autres pages restent", () => {
    state.plugins = extension([page("/x/cachee", { primary: false, hidden: true }), page("/x/page")]);
    expect(readNav()).toEqual({ bar: ["plugin-x:/x/page"], customize: ["plugin-x:/x/page"], more: ["plugin-x:/x/page"], mirror: ["/x/page"] });
  });

  it("masquée, seule page de l'extension : le miroir n'a plus d'extension du tout", () => {
    state.plugins = extension([page("/x/cachee", { primary: false, hidden: true })]);
    expect(readNav()).toEqual({ bar: [], customize: [], more: [], mirror: [] });
  });
});
