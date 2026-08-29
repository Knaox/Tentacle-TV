import { beforeEach, describe, expect, it, vi } from "vitest";
import { nativeHdrSection } from "./playerDebugDisplay";

// La plateforme est le seul aiguillage de ces sections : on la pilote. La
// lecture est différée (flèche) pour échapper au hissage de `vi.mock`.
let plateforme: "windows" | "macos" | "linux" | "web" = "linux";
vi.mock("../desktop/bridge", () => ({
  desktopPlatform: () => plateforme,
  invoke: () => Promise.resolve(null),
}));

// Un état complet : chaque champ optionnel est présent, pour que seule la
// PLATEFORME décide de ce qui s'affiche — c'est précisément ce qu'on garde.
const state = {
  enabled: true,
  bascule: false,
  supporte: false,
  autoAutorise: false,
  edrCapable: false,
  coucheHdr: true,
  espaceCouche: "contenu pq → sortie pq/bt.2020 · pic 3.81×",
  transmission: true,
  pic: 3.81,
};

const labels = (): string[] => nativeHdrSection(state).lines.map((l) => l[0]);

describe("sectionHdrNatif — filtrage par plateforme", () => {
  beforeEach(() => {
    plateforme = "linux";
  });

  it("Linux : « transmission HDR autorisée » a disparu — la préférence y est inerte", () => {
    // `target-colorspace-hint=yes` est posé sans condition par la coquille
    // (linux/optionsMpv.ts) : « non (touche H) » en rouge accusait un défaut
    // inexistant, comme jadis `edrCapable`.
    expect(labels()).not.toContain("transmission HDR autorisée");
    expect(labels()).toContain("sortie en HDR");
    expect(labels()).toContain("sortie mpv");
    expect(labels()).not.toContain("écran capable EDR");
    expect(labels()).not.toContain("bascule d'écran");
  });

  it("macOS : la ligne reste — c'est LE réglage qui y compte", () => {
    plateforme = "macos";
    expect(labels()).toContain("transmission HDR autorisée");
    expect(labels()).toContain("couche Metal");
  });

  it("Windows : la ligne reste, avec la bascule d'écran", () => {
    plateforme = "windows";
    expect(labels()).toContain("transmission HDR autorisée");
    expect(labels()).toContain("bascule d'écran");
    expect(labels()).toContain("écran en HDR");
  });
});
