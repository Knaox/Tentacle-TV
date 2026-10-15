import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * Le corps du menu de l'avatar tel qu'il s'écrit : les familles pleines
 * (moi, cet appareil) nommées pour les lecteurs d'écran, puis le pied —
 * « Aide », « À propos » discrets, « Déconnexion » au bout — et toutes les
 * entrées dans l'ordre de lecture, celui que suivent les flèches.
 */

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const { UserMenuGroups } = await import("./UserMenuGroups");
const { buildUserMenuGroups } = await import("./menuItems");

const base = { t: (k: string) => k, isAdmin: true, navigate: () => undefined, handleLogout: () => undefined };

function render(opts: Partial<Parameters<typeof buildUserMenuGroups>[0]> = {}): string {
  return renderToStaticMarkup(<UserMenuGroups groups={buildUserMenuGroups({ ...base, onDevice: true, goOffline: () => undefined, ...opts })} />);
}

/** Les libellés des `menuitem`, dans l'ordre du document. */
function menuOrder(html: string): string[] {
  return [...html.matchAll(/role="menuitem"[^>]*>(?:<span[^>]*>.*?<\/span>)?([^<]+)</g)].map((match) => match[1]);
}

describe("UserMenuGroups", () => {
  it("toutes les entrées, dans l'ordre des familles, la déconnexion en dernier", () => {
    expect(menuOrder(render())).toEqual(["stats", "preferences", "admin", "onDevice", "goOffline", "pairDevice", "help", "about", "logout"]);
  });

  it("chaque famille porte son nom pour les lecteurs d'écran", () => {
    const html = render();
    expect(html).toContain('role="group" aria-label="menuGroupAccount"');
    expect(html).toContain('role="group" aria-label="menuGroupDevice"');
    expect(html).toContain('role="group" aria-label="menuGroupSupport"');
  });

  it("la déconnexion seule est en rouge", () => {
    const html = render();
    expect(html.match(/status-error-fg/g)).toHaveLength(1);
    expect(html.indexOf("status-error-fg")).toBeGreaterThan(html.indexOf(">about<"));
  });

  it("session d'un profil : ni famille de l'appareil, ni déconnexion — le pied garde l'aide", () => {
    const html = render({ profileSession: { guest: false } });
    expect(html).not.toContain("menuGroupDevice");
    expect(html).not.toContain("status-error-fg");
    expect(menuOrder(html)).toEqual(["stats", "preferences", "help", "about"]);
  });

  it("hors ligne : paramètres, à propos, déconnexion", () => {
    expect(menuOrder(render({ offline: true, goOffline: undefined }))).toEqual(["preferences", "about", "logout"]);
  });
});
