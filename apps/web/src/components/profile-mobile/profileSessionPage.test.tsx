import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * La page Profil d'une fenêtre ÉTROITE du bureau (`/profile`, barre d'onglets
 * du bas) pendant la session d'un profil : la même règle que le menu de
 * l'avatar — ni déconnexion du compte, ni changement de serveur, ni
 * jumelage, ni Aide pour un invité. En session personnelle, rien ne change.
 */

const state = vi.hoisted(() => ({
  profile: null as null | { id: string; kind: string },
  switchItems: [] as { key: string; label: string; icon: null; action: () => void }[],
}));

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("react-router-dom", () => ({ useNavigate: () => () => undefined }));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ clear: () => undefined }) }));
vi.mock("@tentacle-tv/api-client", () => ({
  useAuth: () => ({ logout: { mutate: () => undefined } }),
  // Un serveur qui ne dit rien des droits de la session : les règles d'avant suffisent.
  useAccountAbilities: () => ({ kind: "legacy" }),
  mayShow: (_state: unknown, _ability: string, legacy = true) => legacy,
}));
vi.mock("../../desktop/bridge", () => ({ isDesktopApp: () => true }));
vi.mock("../../auth/profileSession", () => ({
  useActiveProfile: () => state.profile,
  PROFILE_SESSION_STORAGE_KEYS: ["tentacle_profile_session", "tentacle_account_session"],
}));

vi.mock("../../profiles/switcher/useProfileMenuItems", () => ({ useProfileMenuItems: () => state.switchItems }));

const { AccountActions } = await import("./AccountActions");
const { ProfileLinks } = await import("./ProfileLinks");

function page(): string {
  return renderToStaticMarkup(
    <div>
      <ProfileLinks isAdmin={false} />
      <AccountActions />
    </div>,
  );
}

describe("la page Profil d'une fenêtre étroite", () => {
  beforeEach(() => {
    state.profile = null;
    state.switchItems = [];
  });

  it("bureau, famille : « Changer de profil » en tête, dans son propre bloc ; sinon rien de plus", () => {
    expect(page()).not.toContain("switcher.title");
    state.switchItems = [{ key: "switchProfile", label: "switcher.title", icon: null, action: () => undefined }];
    const html = page();
    expect(html).toContain("switcher.title");
    expect(html.indexOf("switcher.title")).toBeLessThan(html.indexOf("stats"));
    expect(html.indexOf("switcher.title")).toBeLessThan(html.indexOf("<section"));
  });

  it("en session personnelle : jumelage, aide, changement de serveur et déconnexion", () => {
    const html = page();
    expect(html).toContain("pairDevice");
    expect(html).toContain("help");
    expect(html).toContain("changeServer");
    expect(html).toContain("logout");
  });

  it("pendant le profil d'un invité : rien de ce que le serveur lui refuse, ni la sortie du compte", () => {
    state.profile = { id: "lea", kind: "guest" };
    const html = page();
    expect(html).not.toContain("pairDevice");
    expect(html).not.toContain(">help<");
    expect(html).not.toContain("changeServer");
    expect(html).not.toContain("logout");
    // Vider le cache reste (il garde la session du profil et la réserve du compte).
    expect(html).toContain("clearCache");
  });

  it("pendant le profil d'un membre : l'Aide reste", () => {
    state.profile = { id: "zoe", kind: "member" };
    const html = page();
    expect(html).toContain(">help<");
    expect(html).not.toContain("pairDevice");
    expect(html).not.toContain("logout");
  });
});
