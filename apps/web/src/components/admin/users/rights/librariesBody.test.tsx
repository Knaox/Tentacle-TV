import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { UserRightsOptions } from "@tentacle-tv/shared";
import { PLAIN_RIGHTS } from "./rightsFixture";
import type { RightsWriter } from "./useRightsWriter";

/**
 * « Bibliothèques » : chaque case dit le TYPE de sa bibliothèque — les
 * bibliothèques de musique (celles d'Octave) s'y reconnaissent —, sans répéter
 * un type qui est déjà le nom. Rendu à plat : `t()` rend la clé, sauf les types.
 */
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => ({ "libraries.types.music": "Musique", "libraries.types.movies": "Films" })[key] ?? key }),
}));

const { LibrariesBody } = await import("./LibrariesBody");

const OPTIONS: UserRightsOptions = {
  libraries: [
    { id: "a", name: "Concerts", collectionType: "music" },
    { id: "b", name: "Musique", collectionType: "music" },
    { id: "c", name: "Cinéma", collectionType: "movies" },
    { id: "d", name: "Divers", collectionType: null },
  ],
  parentalRatings: [],
  unratedItemTypes: [],
  knownTags: [],
};
const WRITER: RightsWriter = {
  write: () => undefined,
  isPending: () => false,
  errorFor: () => null,
  confirming: null,
  confirm: () => undefined,
  cancel: () => undefined,
};

describe("Bibliothèques — le type de chaque bibliothèque", () => {
  it("musique reconnaissable, type jamais répété, rien d'inventé pour un type inconnu", () => {
    const html = renderToStaticMarkup(
      <LibrariesBody rights={{ ...PLAIN_RIGHTS, enableAllFolders: false }} options={OPTIONS} writer={WRITER} isSelf={false} />,
    );
    const details = [...html.matchAll(/<span class="shrink-0 text-xs text-content-tertiary">([^<]*)<\/span>/g)].map((match) => match[1]);
    expect(details).toEqual(["Musique", "Films"]);
    expect(html).toContain(">Concerts<");
    expect(html).toContain(">Divers<");
  });
});
