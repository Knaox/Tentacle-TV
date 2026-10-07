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

describe("« Besoin d'aide ? »", async () => {
  const { SetupHelp } = await import("./SetupHelp");
  it("replié d'office : ses questions-réponses et la page du site de l'écran, dans la langue de l'interface", () => {
    const html = renderToStaticMarkup(<SetupHelp step="remote" noLibraries={false} />);
    expect(html).toMatch(/^<details(?![^>]*open)/);
    for (const key of ["helpToggle", "help_remote_needed_q", "help_remote_proxy_a", "help_remote_nothing_q"]) expect(html).toContain(key);
    expect(html).toContain("https://tentacletv.app/docs/server/remote-access/?lang=fr");
  });

  it("les bibliothèques d'un Jellyfin configuré vide : l'ancre de leur cas", () => {
    expect(renderToStaticMarkup(<SetupHelp step="libraries" noLibraries />)).toContain("libraries/?lang=fr#existing-jellyfin-without-libraries");
  });
});
