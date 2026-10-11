import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TRAILER_GUIDE_STEPS, type TrailerGuideLinkContext } from "@tentacle-tv/shared";

/**
 * L'étape « Mettre à jour » du guide des bandes-annonces : dans l'app Windows,
 * yt-dlp n'est pas « celui de l'image Docker ». `t()` rend la clé ; sans
 * administrateur, aucun lien (donc pas de routeur à monter).
 */
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const { GuideStep } = await import("./GuideStep");
const update = TRAILER_GUIDE_STEPS.find((step) => step.id === "update");
const ctx: TrailerGuideLinkContext = { isAdmin: false, jellyfinUrl: null, adminOrigin: null };

describe("l'étape « Mettre à jour » du guide", () => {
  it("l'app Windows : yt-dlp tenu à jour par l'app, pas par l'image", () => {
    if (!update) throw new Error("étape update absente");
    const out = renderToStaticMarkup(<GuideStep step={update} number={5} ctx={ctx} packaging="windows-app" />);
    expect(out).toContain("stepUpdateAppleTv_windowsApp");
    expect(out).toContain(">stepUpdateJellyfin12<");
  });

  it("un serveur qui ne dit rien de sa livraison : la phrase d'avant", () => {
    if (!update) throw new Error("étape update absente");
    const out = renderToStaticMarkup(<GuideStep step={update} number={5} ctx={ctx} />);
    expect(out).toContain(">stepUpdateAppleTv<");
    expect(out).not.toContain("_windowsApp");
  });
});
