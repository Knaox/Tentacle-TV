import { describe, expect, it } from "vitest";

/**
 * Le résumé d'état de la page « Services » et la mise en forme de ce que le
 * serveur rend — y compris un serveur plus ancien, que l'application de
 * bureau peut très bien interroger.
 */

const { readServices, readAudioAnalysis, readPublicUrl, AdminApiError } = await import("./servicesModel");
const summary = await import("./serviceSummary");

/** Intl sépare nombre et unité par une espace insécable (fine en français) : on compare le texte. */
const plain = (value: string) => value.replace(/\s/g, " ");

const jellyfin = (patch: object) => readServices({ jellyfin: { status: "connected", url: "http://jf:8096", version: "10.10.7", ...patch } }).jellyfin;

describe("le résumé de Jellyfin", () => {
  it("connecté, avec sa version", () => {
    expect(summary.summarizeJellyfin(jellyfin({}), "ok")).toEqual({ tone: "success", label: "jellyfinConnected", detail: "Jellyfin 10.10.7" });
  });

  it("connecté mais la clé n'a plus ses droits : à revoir, pas « connecté »", () => {
    expect(summary.summarizeJellyfin(jellyfin({}), "sansDroits").label).toBe("jellyfinKeyToReview");
  });

  it("distingue la clé refusée, l'hôte muet et l'adresse qui n'est pas un Jellyfin", () => {
    expect(summary.summarizeJellyfin(jellyfin({ status: "error", error: "jellyfin-rejected", httpStatus: 401 }), null))
      .toEqual({ tone: "error", label: "jellyfinRejected", detail: "HTTP 401" });
    expect(summary.summarizeJellyfin(jellyfin({ status: "error", error: "jellyfin-unreachable" }), null).label).toBe("jellyfinUnreachable");
    expect(summary.summarizeJellyfin(jellyfin({ status: "error", error: "jellyfin-invalid" }), null).label).toBe("jellyfinNotJellyfin");
    // Un serveur d'avant les codes : « error » sans cause — injoignable par défaut.
    expect(summary.summarizeJellyfin(jellyfin({ status: "error" }), null).label).toBe("jellyfinUnreachable");
  });
});

describe("le résumé de la base", () => {
  const database = (patch: object) => readServices({ database: { status: "connected", version: "11.4.4-MariaDB-ubu2404", ...patch } }).database;

  it("connectée, avec le nom et la version du moteur", () => {
    expect(summary.summarizeDatabase(database({}))).toEqual({ tone: "success", label: "databaseConnected", detail: "MariaDB 11.4.4" });
  });

  it("une autre connexion attend le redémarrage", () => {
    expect(summary.summarizeDatabase(database({ pendingRestart: true })).label).toBe("databaseRestart");
  });

  it("ne répond pas", () => {
    expect(summary.summarizeDatabase(database({ status: "error", fields: { host: "db" } }))).toEqual({ tone: "error", label: "databaseDown", detail: "db" });
  });
});

describe("les autres tuiles", () => {
  it("adresse publique : l'hôte en service, ou le jumelage bloqué", () => {
    expect(summary.summarizePublicUrl(readPublicUrl({ publicUrl: "", envFallback: "https://tv.example.com/" }))).toMatchObject({ tone: "success", detail: "tv.example.com" });
    expect(summary.summarizePublicUrl(readPublicUrl({}))).toEqual({ tone: "warning", label: "publicUrlMissing", detailKey: "publicUrlPairingBlocked" });
  });

  it("analyse audio : sans outil, elle est indisponible quel que soit l'interrupteur", () => {
    expect(summary.summarizeAudio(readAudioAnalysis({ enabled: true, tool: null })).label).toBe("audioNoTool");
    expect(summary.summarizeAudio(readAudioAnalysis({ enabled: true, tool: "fpcalc" }))).toEqual({ tone: "success", label: "audioOn", detail: "fpcalc" });
  });
});

describe("ce qu'un serveur plus ancien ne dit pas", () => {
  it("clé présente inconnue, source de la base inconnue — même avec l'ancien fromEnv", () => {
    const status = readServices({ jellyfin: { status: "connected" }, database: { status: "connected", fromEnv: true, fields: { host: "db", port: 3306, database: "t", user: "u" } } });
    expect(status.jellyfin.apiKeyConfigured).toBeNull();
    expect(status.database.source).toBeNull();
    expect(status.database.pendingRestart).toBe(false);
    expect(status.database.fields?.host).toBe("db");
  });

  it("compteurs d'analyse audio sans « deferred »", () => {
    expect(readAudioAnalysis({ counters: { jobs: 2 } }).counters).toMatchObject({ jobs: 2, bytes: 0, deferred: null });
  });

  it("un échec sans code garde le message du serveur", () => {
    expect(summary.explainFailure(new AdminApiError(400, null, null, "Connexion échouée"))).toEqual({ message: "Connexion échouée" });
    expect(summary.explainFailure(new AdminApiError(400, "jellyfin-rejected", 403, "…"))).toEqual({ key: "errorRejected", values: { status: 403 } });
  });
});

describe("les petites règles", () => {
  it("une adresse http(s) absolue, rien d'autre", () => {
    expect(summary.isHttpUrl(" https://jf.example.com ")).toBe(true);
    expect(summary.isHttpUrl("jf.example.com")).toBe(false);
    expect(summary.isHttpUrl("ftp://jf.example.com")).toBe(false);
  });

  it("le contenu mixte : http appelé depuis https", () => {
    expect(summary.isMixedContent("https:", "http://192.168.1.50:8096")).toBe(true);
    expect(summary.isMixedContent("http:", "http://192.168.1.50:8096")).toBe(false);
  });

  it("la confirmation ignore casse, accents et espaces, jamais le mot", () => {
    expect(summary.matchesConfirmation("  REINITIALISER ", "réinitialiser")).toBe(true);
    expect(summary.matchesConfirmation("réinitialise", "réinitialiser")).toBe(false);
    expect(summary.matchesConfirmation("", "")).toBe(false);
  });

  it("les versions de base de données", () => {
    expect(summary.formatDatabaseVersion("8.0.36")).toBe("MySQL 8.0.36");
    expect(summary.formatDatabaseVersion("inconnue")).toBe("inconnue");
  });

  it("les durées, en deux unités au plus", () => {
    expect(plain(summary.formatDuration(16.4, "fr"))).toBe("16 s");
    expect(plain(summary.formatDuration(125, "fr"))).toBe("2 min 5 s");
    expect(plain(summary.formatDuration(3780, "fr"))).toBe("1 h 3 min");
    expect(plain(summary.formatDuration(7200, "en"))).toBe("2 hr");
  });

  it("les mégaoctets, dans l'unité de la langue", () => {
    expect(plain(summary.formatMegabytes(14_500_000, "fr"))).toBe("14,5 Mo");
    expect(plain(summary.formatMegabytes(14_500_000, "en"))).toBe("14.5 MB");
  });
});
