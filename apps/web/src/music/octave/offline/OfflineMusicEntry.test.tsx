/**
 * L'accueil hors ligne sans films : la musique gardée y remplace « aucun
 * contenu » (recette de D8, défaut 1) ; sans musique, le message d'avant ; une
 * session de profil n'en voit rien.
 */

import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const h = vi.hoisted(() => ({ profile: null as unknown, tracks: [] as { status: string }[], native: true }));

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("react-router-dom", () => ({ useNavigate: () => () => undefined }));
vi.mock("../../../auth/profileSession", () => ({ useActiveProfile: () => h.profile }));
vi.mock("../../../desktop/capabilities", () => ({ supportsMusicOffline: () => h.native }));
vi.mock("./useKeptMusic", () => ({ useKeptMusic: () => ({ loaded: true, tracks: h.tracks }) }));

import { OfflineMusicOrEmpty } from "./OfflineMusicEntry";

const render = () => renderToStaticMarkup(<OfflineMusicOrEmpty fallback={<p>vide</p>} />);

describe("OfflineMusicOrEmpty", () => {
  it("de la musique gardée : la carte, sans « aucun contenu »", () => {
    h.tracks = [{ status: "complete" }];
    const html = render();
    expect(html).toContain("entry.title");
    expect(html).not.toContain("vide");
  });

  it("rien de gardé (ou rien de complet) : le message d'avant", () => {
    h.tracks = [{ status: "downloading" }];
    expect(render()).toBe("<p>vide</p>");
  });

  it("une session de profil, le web : le message d'avant", () => {
    h.tracks = [{ status: "complete" }];
    h.profile = { id: "p" };
    expect(render()).toBe("<p>vide</p>");
    h.profile = null;
    h.native = false;
    expect(render()).toBe("<p>vide</p>");
  });
});
