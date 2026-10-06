import { describe, expect, it } from "vitest";
import type { SetupContext } from "@tentacle-tv/shared";
import { codeFromHash, defaultLibraries, defaultLocale, hostMediaPaths, isValidLibraryName, joinsConfigured, needsDatabase, resumeStep, uiCultureOf, wizardSteps } from "./wizardModel";

function ctx(over: Partial<SetupContext> = {}): SetupContext {
  return {
    deployment: "docker",
    stack: "full",
    provisioner: "docker-sibling",
    database: { configured: true, connected: true, fromEnv: true },
    jellyfin: { url: null, suggestedUrl: "http://jellyfin:8096", configured: false, claimed: true, joined: false, clientUrl: null },
    mediaHostPath: "./media",
    mediaFolders: { root: "/media", movies: "/media/films", tvshows: "/media/series" },
    os: null,
    missingJellyfin: { kind: "compose", stack: "tentacle-full", docsUrl: "https://tentacletv.app/install/" },
    secure: false,
    ...over,
  };
}

describe("les étapes de l'assistant", () => {
  it("pile complète ouverte du réseau local, Jellyfin vierge : ni code, ni base, ni compte final", () => {
    expect(wizardSteps({ needsCode: false, needsDatabase: false, mode: "initialize", joined: false, askFinalAccount: false })).toEqual([
      "welcome", "jellyfin", "account", "libraries", "recap", "apply", "remote", "done",
    ]);
  });

  it("le code n'est demandé qu'à qui n'arrive pas directement du réseau local", () => {
    expect(wizardSteps({ needsCode: true, needsDatabase: false, mode: "initialize", joined: false, askFinalAccount: false }).slice(0, 3)).toEqual(["welcome", "code", "jellyfin"]);
  });

  it("pile seule et clé collée : la base, puis le compte demandé à la fin", () => {
    const steps = wizardSteps({ needsCode: true, needsDatabase: true, mode: "key", joined: true, askFinalAccount: false });
    expect(steps.slice(0, 4)).toEqual(["welcome", "code", "database", "jellyfin"]);
    expect(steps.indexOf("finalAccount")).toBe(steps.indexOf("recap") - 1);
  });

  it("Jellyfin déjà configuré : les réglages conseillés à la place des bibliothèques", () => {
    const steps = wizardSteps({ needsCode: false, needsDatabase: false, mode: "connect", joined: true, askFinalAccount: false });
    expect(steps).toEqual(["welcome", "jellyfin", "account", "recommended", "recap", "apply", "remote", "done"]);
    expect(steps).not.toContain("libraries");
  });

  it("déjà configuré ou non : le serveur le dit une fois relié, le choix de l'écran Jellyfin avant", () => {
    expect(joinsConfigured(null, "connect")).toBe(true);
    expect(joinsConfigured(null, "initialize")).toBe(false);
    const linked = (joined: boolean, claimed = false) =>
      ctx({ jellyfin: { url: "http://jf", suggestedUrl: null, configured: true, claimed, joined, clientUrl: null } });
    expect(joinsConfigured(linked(true), null)).toBe(true);
    expect(joinsConfigured(linked(false), "connect")).toBe(false);
    // Le voisin verrouillé n'est pas encore le choix : on suit l'écran.
    expect(joinsConfigured(linked(false, true), "connect")).toBe(true);
    expect(resumeStep(linked(true))).toBe("recommended");
  });

  it("un AUTRE Jellyfin que celui de la pile ne se voit pas proposer les dossiers de la pile", () => {
    const full = ctx({ provisioner: "docker-sibling", mediaFolders: { root: "/media", movies: "/media/films", tvshows: "/media/series" } });
    const names = { movies: "Films", tvshows: "Séries" };
    expect(defaultLibraries(full, [], names)).toHaveLength(2);
    expect(defaultLibraries(full, [], names, false)).toEqual([]);
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
    expect(resumeStep(ctx({ jellyfin: { url: "http://jellyfin:8096", suggestedUrl: null, configured: true, claimed: true, joined: false, clientUrl: null } }))).toBe("jellyfin");
    expect(resumeStep(ctx({ jellyfin: { url: "http://jellyfin:8096", suggestedUrl: null, configured: true, claimed: false, joined: false, clientUrl: null } }))).toBe("libraries");
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
