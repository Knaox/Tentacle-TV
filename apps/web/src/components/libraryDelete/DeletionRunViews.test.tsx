import { beforeAll, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { i18n, initI18n } from "@tentacle-tv/shared";

/**
 * Le bilan d'une suppression : ce qui est parti, puis NOMMÉMENT ce qui ne l'est
 * pas (« 3 titres n'ont pas pu être supprimés »), avec « Réessayer » pour ce qui
 * peut l'être — jamais un arrêt silencieux. Rendu avec les vraies traductions.
 */

vi.mock("react-i18next", () => ({
  initReactI18next: { type: "3rdParty", init: () => undefined },
  useTranslation: (ns: string | string[]) => ({ t: i18n.getFixedT(null, ns), i18n }),
}));

const { DeletionSummaryView, TitleList } = await import("./DeletionRunViews");

beforeAll(async () => {
  initI18n({ lng: "fr" });
  await i18n.changeLanguage("fr");
});

const NAMES: Record<string, string> = { a: "Alpha", b: "Bêta", c: "Gamma", d: "Delta", e: "Epsilon", f: "Zêta" };
const nameOf = (id: string) => NAMES[id] ?? id;

function summary(view: Parameters<typeof DeletionSummaryView>[0]["summary"]) {
  return renderToStaticMarkup(
    <DeletionSummaryView titleId="t" descId="d" summary={view} nameOf={nameOf} onRetry={() => undefined} onClose={() => undefined} />,
  );
}

describe("le bilan d'une suppression", () => {
  it("tout est parti : « Suppression terminée », sans « Réessayer »", () => {
    const html = summary({ removed: ["a", "b", "c"], gone: [], forbidden: [], failed: [], skipped: [] });
    expect(html).toContain("Suppression terminée");
    expect(html).toContain("3 titres supprimés.");
    expect(html).not.toContain("Réessayer");
  });

  it("refus et échecs partiels : comptés ET nommés, « Réessayer » pour les échecs", () => {
    const html = summary({ removed: ["a", "e"], gone: ["e"], forbidden: ["b", "c", "d"], failed: ["f"], skipped: [] });
    expect(html).toContain("Suppression incomplète");
    expect(html).toContain("1 titre supprimé.");
    expect(html).toContain("1 titre n&#x27;était déjà plus dans la bibliothèque.");
    expect(html).toContain("3 titres n&#x27;ont pas pu être supprimés : Jellyfin ne vous y autorise pas.");
    for (const name of ["Bêta", "Gamma", "Delta", "Zêta"]) expect(html).toContain(name);
    expect(html).toContain("1 titre n&#x27;a pas pu être supprimé : le serveur n&#x27;a pas répondu.");
    expect(html).toContain("Réessayer ces titres");
  });

  it("arrêtée en route : ce qui n'a pas été tenté est dit comme tel", () => {
    const html = summary({ removed: ["a"], gone: [], forbidden: [], failed: [], skipped: ["b", "c"] });
    expect(html).toContain("2 titres n&#x27;ont pas été traités : la suppression a été arrêtée.");
  });
});

describe("TitleList", () => {
  it("donne le type en clair et « et N autres »", () => {
    const html = renderToStaticMarkup(<TitleList items={[{ name: "Dark", type: "Series" }]} more={7} />);
    expect(html).toContain("Série");
    expect(html).toContain("et 7 autres");
  });
});
