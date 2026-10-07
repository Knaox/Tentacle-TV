import { describe, expect, it } from "vitest";
import type { SetupContext } from "@tentacle-tv/shared";
import { codeFromHash, createsLibraries, defaultLibraries, defaultLocale, hostMediaPaths, isValidLibraryName, needsDatabase, plansMissingFolder, resumeStep, showsChosenServer, uiCultureOf, wizardLength, wizardSteps } from "./wizardModel";

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
    flow: { databasePending: false, selection: null, linked: false },
    secure: false,
    ...over,
  };
}

const selection = (path: "fresh" | "configured", inStack = true) => ({
  url: inStack ? "http://jellyfin:8096" : "http://192.168.1.20:8096", serverId: "id", serverName: "Salon", version: "10.11.11", inStack, path,
});
const withFlow = (flow: SetupContext["flow"], over: Partial<SetupContext> = {}) => ctx({ ...over, flow });

describe("les étapes de l'assistant (le parcours du serveur)", () => {
  it("rien de choisi : jusqu'au choix du Jellyfin, jamais au-delà — et le total déjà juste", () => {
    expect(wizardSteps({ needsCode: false, context: ctx() })).toEqual(["welcome", "jellyfin"]);
    expect(wizardLength({ needsCode: false, context: ctx() })).toBe(8);
    expect(wizardLength({ needsCode: true, context: ctx() })).toBe(9);
  });

  it("Jellyfin NEUF : compte créé, puis bibliothèques", () => {
    const context = withFlow({ databasePending: false, selection: selection("fresh"), linked: false });
    expect(wizardSteps({ needsCode: false, context })).toEqual(["welcome", "jellyfin", "account", "libraries", "recap", "apply", "remote", "done"]);
  });

  it("Jellyfin DÉJÀ configuré : connexion, puis réglages conseillés — ni compte créé ni bibliothèques", () => {
    const context = withFlow({ databasePending: false, selection: selection("configured", false), linked: true });
    const steps = wizardSteps({ needsCode: true, context });
    expect(steps).toEqual(["welcome", "code", "jellyfin", "signIn", "recommended", "recap", "apply", "remote", "done"]);
    expect(steps).toHaveLength(wizardLength({ needsCode: true, context }));
  });

  it("la base a son écran quand l'environnement ne la donne pas, même une fois reliée", () => {
    const db = { configured: true, connected: true, fromEnv: false };
    expect(wizardSteps({ needsCode: false, context: ctx({ database: db }) })).toEqual(["welcome", "database", "jellyfin"]);
    expect(needsDatabase(ctx({ database: db }))).toBe(false);
    expect(needsDatabase(ctx({ database: { configured: false, connected: false, fromEnv: false } }))).toBe(true);
    expect(needsDatabase(null)).toBe(false);
  });

  it("reprise : là où en est le SERVEUR — un Jellyfin resté enregistré ne saute jamais le choix", () => {
    expect(resumeStep(withFlow({ databasePending: true, selection: null, linked: false }), false)).toBe("database");
    // Le cas vécu : un Jellyfin relié par un essai d'avant, aucun choix fait dans CETTE installation.
    const leftover = withFlow({ databasePending: false, selection: null, linked: false }, {
      jellyfin: { url: "http://jellyfin:8096", suggestedUrl: "http://jellyfin:8096", configured: true, claimed: false, joined: false, clientUrl: null },
    });
    expect(resumeStep(leftover, false)).toBe("jellyfin");
    expect(resumeStep(withFlow({ databasePending: false, selection: selection("fresh"), linked: false }), false)).toBe("account");
    expect(resumeStep(withFlow({ databasePending: false, selection: selection("configured"), linked: false }), false)).toBe("signIn");
    // Relié, mais le mot de passe n'est plus en mémoire : le premier écran du parcours le redemande.
    expect(resumeStep(withFlow({ databasePending: false, selection: selection("fresh"), linked: true }), false)).toBe("account");
    expect(resumeStep(withFlow({ databasePending: false, selection: selection("configured"), linked: true }), true)).toBe("recommended");
  });

  it("Jellyfin déjà configuré trouvé SANS bibliothèque : ses bibliothèques, facultatives, entre la connexion et les réglages", () => {
    const context = withFlow({ databasePending: false, selection: { ...selection("configured"), noLibraries: true }, linked: true, noLibraries: true });
    const steps = wizardSteps({ needsCode: false, context });
    expect(steps).toEqual(["welcome", "jellyfin", "signIn", "libraries", "recommended", "recap", "apply", "remote", "done"]);
    expect(wizardLength({ needsCode: false, context })).toBe(9);
    expect(resumeStep(context, true)).toBe("libraries");
    expect(createsLibraries(context)).toBe(true);
    expect(showsChosenServer("libraries", "configured", true)).toBe(true);
    // Avec des bibliothèques, rien ne change : on n'en crée pas.
    expect(createsLibraries(withFlow({ databasePending: false, selection: selection("configured"), linked: true, noLibraries: false }))).toBe(false);
  });

  it("le Jellyfin choisi n'est rappelé que sur les écrans de son parcours", () => {
    expect(showsChosenServer("signIn", "configured")).toBe(true);
    expect(showsChosenServer("recap", "fresh")).toBe(true);
    expect(showsChosenServer("jellyfin", "fresh")).toBe(false);
    expect(showsChosenServer("libraries", "configured")).toBe(false);
    expect(showsChosenServer("done", "fresh")).toBe(false);
    expect(showsChosenServer("recap", null)).toBe(false);
  });

  it("un AUTRE Jellyfin que celui de la pile ne se voit pas proposer les dossiers de la pile : à lui de choisir les siens", () => {
    const full = ctx({ provisioner: "docker-sibling", mediaFolders: { root: "/media", movies: "/media/films", tvshows: "/media/series" } });
    const names = { movies: "Films", tvshows: "Séries" };
    expect(defaultLibraries(full, [], names)).toHaveLength(2);
    const other = defaultLibraries(full, [], names, false);
    expect(other).toEqual([{ name: "Films", type: "movies", paths: [] }, { name: "Séries", type: "tvshows", paths: [] }]);
    expect(plansMissingFolder(other).map((plan) => plan.name)).toEqual(["Films", "Séries"]);
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
    expect(defaultLibraries(ctx({ mediaFolders: null }), [], names).map((l) => l.paths)).toEqual([[], []]);
    expect(defaultLibraries(ctx({ mediaFolders: null }), [{ name: "films", type: "movies", paths: ["/x"] }], names).map((l) => l.name)).toEqual(["Séries"]);
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

describe("la clé TMDB (écran facultatif, déclaré par le serveur)", () => {
  const tmdb = { configured: false, source: null, last4: null, later: false };

  it("dans les deux parcours, juste avant le récapitulatif — et compté dès l'accueil", () => {
    const fresh = withFlow({ databasePending: false, selection: selection("fresh"), linked: true, tmdb });
    expect(wizardSteps({ needsCode: false, context: fresh })).toEqual(["welcome", "jellyfin", "account", "libraries", "tmdb", "recap", "apply", "remote", "done"]);
    const configured = withFlow({ databasePending: false, selection: selection("configured", false), linked: true, tmdb });
    expect(wizardSteps({ needsCode: false, context: configured })).toEqual(["welcome", "jellyfin", "signIn", "recommended", "tmdb", "recap", "apply", "remote", "done"]);
    expect(wizardLength({ needsCode: false, context: withFlow({ databasePending: false, selection: null, linked: false, tmdb }) })).toBe(9);
  });

  it("un serveur d'avant l'écran ne le déclare pas : aucun écran TMDB", () => {
    const old = withFlow({ databasePending: false, selection: selection("fresh"), linked: true });
    expect(wizardSteps({ needsCode: false, context: old })).not.toContain("tmdb");
  });
});
