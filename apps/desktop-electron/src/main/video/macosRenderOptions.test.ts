import { describe, expect, it } from "vitest";
import { adaptForRenderApi } from "./macosRenderOptions";

/**
 * Aucun mock ici, et c'est une garde en soi : `macosRenderOptions.ts` ne doit
 * dépendre de rien de natif. Si ce fichier réclame un jour un `vi.mock` pour
 * seulement charger le module, une dépendance à `objc.ts` est revenue — et
 * c'est elle qu'il faut retirer, pas le test qu'il faut adapter.
 */

/** Ce qui ne s'applique qu'à une fenêtre que mpv n'a plus. */
const WINDOW_OPTIONS = [
  "gpu-api",
  "gpu-context",
  "border",
  "auto-window-resize",
  "force-window",
  "target-colorspace-hint",
  "input-cursor",
  "cursor-autohide",
] as const;

describe("adaptForRenderApi", () => {
  it("impose vo=libmpv, même quand la page demande gpu-next", () => {
    expect(adaptForRenderApi({ vo: "gpu-next" })["vo"]).toBe("libmpv");
  });

  it("retire tout ce qui parle d'une fenêtre que mpv n'a plus", () => {
    const asked = Object.fromEntries(WINDOW_OPTIONS.map((name) => [name, "yes"]));
    const output = adaptForRenderApi(asked);
    for (const name of WINDOW_OPTIONS) {
      expect(output, name).not.toHaveProperty(name);
    }
  });

  it("ne pose ni target-trc, ni target-prim, ni target-peak", () => {
    // Du PQ écrit dans une surface sRGB délave l'image sur tout écran sans
    // plage étendue — tous les Mac Intel. La vue est en plage standard : mpv
    // garde ses défauts, comme pour n'importe quel écran SDR.
    const output = adaptForRenderApi({ vo: "gpu-next", hwdec: "videotoolbox" });
    expect(output).not.toHaveProperty("target-trc");
    expect(output).not.toHaveProperty("target-prim");
    expect(output).not.toHaveProperty("target-peak");
  });

  it("laisse passer verbatim ce qui ne dépend pas du montage", () => {
    const output = adaptForRenderApi({
      hwdec: "videotoolbox,videotoolbox-copy",
      "cache-pause-initial": "yes",
      "demuxer-max-bytes": "512MiB",
    });
    expect(output["hwdec"]).toBe("videotoolbox,videotoolbox-copy");
    expect(output["cache-pause-initial"]).toBe("yes");
    expect(output["demuxer-max-bytes"]).toBe("512MiB");
  });

  it("rend une copie, jamais l'objet reçu", () => {
    const asked = { vo: "gpu-next" };
    const output = adaptForRenderApi(asked);
    expect(output).not.toBe(asked);
    expect(asked.vo).toBe("gpu-next");
  });
});
