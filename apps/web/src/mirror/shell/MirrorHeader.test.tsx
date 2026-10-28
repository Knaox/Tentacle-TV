import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * L'en-tête du miroir porte la bascule d'Octave (celle du bureau, qui se tait
 * seule sans musique) ; hors ligne, les actions serveur — elle comprise — partent.
 */
const h = vi.hoisted(() => ({ offline: false }));

vi.mock("react-router-dom", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/">{children}</a>,
  useNavigate: () => () => undefined,
}));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("../../music/octave/mode/OctaveModeSwitch", () => ({
  OctaveModeSwitch: ({ placement }: { placement: string }) => <span data-octave-switch={placement} />,
}));
vi.mock("../../offline/useOfflineMode", () => ({ useOfflineMode: () => h.offline }));
vi.mock("../../offline/useConnectivity", () => ({ useConnectivity: () => ({ state: h.offline ? "offline-manual" : "online" }) }));
vi.mock("../../offline/ConnectivityChip", () => ({ ConnectivityChip: () => null }));
vi.mock("./HeaderContentMenu", () => ({ HeaderContentMenu: () => null }));
vi.mock("./MirrorNotificationBell", () => ({ MirrorNotificationBell: () => null }));
vi.mock("./ProfileChip", () => ({ ProfileChip: () => null }));
vi.mock("./useProfileSwitchOffered", () => ({ useProfileSwitchOffered: () => false }));

import { MirrorHeader } from "./MirrorHeader";

const render = () => renderToStaticMarkup(<MirrorHeader collapsed={false} />);

describe("MirrorHeader — la bascule d'Octave", () => {
  beforeEach(() => {
    h.offline = false;
  });

  it("en ligne : la bascule de la barre de Tentacle, en tête des actions", () => {
    expect(render()).toContain('data-octave-switch="tentacle"');
  });

  it("hors ligne : aucune bascule (les actions serveur partent)", () => {
    h.offline = true;
    expect(render()).not.toContain("data-octave-switch");
  });
});
