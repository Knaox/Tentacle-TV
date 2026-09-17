/**
 * Le cache de nuanceurs : ce qui se garde, c'est que le dossier est le NÔTRE
 * et que l'option est posée — sans elle, libmpv (config=no) n'a aucun cache.
 */

import { describe, expect, it } from "vitest";
import { SHADER_CACHE_FOLDER, shaderCacheOptions, withShaderCache } from "./mpvShaderCache";

describe("le cache de nuanceurs", () => {
  it("rallume le cache dans un dossier de la coquille", () => {
    expect(shaderCacheOptions("/donnees")).toEqual({
      "gpu-shader-cache": "yes",
      "gpu-shader-cache-dir": `/donnees/${SHADER_CACHE_FOLDER}`,
    });
  });

  it("s'ajoute aux options de la page sans les toucher", () => {
    const page = { vo: "gpu-next", hwdec: "nvdec" };
    const all = withShaderCache(page, "/donnees");
    expect(all["vo"]).toBe("gpu-next");
    expect(all["hwdec"]).toBe("nvdec");
    expect(all["gpu-shader-cache"]).toBe("yes");
    expect(page).not.toHaveProperty("gpu-shader-cache");
  });
});
