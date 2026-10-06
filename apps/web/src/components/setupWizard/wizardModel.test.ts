import { describe, expect, it } from "vitest";
import type { SetupContext } from "@tentacle-tv/shared";
import { codeFromHash, defaultLibraries, defaultLocale, hostMediaPaths, isValidLibraryName, needsDatabase, resumeStep, uiCultureOf, wizardSteps } from "./wizardModel";

function ctx(over: Partial<SetupContext> = {}): SetupContext {
  return {
    deployment: "docker",
    stack: "full",
    provisioner: "docker-sibling",
    database: { configured: true, connected: true, fromEnv: true },
    jellyfin: { url: null, suggestedUrl: "http://jellyfin:8096", configured: false, claimed: true },
    mediaHostPath: "./media",
    mediaFolders: { root: "/media", movies: "/media/films", tvshows: "/media/series" },
    os: null,
    missingJellyfin: { kind: "compose", stack: "tentacle-full", docsUrl: "https://tentacletv.app/install/" },
    secure: false,
    ...over,
  };
}

describe("les étapes de l'assistant", () => {
  it("pile complète, Jellyfin vierge : ni base ni compte final", () => {
    expect(wizardSteps({ needsDatabase: false, mode: "initialize", askFinalAccount: false })).toEqual([
      "welcome", "code", "jellyfin", "account", "locale", "libraries", "recap", "apply", "remote", "done",
    ]);
  });

  it("pile seule et clé collée : la base, puis le compte demandé à la fin", () => {
    const steps = wizardSteps({ needsDatabase: true, mode: "key", askFinalAccount: false });
    expect(steps.slice(0, 4)).toEqual(["welcome", "code", "database", "jellyfin"]);
    expect(steps.indexOf("finalAccount")).toBe(steps.indexOf("recap") - 1);
  });

  it("la base n'est demandée que si l'environnement ne la donne pas", () => {
    expect(needsDatabase(ctx())).toBe(false);
    expect(needsDatabase(ctx({ database: { configured: false, connected: false, fromEnv: false } }))).toBe(true);
    expect(needsDatabase(null)).toBe(false);
  });

  it("reprise : là où l'installation s'était arrêtée", () => {
    expect(resumeStep(ctx({ database: { configured: false, connected: false, fromEnv: false } }))).toBe("database");
    expect(resumeStep(ctx())).toBe("jellyfin");
    // Le voisin verrouillé au démarrage a déjà la clé, mais attend le compte : on passe par Jellyfin.
    expect(resumeStep(ctx({ jellyfin: { url: "http://jellyfin:8096", suggestedUrl: null, configured: true, claimed: true } }))).toBe("jellyfin");
    expect(resumeStep(ctx({ jellyfin: { url: "http://jellyfin:8096", suggestedUrl: null, configured: true, claimed: false } }))).toBe("libraries");
  });
});

describe("ce qui est proposé d'office", () => {
  it("la langue et le pays du navigateur, sinon l'anglais des États-Unis", () => {
    expect(defaultLocale("fr-CH")).toEqual({ language: "fr", country: "CH" });
    expect(defaultLocale("fr")).toEqual({ language: "fr", country: "FR" });
    expect(defaultLocale("ja-JP")).toEqual({ language: "en", country: "US" });
    expect(defaultLocale(undefined)).toEqual({ language: "en", country: "US" });
    expect(uiCultureOf("pt")).toBe("pt-PT");
  });

  it("Films et Séries de la pile complète, sauf ceux qui existent déjà", () => {
    const names = { movies: "Films", tvshows: "Séries" };
    expect(defaultLibraries(ctx(), [], names).map((l) => l.paths[0])).toEqual(["/media/films", "/media/series"]);
    expect(defaultLibraries(ctx(), [{ name: "Films", type: "movies", paths: ["/media/films"] }], names).map((l) => l.name)).toEqual(["Séries"]);
    expect(defaultLibraries(ctx({ mediaFolders: null }), [], names)).toEqual([]);
  });

  it("les chemins de l'hôte où déposer les médias", () => {
    expect(hostMediaPaths(ctx())).toEqual(["./media/films", "./media/series"]);
    expect(hostMediaPaths(ctx({ mediaHostPath: "/srv/media/" }))).toEqual(["/srv/media/films", "/srv/media/series"]);
    expect(hostMediaPaths(ctx({ mediaHostPath: null }))).toEqual([]);
  });

  it("un nom de bibliothèque que Jellyfin accepte", () => {
    expect(isValidLibraryName("Films 4K")).toBe(true);
    expect(isValidLibraryName(" Films")).toBe(false);
    expect(isValidLibraryName("Films/Séries")).toBe(false);
    expect(isValidLibraryName("")).toBe(false);
  });

  it("le code repris du lien des journaux", () => {
    expect(codeFromHash("#code=2yk6-bxz1-d0d4")).toBe("2YK6-BXZ1-D0D4");
    expect(codeFromHash("#autre=1&code=2YK6BXZ1D0D4")).toBe("2YK6BXZ1D0D4");
    expect(codeFromHash("#rien")).toBeNull();
  });
});
