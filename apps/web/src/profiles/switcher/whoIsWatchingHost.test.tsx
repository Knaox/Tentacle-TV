import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { SwitchContext } from "../launch/ProfileLaunchScreen";

/**
 * L'hôte de « Changer de profil » rendu à plat : rien tant qu'il est fermé ;
 * ouvert, un dialogue modal plein écran, sous la bande de la fenêtre macOS,
 * qui confie au MÊME contrôleur qu'à l'ouverture (remplacé ici) le profil en
 * cours et, si l'application est dans un groupe, de quoi quitter Watch
 * Together avant une bascule. Le portail est rendu en place (le rendu
 * serveur n'en a pas), dans un `document` de banc.
 */

const state = vi.hoisted(() => ({
  active: null as { id: string } | null,
  inGroup: false,
  switching: null as SwitchContext | null,
}));

vi.mock("react-dom", async (importOriginal) => ({ ...(await importOriginal<typeof import("react-dom")>()), createPortal: (node: unknown) => node }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("react-router-dom", () => ({ useNavigate: () => () => undefined }));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({}) }));
vi.mock("@tentacle-tv/api-client", () => ({ useJellyfinClient: () => ({}) }));
vi.mock("../../auth/profileSession", () => ({ useActiveProfile: () => state.active }));
vi.mock("../../auth/dropSessions", () => ({ dropAllSessions: vi.fn() }));
vi.mock("../../components/ui/Modal", () => ({ focusableIn: () => [] }));
vi.mock("../../watchTogether/WatchTogetherProvider", () => ({
  useWatchTogether: () => ({ isInGroup: state.inGroup, actions: { leave: async () => undefined } }),
}));
vi.mock("../launch/ProfileLaunchScreen", () => ({
  ProfileLaunchScreen: ({ switching }: { switching: SwitchContext }) => {
    state.switching = switching;
    return <i data-screen />;
  },
}));

const { WhoIsWatchingHost } = await import("./WhoIsWatchingHost");
const { openSwitchScreen, resetSwitchScreen } = await import("./switchScreenStore");

describe("l'hôte de « Changer de profil »", () => {
  beforeEach(() => {
    vi.stubGlobal("document", { body: {} });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    resetSwitchScreen();
    state.active = null;
    state.inGroup = false;
    state.switching = null;
  });

  it("fermé : rien du tout", () => {
    expect(renderToStaticMarkup(<WhoIsWatchingHost />)).toBe("");
  });

  it("ouvert : un dialogue modal plein écran, sous la bande de la fenêtre, avec « Qui regarde ? » dedans", () => {
    openSwitchScreen();
    const html = renderToStaticMarkup(<WhoIsWatchingHost />);
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('aria-label="whoIsWatching"');
    expect(html).toContain("top:var(--hote-bandeau, 0px)");
    expect(html).toContain("fixed inset-x-0 bottom-0");
    expect(html).toContain("data-screen");
  });

  it("session personnelle hors de tout groupe : le profil en cours est le sien, rien à quitter", () => {
    openSwitchScreen();
    renderToStaticMarkup(<WhoIsWatchingHost />);
    expect(state.switching?.activeProfileId).toBeNull();
    expect(state.switching?.leaveGroup).toBeUndefined();
  });

  it("session d'un profil, dans un groupe Watch Together : ce profil-là, et le groupe à quitter avant une bascule", () => {
    state.active = { id: "zoe" };
    state.inGroup = true;
    openSwitchScreen();
    renderToStaticMarkup(<WhoIsWatchingHost />);
    expect(state.switching?.activeProfileId).toBe("zoe");
    expect(typeof state.switching?.leaveGroup).toBe("function");
  });
});
