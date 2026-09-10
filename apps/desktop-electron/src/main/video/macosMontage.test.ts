import { describe, expect, it } from "vitest";
import { decideMacosMontage } from "./macosMontage";

describe("decideMacosMontage", () => {
  it("un Mac Intel prend la vue GL — une fenêtre, OpenGL, pas de MoltenVK", () => {
    expect(decideMacosMontage("x64", {})).toBe("gl");
  });

  it("Apple Silicon garde la fenêtre de mpv — seul chemin HDR mesuré", () => {
    expect(decideMacosMontage("arm64", {})).toBe("fenetre");
  });

  it("le forçage de diagnostic marche dans les deux sens", () => {
    expect(decideMacosMontage("arm64", { TENTACLE_VIDEO_MONTAGE: "gl" })).toBe("gl");
    expect(decideMacosMontage("x64", { TENTACLE_VIDEO_MONTAGE: "fenetre" })).toBe("fenetre");
  });

  it("une valeur inconnue ne décide de rien : l'architecture tranche", () => {
    // Jamais un troisième comportement — au pire, celui de la machine.
    expect(decideMacosMontage("x64", { TENTACLE_VIDEO_MONTAGE: "metal" })).toBe("gl");
    expect(decideMacosMontage("arm64", { TENTACLE_VIDEO_MONTAGE: "" })).toBe("fenetre");
  });
});
