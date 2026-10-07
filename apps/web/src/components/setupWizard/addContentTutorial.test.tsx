import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

/** Le petit tuto de la fin : où déposer, le schéma en quatre temps, le temps de l'analyse, la relance, le guide. */
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key}${JSON.stringify(opts)}` : key), i18n: { language: "fr-FR" } }),
}));

const { AddContentTutorial } = await import("./AddContentTutorial");

describe("« Pour ajouter du contenu »", () => {
  it("le dossier SUR LE SERVEUR d'abord, celui de Jellyfin en rappel ; le schéma en quatre temps, dans l'ordre", () => {
    const html = renderToStaticMarkup(<AddContentTutorial folders={[{ name: "Films", type: "movies", path: "/media/films", hostPath: "/srv/medias/films" }]} />).replaceAll("&quot;", '"');
    expect(html).toContain("/srv/medias/films");
    expect(html).toContain('addSeenByJellyfin{"path":"/media/films"}');
    const order = ["addStep1", "addStep2", "addStep3", "addStep4"].map((key) => html.indexOf(`>${key}<`));
    expect(order.every((at, i) => at > 0 && (i === 0 || at > order[i - 1]))).toBe(true);
    expect(html.match(/<li/g)?.length).toBe(5);
    for (const key of ["addTiming", "addRescan", "addNaming"]) expect(html).toContain(key);
    expect(html).toContain("https://tentacletv.app/docs/server/add-content/?lang=fr");
  });

  it("aucun dossier connu : créer d'abord une bibliothèque dans Jellyfin", () => {
    const html = renderToStaticMarkup(<AddContentTutorial folders={[]} />);
    expect(html).toContain("addLeadNone");
    expect(html).not.toContain("add-content-folders");
  });
});
