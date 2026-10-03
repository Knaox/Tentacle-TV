import { describe, expect, it } from "vitest";
import { readServerUpdateReport } from "./serverUpdateReader";

const REPORT = {
  current: "1.22.3",
  bootId: "b1",
  latest: {
    version: "1.22.4",
    tag: "server-v1.22.4",
    publishedAt: "2026-10-04T10:00:00Z",
    url: "https://github.com/Knaox/Tentacle-TV/releases/tag/server-v1.22.4",
    highlights: { fr: ["Une nouveauté"], en: ["A feature"] },
  },
  behind: 1,
  requiredByClients: "1.22.1",
  checkedAt: "2026-10-04T11:00:00Z",
  error: null,
  install: { runtime: "docker", repository: "ghcr.io/knaox/tentacle-tv", tag: null },
};

describe("la réponse de la carte « Serveur Tentacle »", () => {
  it("une réponse complète passe telle quelle", () => {
    expect(readServerUpdateReport(REPORT)).toEqual(REPORT);
  });

  it("un serveur qui ne sait rien de plus que sa version : tout le reste vaut « inconnu »", () => {
    expect(readServerUpdateReport({ current: "1.22.3" })).toEqual({
      current: "1.22.3",
      bootId: "",
      latest: null,
      behind: 0,
      requiredByClients: null,
      checkedAt: null,
      error: null,
      install: { runtime: "none", repository: "ghcr.io/knaox/tentacle-tv", tag: null },
    });
    expect(readServerUpdateReport({ version: "1.22.3" })).toBeNull();
  });

  it("un lien qui ne mène pas aux publications de GitHub n'est pas montré ; une erreur inconnue non plus", () => {
    const read = readServerUpdateReport({ ...REPORT, latest: { ...REPORT.latest, url: "https://evil.test/x" }, error: "boom" });
    expect(read?.latest?.url).toBe("");
    expect(read?.error).toBeNull();
  });

  it("une version illisible ne fait pas une publication, ni une exigence", () => {
    const read = readServerUpdateReport({ ...REPORT, latest: { ...REPORT.latest, version: "1.22" }, requiredByClients: "bientôt" });
    expect(read?.latest).toBeNull();
    expect(read?.requiredByClients).toBeNull();
  });
});
