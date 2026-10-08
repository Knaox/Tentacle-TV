import { describe, expect, it } from "vitest";
import { SETUP_DOC_PATHS, setupDocUrl } from "./setupDocLinks";
import { setupFlowSteps } from "./setupFlowContract";

describe("liens de doc de l'assistant", () => {
  it("chaque écran des deux parcours a sa page — sauf la clé TMDB, qui n'en a pas encore", () => {
    const shape = { needsCode: true, asksTmdb: true } as const;
    const steps = new Set([...setupFlowSteps({ ...shape, path: "fresh" }), ...setupFlowSteps({ ...shape, path: "configured", noLibraries: true })]);
    expect(steps.has("tmdb")).toBe(true);
    for (const step of steps) {
      if (step === "tmdb") expect(SETUP_DOC_PATHS).not.toHaveProperty("tmdb");
      else expect(SETUP_DOC_PATHS[step]).toMatch(/^[a-z-]+\/(#[a-z-]+)?$/);
    }
  });

  it("la langue de l'interface, l'ancre après la requête", () => {
    expect(setupDocUrl("jellyfin", "fr-FR")).toBe("https://tentacletv.app/docs/server/choose-jellyfin/?lang=fr");
    expect(setupDocUrl("signIn", "en")).toBe("https://tentacletv.app/docs/server/account/?lang=en#sign-in");
    expect(setupDocUrl("home", "de")).toBe("https://tentacletv.app/docs/server/?lang=en");
  });

  it("des adresses publiées : elles ne changent plus", () => {
    // Le site (dépôt à part) les tient ; en changer une casse les liens des serveurs livrés.
    expect(SETUP_DOC_PATHS).toMatchObject({
      welcome: "setup-code/",
      libraries: "libraries/",
      librariesExistingEmpty: "libraries/#existing-jellyfin-without-libraries",
      remote: "remote-access/",
      addContent: "add-content/",
      disableWebUi: "install/#disable-web-ui",
      // La page que le site publie pour la 1.25 : l'administration y renvoie.
      sqliteMigration: "sqlite-migration/",
    });
  });
});
