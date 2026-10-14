/**
 * La porte du débogage du web : le drapeau du serveur ne vaut que dans un
 * navigateur, et seulement avec la valeur exacte qu'il écrit. Et le script
 * principal ne charge AUCUN outil de débogage sans elle : tout passe par un
 * import dynamique.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { WEB_DEBUG_ATTRIBUTE, webDebugAllowed } from "./webDebug";

const closed = { dev: false, instrumented: false, desktop: false, serverAttribute: null };

describe("porte du débogage du web", () => {
  it("fermée par défaut : build livré, aucun drapeau", () => {
    expect(webDebugAllowed(closed)).toBe(false);
  });

  it("ouverte par le drapeau du serveur, dans un navigateur", () => {
    expect(webDebugAllowed({ ...closed, serverAttribute: "on" })).toBe(true);
  });

  it("le drapeau du serveur n'ouvre rien dans la coquille de bureau", () => {
    expect(webDebugAllowed({ ...closed, desktop: true, serverAttribute: "on" })).toBe(false);
  });

  it("seule la valeur écrite par le serveur compte", () => {
    for (const value of ["", "1", "true", "off", "ON "]) {
      expect(webDebugAllowed({ ...closed, serverAttribute: value })).toBe(false);
    }
  });

  it("développement et build instrumenté l'ouvrent partout, bureau compris", () => {
    expect(webDebugAllowed({ ...closed, dev: true, desktop: true })).toBe(true);
    expect(webDebugAllowed({ ...closed, instrumented: true, desktop: true })).toBe(true);
  });

  it("le nom d'attribut est celui que le serveur écrit", () => {
    const backend = readFileSync(resolve(__dirname, "../../../backend/src/static/webDebug.ts"), "utf8");
    expect(backend).toContain(`"${WEB_DEBUG_ATTRIBUTE}"`);
  });
});

describe("aucun outil de débogage dans le script principal", () => {
  it("main.tsx n'importe rien de dev/ autrement qu'à la demande", () => {
    const main = readFileSync(resolve(__dirname, "../main.tsx"), "utf8");
    const staticImports = main.match(/^import[^;]*from\s+["'][^"']+["']/gm) ?? [];
    // Seuls restent les deux outils du SERVEUR DE DÉVELOPPEMENT (gardés par
    // `import.meta.env.DEV`, effacés de tout build) : ni panneau, ni sonde.
    expect(staticImports.filter((line) => line.includes("/dev/"))).toEqual([
      'import { installAnimationAudit } from "./dev/animationAudit"',
      'import { installLayoutShiftProbe } from "./dev/layoutShiftProbe"',
    ]);
    expect(main).toContain('import("./dev/webDebugBoot")');
    expect(main).toMatch(/isWebDebugEnabled\(\)\s*\?\s*import\("\.\/dev\/webDebugBoot"\)/);
  });
});
