import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import type { WtElsewhereDto } from "@tentacle-tv/shared";

/**
 * L'avis « Groupe en cours sur un autre appareil » (adhésion par appareil) :
 * rien tant que cet appareil est dans la salle ou qu'il n'y en a pas ; sinon
 * une pilule discrète qui nomme l'hôte et propose « Rejoindre ici ».
 */

const state = vi.hoisted(() => ({ elsewhere: null as WtElsewhereDto | null }));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string, opts?: Record<string, string>) => (opts?.name ? `${key}:${opts.name}` : key) }),
}));
// framer-motion résout sa propre copie de React (deux React : `useContext`
// nul au rendu) ; ses balises animées deviennent des balises nues.
vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children?: ReactNode }) => <>{children}</>,
  motion: { div: ({ children }: { children?: ReactNode }) => <div>{children}</div> },
}));
const location = vi.hoisted(() => ({ pathname: "/" }));
vi.mock("react-router-dom", () => ({ useLocation: () => location }));
vi.mock("../contexts/ToastContext", () => ({ useToast: () => ({ show: () => undefined }) }));
vi.mock("./WatchTogetherProvider", () => ({
  useWatchTogether: () => ({ elsewhere: state.elsewhere, selfId: "me", actions: { joinHere: async () => undefined } }),
}));

const { ElsewhereNotice } = await import("./ElsewhereNotice");

describe("ElsewhereNotice", () => {
  it("rien sans salle ailleurs", () => {
    state.elsewhere = null;
    expect(renderToStaticMarkup(<ElsewhereNotice />)).toBe("");
  });

  it("nomme l'hôte et propose de rejoindre ICI", () => {
    state.elsewhere = { groupId: "g", hostUsername: "Damien", itemId: "film", memberCount: 2, deviceCount: 2 };
    const html = renderToStaticMarkup(<ElsewhereNotice />);
    expect(html).toContain("elsewhereActiveWithHost:Damien");
    expect(html).toContain("elsewhereJoinHere");
    expect(html).toContain('aria-label="elsewhereDismiss"');
  });

  it("dit « Votre groupe… » quand l'hôte est ce compte (Q19)", () => {
    state.elsewhere = { groupId: "g", hostUsername: "Damien", hostUserId: "me", itemId: "film", memberCount: 2, deviceCount: 2 };
    const html = renderToStaticMarkup(<ElsewhereNotice />);
    expect(html).toContain("elsewhereActiveOwn");
    expect(html).not.toContain("elsewhereActiveWithHost");
  });

  it("jamais sur un lecteur : elle couvrirait la barre de lecture", () => {
    state.elsewhere = { groupId: "g", hostUsername: "Damien", itemId: "film", memberCount: 2, deviceCount: 2 };
    location.pathname = "/watch/autre";
    expect(renderToStaticMarkup(<ElsewhereNotice />)).toBe("");
    location.pathname = "/";
  });
});
