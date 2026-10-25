import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import type { UserRightsOptions } from "@tentacle-tv/shared";
import { PLAIN_RIGHTS } from "../rights/rightsFixture";
import type { RightsWriter } from "../rights/useRightsWriter";
import { musicLibrariesOf, musicLibraryAccess, octaveSummary } from "./octaveRightsModel";

/**
 * La rubrique « Musique · Octave » : la règle pure (bibliothèques de musique,
 * résumé), puis le rendu OUVERT face aux deux serveurs. Rendu à plat : `t()`
 * rend la clé.
 */
const h = vi.hoisted(() => ({ capability: true, access: true as boolean | undefined }));

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@tentacle-tv/api-client", () => ({
  useServerCapability: (key: string) => key === "octave.rights" && h.capability,
  useOctaveRights: () => ({ data: h.access === undefined ? undefined : { userId: "u-1", access: h.access }, isError: false }),
  useSetOctaveRights: () => ({ mutate: () => undefined, isPending: false, variables: undefined }),
}));
// Ouverte d'office : on juge son contenu.
vi.mock("../rights/RightsGroup", () => ({
  RightsGroup: ({ title, summary, children }: { title: string; summary: string; children: ReactNode }) => (
    <section data-title={title} data-summary={summary}>{children}</section>
  ),
}));

const { OctaveRightsGroup } = await import("./OctaveRightsGroup");

const MUSIC = "aaaa";
const MUSIC2 = "bbbb";
const OPTIONS: UserRightsOptions = {
  libraries: [
    { id: "ffff", name: "Films", collectionType: "movies" },
    { id: MUSIC, name: "Musique", collectionType: "music" },
    { id: MUSIC2, name: "Concerts", collectionType: "Music" },
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

const render = (rights = PLAIN_RIGHTS) =>
  renderToStaticMarkup(<OctaveRightsGroup userId="u-1" rights={rights} options={OPTIONS} writer={WRITER} />);

beforeEach(() => {
  h.capability = true;
  h.access = true;
});

describe("règle de la rubrique musique", () => {
  it("les bibliothèques de musique sont celles que Jellyfin range en « music »", () => {
    expect(musicLibrariesOf(OPTIONS).map((library) => library.id)).toEqual([MUSIC, MUSIC2]);
  });

  it("ce que le compte voit de la musique", () => {
    const libraries = musicLibrariesOf(OPTIONS);
    expect(musicLibraryAccess(PLAIN_RIGHTS, libraries)).toEqual({ mode: "all" });
    expect(musicLibraryAccess({ ...PLAIN_RIGHTS, enableAllFolders: false, enabledFolders: ["ffff", MUSIC] }, libraries))
      .toEqual({ mode: "some", count: 1, total: 2 });
    expect(musicLibraryAccess({ ...PLAIN_RIGHTS, enableAllFolders: false, enabledFolders: ["ffff"] }, libraries))
      .toEqual({ mode: "none", total: 2 });
  });

  it("le résumé : sans accès, une seule chose à dire ; sinon l'accès, la musique vue, le hors ligne", () => {
    const libraries = musicLibrariesOf(OPTIONS);
    expect(octaveSummary(false, PLAIN_RIGHTS, libraries).map((part) => part.key)).toEqual(["octave.summary.noAccess"]);
    expect(octaveSummary(true, PLAIN_RIGHTS, libraries).map((part) => part.key))
      .toEqual(["octave.summary.access", "octave.summary.allMusic", "octave.summary.offline"]);
    expect(octaveSummary(true, { ...PLAIN_RIGHTS, enableMediaPlayback: false, enableContentDownloading: false }, []).map((part) => part.key))
      .toEqual(["octave.summary.access", "octave.summary.noPlayback", "octave.summary.noMusicLibrary"]);
  });
});

describe("rubrique « Musique · Octave »", () => {
  it("serveur d'avant (sans `octave.rights`) : rien, la fiche d'avant", () => {
    h.capability = false;
    expect(render()).toBe("");
  });

  it("accès à Octave, hors ligne et conversion du son, nommés à la façon d'Octave", () => {
    const html = render();
    expect(html).toContain('data-title="octave.title"');
    expect(html).toContain("octave.access.label");
    expect(html).toContain("octave.access.hint");
    expect(html).toContain("octave.offline.label");
    expect(html).toContain("octave.convert.label");
    expect(html).toContain("octave.bitrateNone");
    // « Toutes les bibliothèques » : rien à cocher ici, cela se règle dans « Bibliothèques ».
    expect(html).toContain("octave.allLibraries");
    expect(html).not.toContain("octave.playbackOff");
  });

  it("bibliothèques choisies : une case par bibliothèque de MUSIQUE seulement", () => {
    const html = render({ ...PLAIN_RIGHTS, enableAllFolders: false, enabledFolders: [MUSIC] });
    expect(html).toContain(">Musique<");
    expect(html).toContain(">Concerts<");
    expect(html).not.toContain(">Films<");
    expect(html.match(/type="checkbox"/g)).toHaveLength(2);
    expect(html.match(/checked=""/g)).toHaveLength(1);
  });

  it("accès coupé : l'aide dit ce que le compte perd ; lecture coupée : un avertissement en mots", () => {
    h.access = false;
    const html = render({ ...PLAIN_RIGHTS, enableMediaPlayback: false, remoteClientBitrateLimit: 4_000_000 });
    expect(html).toContain("octave.access.hintOff");
    expect(html).toContain('data-summary="octave.summary.noAccess"');
    expect(html).toContain("octave.playbackOff");
    expect(html).toContain("octave.bitrate");
  });
});
