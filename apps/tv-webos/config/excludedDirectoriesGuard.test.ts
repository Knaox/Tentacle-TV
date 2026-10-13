import { existsSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { findExcludedModules } from "./excludedDirectoriesGuard";
import { EXCLUDED_WEB_DIRECTORIES } from "./substitutionTable";

const WIZARD = "/depot/apps/web/src/components/setupWizard";

describe("findExcludedModules", () => {
  it("trouve un module rangé sous un dossier exclu, à toute profondeur", () => {
    const ids = [`${WIZARD}/WizardFrame.tsx`, `${WIZARD}/screens/Account.tsx`];
    expect(findExcludedModules(ids, [WIZARD])).toEqual(ids);
  });

  it("épargne un voisin au nom prolongé, la porte substituée et son remplaçant", () => {
    const ids = [
      "/depot/apps/web/src/components/setupWizardOld/Frame.tsx",
      "/depot/apps/web/src/pages/ServerSetup.tsx",
      "/depot/apps/tv-webos/client/src/pages/serverSetupTv.ts",
    ];
    expect(findExcludedModules(ids, [WIZARD])).toEqual([]);
  });

  it("lit l'identifiant sans son suffixe de requête", () => {
    expect(findExcludedModules([`${WIZARD}/SetupWizard.tsx?used`], [WIZARD]))
      .toEqual([`${WIZARD}/SetupWizard.tsx`]);
  });

  it("accepte un dossier écrit avec sa barre finale", () => {
    expect(findExcludedModules([`${WIZARD}/QrCode.tsx`], [`${WIZARD}/`]))
      .toEqual([`${WIZARD}/QrCode.tsx`]);
  });
});

describe("EXCLUDED_WEB_DIRECTORIES", () => {
  it("ne désigne que des dossiers qui existent — renommé, il n'exclurait plus rien", () => {
    for (const directory of EXCLUDED_WEB_DIRECTORIES) {
      expect(existsSync(directory) && statSync(directory).isDirectory(), directory).toBe(true);
    }
  });
});
