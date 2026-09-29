import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { detectLanguage, i18n, initI18n } from "@tentacle-tv/shared";

/**
 * Premier affichage de la mention légale : rien n'est stocké, la langue vient
 * de la détection — comme au démarrage (`main.tsx`). Le texte ET la pastille
 * active doivent être dans cette langue, sans la moindre bascule. Avant, la
 * pastille lisait le stockage (vide → « EN ») pendant que le texte suivait
 * i18n : il fallait cliquer FR puis EN pour que tout s'accorde.
 */

vi.mock("../components/ui/TentacleLogo", () => ({ TentacleLogo: () => null }));
// react-i18next chargé en vrai tire une seconde copie de React : on garde le
// VRAI i18n (vraies traductions, vraie langue), branché sans son contexte.
// Pas d'import de shared dans la fabrique : shared importe react-i18next, les
// deux s'attendraient l'un l'autre.
vi.mock("react-i18next", () => ({
  initReactI18next: { type: "3rdParty", init: () => undefined },
  useTranslation: (ns: string) => ({ t: i18n.getFixedT(null, ns), i18n }),
}));

beforeAll(() => {
  initI18n();
});

afterEach(() => vi.unstubAllGlobals());

async function firstRender(browserLanguage: string): Promise<string> {
  vi.stubGlobal("navigator", { language: browserLanguage });
  vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => undefined });
  const lng = localStorage.getItem("tentacle_language") ?? detectLanguage();
  await i18n.changeLanguage(lng);
  const { Disclaimer } = await import("./Disclaimer");
  return renderToStaticMarkup(<Disclaimer onAccepted={() => undefined} />);
}

function activePill(html: string): string | undefined {
  return /<button[^>]*lang="(fr|en)"[^>]*aria-pressed="true"/.exec(html)?.[1];
}

describe("Disclaimer — premier affichage", () => {
  it("en anglais sur un appareil anglais", async () => {
    const html = await firstRender("en-US");
    expect(html).toContain("Legal Notice");
    expect(html).not.toContain("Mention légale");
    expect(activePill(html)).toBe("en");
  });

  it("en français sur un appareil français", async () => {
    const html = await firstRender("fr-FR");
    expect(html).toContain("Mention légale");
    expect(html).not.toContain("Legal Notice");
    expect(activePill(html)).toBe("fr");
  });
});
