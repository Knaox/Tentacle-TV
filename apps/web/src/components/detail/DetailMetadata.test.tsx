import { beforeAll, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { i18n, initI18n } from "@tentacle-tv/shared";
import type { MediaItem } from "@tentacle-tv/shared";
import { DetailMetadata } from "./DetailMetadata";

/**
 * Le nombre de saisons s'accorde : « 1 saison », « 3 saisons ». La ligne de
 * faits collait le nombre au mot pluriel (`common:seasons`) — « 1 saisons » sur
 * toute série d'une seule saison, jusque dans les visuels des stores.
 */

// Le VRAI i18n (vraies traductions, vraies règles de pluriel), branché sans le
// contexte de react-i18next — même montage que la mention légale.
vi.mock("react-i18next", () => ({
  initReactI18next: { type: "3rdParty", init: () => undefined },
  useTranslation: (ns: string | string[]) => ({ t: i18n.getFixedT(null, ns), i18n }),
}));
// framer-motion résout sa propre copie de React (deux React : `useContext`
// nul au rendu) ; ses balises animées deviennent des balises nues.
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    p: ({ children }: { children?: ReactNode }) => <p>{children}</p>,
  },
}));

beforeAll(() => {
  initI18n();
});

async function seasonsLine(lng: string, childCount: number): Promise<string> {
  await i18n.changeLanguage(lng);
  const item: MediaItem = { Id: "s1", Name: "Série", Type: "Series", ChildCount: childCount };
  return renderToStaticMarkup(<DetailMetadata item={item} linkGenres={false} />);
}

describe("DetailMetadata — nombre de saisons", () => {
  it("une saison seule reste au singulier", async () => {
    const html = await seasonsLine("fr", 1);
    expect(html).toContain(">1 saison<");
    expect(html).not.toContain("saisons");
  });

  it("le pluriel commence à deux", async () => {
    expect(await seasonsLine("fr", 3)).toContain(">3 saisons<");
  });

  it("l'anglais s'accorde de même", async () => {
    expect(await seasonsLine("en", 1)).toContain(">1 season<");
    expect(await seasonsLine("en", 2)).toContain(">2 seasons<");
  });

  it("aucune saison : rien n'est écrit", async () => {
    expect(await seasonsLine("fr", 0)).not.toContain("saison");
  });
});
