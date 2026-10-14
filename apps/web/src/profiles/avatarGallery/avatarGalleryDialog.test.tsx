import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AVATAR_CHARACTERS } from "@tentacle-tv/shared";

/**
 * La galerie des photos de profil, rendue : « Importer une photo » en tête,
 * puis chaque personnage du catalogue, nommé ; rien de choisi à l'ouverture.
 * En invitation : son titre, « Nouveau », et « Pas maintenant ».
 */

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string, values?: Record<string, unknown>) => (values ? `${key}:${JSON.stringify(values)}` : key) }),
}));
vi.mock("../../contexts/ToastContext", () => ({ useToast: () => ({ show: () => undefined }) }));
vi.mock("./useAvatarTarget", () => ({
  ACCOUNT_TARGET: { kind: "account" },
  useAvatarTarget: () => ({ currentSrc: null, initial: "D", uploading: false, upload: async () => true }),
}));
// Le portail de la modale n'a pas cours dans un rendu serveur : son contenu, en place.
vi.mock("../../components/ui/Modal", () => ({ Modal: ({ children }: { children: ReactNode }) => <div role="dialog">{children}</div> }));

const { default: AvatarGalleryDialog } = await import("./AvatarGalleryDialog");

describe("la galerie des avatars", () => {
  it("l'import d'une photo en tête, puis toute la troupe, chacun par son nom", () => {
    const html = renderToStaticMarkup(<AvatarGalleryDialog open mode="change" onClose={() => undefined} />);
    const tiles = [...html.matchAll(/data-avatar-tile="([a-z]+)"/g)].map((match) => match[1]);
    expect(tiles[0]).toBe("upload");
    expect(tiles.slice(1)).toEqual(AVATAR_CHARACTERS.map((avatar) => avatar.id));
    for (const { id } of AVATAR_CHARACTERS) expect(html).toContain(`aria-label="characters.${id}.name"`);
    expect(html).toContain('type="file"');
  });

  it("rien n'est choisi à l'ouverture : le bouton principal attend, la photo actuelle se présente", () => {
    const html = renderToStaticMarkup(<AvatarGalleryDialog open mode="change" onClose={() => undefined} />);
    expect(html).not.toContain('aria-pressed="true"');
    expect(html).toContain("chooseIdle");
    expect(html).toContain("noPhoto");
    expect(html).toContain(">cancel<");
  });

  it("une seule tuile dans l'ordre de tabulation : le premier personnage", () => {
    const html = renderToStaticMarkup(<AvatarGalleryDialog open mode="change" onClose={() => undefined} />);
    const tabbable = [...html.matchAll(/data-avatar-tile="([a-z]+)"[^>]*tabindex="0"/g)].map((match) => match[1]);
    expect(tabbable).toEqual([AVATAR_CHARACTERS[0].id]);
  });

  it("en invitation : son titre, « Nouveau », le nombre de personnages et « Pas maintenant »", () => {
    const html = renderToStaticMarkup(<AvatarGalleryDialog open mode="invite" onClose={() => undefined} />);
    expect(html).toContain("invite.title");
    expect(html).toContain("invite.eyebrow");
    expect(html).toContain(`invite.subtitle:{&quot;count&quot;:${AVATAR_CHARACTERS.length}}`);
    expect(html).toContain(">notNow<");
  });
});
