import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import type { OctaveProfileMenu } from "./octaveProfileMenu";

/**
 * Réglages d'Octave › « Profils » : les gestes du menu du profil, aux mêmes conditions (`octaveProfileMenu`) —
 * rien sans famille ; « Changer de profil » toujours, « Gérer les profils » là où « Qui regarde ? » l'offre.
 */

const h = vi.hoisted(() => ({ menu: null as OctaveProfileMenu | null }));

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("react-router-dom", () => ({ useNavigate: () => () => undefined }));
vi.mock("@tentacle-tv/ui", () => ({
  SettingsSection: ({ title, badge, children }: { title?: string; badge?: ReactNode; children: ReactNode }) => <section data-title={title}>{badge}{children}</section>,
}));
vi.mock("../../../components/userMenu/icons", () => ({ ManageProfilesIcon: () => null, SwitchProfileIcon: () => null }));
vi.mock("./OctaveProfileSheet", () => ({ OctaveProfileSheet: () => null }));
vi.mock("./shellIdentity", () => ({ shellIdentityOf: (menu: OctaveProfileMenu | null) => (menu?.current ? { name: menu.current.name, avatar: () => null } : null) }));
vi.mock("./useOctaveProfileMenu", () => ({ useOctaveProfileMenu: () => ({ menu: h.menu, activeProfileId: null, refetch: () => undefined }) }));

const { OctaveProfilesSettings } = await import("./OctaveProfilesSettings");

const lea = { userId: "lea", name: "Léa" } as OctaveProfileMenu["profiles"][number];

beforeEach(() => {
  h.menu = null;
});

describe("Réglages d'Octave › Profils", () => {
  it("sans famille de plusieurs profils (ou hors ligne) : rien", () => {
    expect(renderToStaticMarkup(<OctaveProfilesSettings />)).toBe("");
  });

  it("le profil actuel, « Changer de profil », et « Gérer » seulement là où il est offert", () => {
    h.menu = { current: lea, profiles: [lea], canManage: false };
    let html = renderToStaticMarkup(<OctaveProfilesSettings badge={<b data-scope="account" />} />);
    expect(html).toContain("Léa");
    expect(html).toContain("profile.switch");
    expect(html).not.toContain("profile.manage");
    expect(html).toContain('data-scope="account"');
    h.menu = { ...h.menu, canManage: true };
    html = renderToStaticMarkup(<OctaveProfilesSettings />);
    expect(html).toContain("profile.manage");
  });
});
