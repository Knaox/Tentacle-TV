import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * « Partager Ma liste » et « Partager mes favoris » ne paraissent que si le
 * compte a le droit « Partage public » (ou face à un serveur d'avant : la
 * règle `usePublicSharingAllowed` le décide, testée dans api-client). Sans
 * lui, ni bouton ni pilule, et aucune lecture du lien.
 */
const h = vi.hoisted(() => ({ allowed: false, mineCalls: 0 }));

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@tentacle-tv/api-client", () => ({
  usePublicSharingAllowed: () => h.allowed,
  useMyShareLink: () => {
    h.mineCalls += 1;
    return { data: undefined };
  },
  useCreateShareLink: () => ({ mutateAsync: async () => ({ token: "t" }) }),
}));
vi.mock("../../contexts/ToastContext", () => ({ useToast: () => ({ show: () => undefined }) }));

const { ShareMyListButton } = await import("./ShareMyListButton");
const { ShareMyListButton: MirrorShareButton } = await import("../../mirror/screens/collection/ShareMyListButton");

beforeEach(() => {
  h.allowed = false;
  h.mineCalls = 0;
});

describe("les boutons « Partager »", () => {
  it("sans le droit : rien, ni sur la page large ni dans la fenêtre étroite, et aucun lien lu", () => {
    expect(renderToStaticMarkup(<ShareMyListButton kind="watchlist" />)).toBe("");
    expect(renderToStaticMarkup(<MirrorShareButton kind="likes" />)).toBe("");
    expect(h.mineCalls).toBe(0);
  });

  it("avec le droit : le bouton de chaque liste", () => {
    h.allowed = true;
    expect(renderToStaticMarkup(<ShareMyListButton kind="likes" />)).toContain("common:shareMyFavorites");
    expect(renderToStaticMarkup(<MirrorShareButton kind="watchlist" />)).toContain("shareMyList");
  });
});
