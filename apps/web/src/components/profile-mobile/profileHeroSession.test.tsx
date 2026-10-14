import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * L'en-tête de la page Profil d'une fenêtre ÉTROITE du bureau : en session
 * personnelle, la photo du compte se change ; pendant la session d'un profil,
 * rien à changer (le serveur le refuse) — son rond, son nom, ce qu'il est.
 */

const state = vi.hoisted(() => ({ profile: null as null | { id: string; name: string; kind: string; color: string; imageTag: null; hasPin: boolean } }));

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("../../contexts/ToastContext", () => ({ useToast: () => ({ show: () => undefined }) }));
vi.mock("../../hooks/useAvatarUpload", () => ({
  useAvatarUpload: () => ({ avatarSrc: null, onAvatarError: () => undefined, avatarVersion: 0, uploading: false, upload: async () => true, userId: "owner" }),
}));
vi.mock("../../auth/profileSession", () => ({ useActiveProfile: () => state.profile }));
vi.mock("../../family/FamilyAvatar", () => ({ FamilyAvatar: ({ name }: { name: string }) => <span data-avatar={name} /> }));

const { ProfileHero } = await import("./ProfileHero");

describe("l'en-tête de la page Profil, fenêtre étroite", () => {
  beforeEach(() => {
    state.profile = null;
  });

  it("en session personnelle : « Changer la photo », et le sélecteur de fichier", () => {
    const html = renderToStaticMarkup(<ProfileHero name="Damien" initial="D" isAdmin={false} />);
    expect(html).toContain('aria-label="changePhoto"');
    expect(html).toContain('type="file"');
  });

  it("pendant la session d'un invité : ni photo à changer, ni fichier — son nom et « Profil invité »", () => {
    state.profile = { id: "lea", name: "Léa", kind: "guest", color: "pink", imageTag: null, hasPin: false };
    const html = renderToStaticMarkup(<ProfileHero name="Léa" initial="L" isAdmin={false} />);
    expect(html).not.toContain("changePhoto");
    expect(html).not.toContain('type="file"');
    expect(html).toContain('data-avatar="Léa"');
    expect(html).toContain("session.guestBadge");
  });

  it("pendant la session d'un membre : « Profil de la famille »", () => {
    state.profile = { id: "zoe", name: "Zoé", kind: "member", color: "teal", imageTag: null, hasPin: true };
    const html = renderToStaticMarkup(<ProfileHero name="Zoé" initial="Z" isAdmin={false} />);
    expect(html).toContain("session.memberBadge");
    expect(html).not.toContain("changePhoto");
  });
});
