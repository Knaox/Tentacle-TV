import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * L'en-tête de la page Profil d'une fenêtre ÉTROITE du bureau : en session
 * personnelle, la photo du compte se change (la galerie des avatars, qui porte
 * aussi l'import d'une photo) ; pendant la session d'un profil,
 * rien à changer (le serveur le refuse) — son rond, son nom, ce qu'il est.
 */

const state = vi.hoisted(() => ({
  profile: null as null | { id: string; name: string; kind: string; color: string; imageTag: null; hasPin: boolean },
  face: null as null | string,
  guestTarget: null as null | { kind: "guest"; userId: string; name: string; imageTag: null; through: "personal" },
}));

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("../../contexts/ToastContext", () => ({ useToast: () => ({ show: () => undefined }) }));
vi.mock("../../hooks/useAvatarUpload", () => ({
  useAvatarUpload: () => ({ avatarSrc: null, onAvatarError: () => undefined, avatarVersion: 0, uploading: false, upload: async () => true, userId: "owner" }),
}));
vi.mock("../../auth/profileSession", () => ({ useActiveProfile: () => state.profile }));
vi.mock("../../family/FamilyAvatar", () => ({ FamilyAvatar: ({ name }: { name: string }) => <span data-avatar={name} /> }));
vi.mock("../../profiles/face/useAccountFaceColor", () => ({ useAccountFaceColor: () => state.face }));
vi.mock("../../profiles/avatarGallery/useGuestSessionPhoto", () => ({ useGuestSessionPhoto: () => state.guestTarget }));

const { ProfileHero } = await import("./ProfileHero");

describe("l'en-tête de la page Profil, fenêtre étroite", () => {
  beforeEach(() => {
    state.profile = null;
    state.face = null;
    state.guestTarget = null;
  });

  it("en session personnelle : « Changer la photo », qui ouvre la galerie (rien de chargé avant)", () => {
    const html = renderToStaticMarkup(<ProfileHero name="Damien" initial="D" isAdmin={false} />);
    expect(html).toContain('aria-label="changePhoto"');
    expect(html).not.toContain('role="dialog"');
  });

  it("en session personnelle dans une famille : le rond à la couleur de son profil", () => {
    state.face = "orange";
    const html = renderToStaticMarkup(<ProfileHero name="Banc" initial="B" isAdmin={false} />);
    expect(html).toContain("#c2410c");
    expect(html).not.toContain("var(--brand-dark)");
  });

  it("sans famille : le dégradé de marque, comme avant", () => {
    const html = renderToStaticMarkup(<ProfileHero name="Damien" initial="D" isAdmin={false} />);
    expect(html).toContain("var(--brand-dark)");
  });

  it("pendant la session d'un invité : ni photo à changer, ni fichier — son nom et « Profil invité »", () => {
    state.profile = { id: "lea", name: "Léa", kind: "guest", color: "pink", imageTag: null, hasPin: false };
    const html = renderToStaticMarkup(<ProfileHero name="Léa" initial="L" isAdmin={false} />);
    expect(html).not.toContain("changePhoto");
    expect(html).not.toContain('type="file"');
    expect(html).toContain('data-avatar="Léa"');
    expect(html).toContain("session.guestBadge");
  });

  it("pendant la session d'un invité que l'appareil habille (serveur 1.30.0) : son rond change sa photo", () => {
    state.profile = { id: "lili", name: "Lili", kind: "guest", color: "pink", imageTag: null, hasPin: false };
    state.guestTarget = { kind: "guest", userId: "lili", name: "Lili", imageTag: null, through: "personal" };
    const html = renderToStaticMarkup(<ProfileHero name="Lili" initial="L" isAdmin={false} />);
    expect(html).toContain('aria-label="profile:changePhoto"');
    expect(html).toContain("session.guestBadge");
  });

  it("pendant la session d'un membre : « Profil de la famille »", () => {
    state.profile = { id: "zoe", name: "Zoé", kind: "member", color: "teal", imageTag: null, hasPin: true };
    const html = renderToStaticMarkup(<ProfileHero name="Zoé" initial="Z" isAdmin={false} />);
    expect(html).toContain("session.memberBadge");
    expect(html).not.toContain("changePhoto");
  });
});
