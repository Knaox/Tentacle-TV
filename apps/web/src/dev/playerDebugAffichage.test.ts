import { beforeEach, describe, expect, it, vi } from "vitest";
import { sectionHdrNatif } from "./playerDebugAffichage";

// La plateforme est le seul aiguillage de ces sections : on la pilote. La
// lecture est différée (flèche) pour échapper au hissage de `vi.mock`.
let plateforme: "windows" | "macos" | "linux" | "web" = "linux";
vi.mock("../desktop/bridge", () => ({
  desktopPlatform: () => plateforme,
  invoke: () => Promise.resolve(null),
}));

// Un état complet : chaque champ optionnel est présent, pour que seule la
// PLATEFORME décide de ce qui s'affiche — c'est précisément ce qu'on garde.
const etat = {
  actif: true,
  bascule: false,
  supporte: false,
  autoAutorise: false,
  edrCapable: false,
  coucheHdr: true,
  espaceCouche: "contenu pq → sortie pq/bt.2020 · pic 3.81×",
  transmission: true,
  pic: 3.81,
};

const libelles = (): string[] => sectionHdrNatif(etat).lignes.map((l) => l[0]);

describe("sectionHdrNatif — filtrage par plateforme", () => {
  beforeEach(() => {
    plateforme = "linux";
  });

  it("Linux : « transmission HDR autorisée » a disparu — la préférence y est inerte", () => {
    // `target-colorspace-hint=yes` est posé sans condition par la coquille
    // (linux/optionsMpv.ts) : « non (touche H) » en rouge accusait un défaut
    // inexistant, comme jadis `edrCapable`.
    expect(libelles()).not.toContain("transmission HDR autorisée");
    expect(libelles()).toContain("sortie en HDR");
    expect(libelles()).toContain("sortie mpv");
    expect(libelles()).not.toContain("écran capable EDR");
    expect(libelles()).not.toContain("bascule d'écran");
  });

  it("macOS : la ligne reste — c'est LE réglage qui y compte", () => {
    plateforme = "macos";
    expect(libelles()).toContain("transmission HDR autorisée");
    expect(libelles()).toContain("couche Metal");
  });

  it("Windows : la ligne reste, avec la bascule d'écran", () => {
    plateforme = "windows";
    expect(libelles()).toContain("transmission HDR autorisée");
    expect(libelles()).toContain("bascule d'écran");
    expect(libelles()).toContain("écran en HDR");
  });
});
