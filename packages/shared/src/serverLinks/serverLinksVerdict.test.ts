import { describe, expect, it } from "vitest";
import fr from "../i18n/locales/fr/serverLinks";
import en from "../i18n/locales/en/serverLinks";
import type { LinkProbe, ServerLinksReport } from "./serverLinksContract";
import {
  LINK_BENEFITS,
  evaluateServerLinks,
  linkHostKind,
  linksProgress,
  suggestServerLinks,
  type LinkIssue,
} from "./serverLinksVerdict";

const OK: LinkProbe = { result: "ok", httpStatus: 200, version: null, cors: null, detail: null };
const JF_OK: LinkProbe = { result: "ok", httpStatus: 200, version: "10.11.8", cors: true, detail: null };
const DOWN: LinkProbe = { result: "unreachable", httpStatus: null, version: null, cors: null, detail: "ECONNREFUSED" };

function report(patch: { tentacle?: Partial<ServerLinksReport["tentacle"]>; direct?: Partial<ServerLinksReport["direct"]>; legacy?: boolean | null } = {}): ServerLinksReport {
  return {
    checkedAt: "2026-09-29T12:00:00.000Z",
    tentacle: { url: "https://tv.example.com", source: "config", probe: OK, ...patch.tentacle },
    direct: {
      enabled: true,
      publicUrl: "https://jf.example.com",
      privateUrl: "http://192.168.1.50:8096",
      publicProbe: JF_OK,
      privateProbe: JF_OK,
      ...patch.direct,
    },
    legacyClientsRelayed: patch.legacy ?? false,
    jellyfinUrl: "http://jellyfin:8096",
  };
}

const [publicOf, directOf] = [
  (r: ServerLinksReport) => evaluateServerLinks(r)[0],
  (r: ServerLinksReport) => evaluateServerLinks(r)[1],
];
const issuesOf = (r: ServerLinksReport, index: 0 | 1, endpoint = 0): LinkIssue[] =>
  evaluateServerLinks(r)[index]?.endpoints[endpoint]?.issues ?? [];

describe("linkHostKind", () => {
  it.each([
    ["http://localhost:3001", "loopback"],
    ["http://127.0.0.1:8096", "loopback"],
    ["http://[::1]:8096", "loopback"],
    ["http://jellyfin:8096", "internal-name"],
    ["http://192.168.1.50:8096", "private"],
    ["http://10.0.0.2", "private"],
    ["http://172.20.0.3:8096", "private"],
    ["http://100.101.3.4:8096", "private"],
    ["http://nas.local:8096", "private"],
    ["http://[fd00::12]:8096", "private"],
    ["https://jf.example.com", "public"],
    ["http://82.64.10.20:8096", "public"],
    ["http://172.40.0.3", "public"],
    ["ftp://jf.example.com", "invalid"],
    ["pas une adresse", "invalid"],
  ])("%s → %s", (url, kind) => {
    expect(linkHostKind(url)).toBe(kind);
  });
});

describe("lien public", () => {
  it("absent : à faire", () => {
    expect(publicOf(report({ tentacle: { url: null, source: null, probe: null } }))?.state).toBe("todo");
  });

  it("en https, et c'est bien ce serveur : fait", () => {
    expect(publicOf(report())?.state).toBe("done");
  });

  it("une adresse du réseau local n'est pas un lien public", () => {
    expect(issuesOf(report({ tentacle: { url: "http://192.168.1.20:3000" } }), 0)).toEqual(["not-public", "not-https"]);
  });

  it("sans HTTPS : à vérifier", () => {
    const r = report({ tentacle: { url: "http://tv.example.com" } });
    expect(publicOf(r)?.state).toBe("attention");
    expect(issuesOf(r, 0)).toEqual(["not-https"]);
  });

  it("injoignable depuis le serveur : à vérifier, jamais cassé", () => {
    expect(issuesOf(report({ tentacle: { probe: DOWN } }), 0)).toEqual(["unverified"]);
  });

  it("un autre Tentacle répond", () => {
    expect(issuesOf(report({ tentacle: { probe: { ...OK, result: "other-server" } } }), 0)).toEqual(["other-server"]);
  });

  it("dit d'où vient l'adresse quand c'est l'environnement", () => {
    expect(publicOf(report({ tentacle: { source: "env" } }))?.notes).toEqual(["from-env"]);
  });
});

describe("lecture directe", () => {
  it("coupée : à faire, même adresses renseignées", () => {
    const check = directOf(report({ direct: { enabled: false } }));
    expect(check?.state).toBe("todo");
    expect(check?.notes).toEqual(["direct-disabled"]);
  });

  it("allumée, deux adresses qui répondent : fait", () => {
    expect(directOf(report())?.state).toBe("done");
  });

  it("un nom de conteneur Docker en adresse locale : les appareils ne le joignent pas", () => {
    expect(issuesOf(report({ direct: { privateUrl: "http://jellyfin:8096" } }), 1, 1)).toEqual(["internal-host"]);
  });

  it("une IP privée en adresse publique", () => {
    expect(issuesOf(report({ direct: { publicUrl: "http://192.168.1.50:8096" } }), 1, 0)).toEqual(["not-public", "mixed-content"]);
  });

  it("CORS absent : refusé aux navigateurs", () => {
    expect(issuesOf(report({ direct: { publicProbe: { ...JF_OK, cors: false } } }), 1, 0)).toEqual(["cors-missing"]);
  });

  it("Jellyfin en http:// derrière un Tentacle en http:// : pas de contenu mixte", () => {
    expect(issuesOf(report({ tentacle: { url: "http://tv.example.com" }, direct: { publicUrl: "http://jf.example.com" } }), 1, 0)).toEqual([]);
  });

  it("un autre Jellyfin répond sur le réseau local", () => {
    const r = report({ direct: { privateProbe: { ...JF_OK, result: "other-server" } } });
    expect(directOf(r)?.state).toBe("attention");
    expect(issuesOf(r, 1, 1)).toEqual(["other-server"]);
  });

  it("dit que les applications anciennes restent sur le relais", () => {
    expect(directOf(report({ legacy: true }))?.notes).toEqual(["legacy-relayed"]);
  });

  it("non sondée : non vérifiée", () => {
    expect(directOf(report({ direct: { publicProbe: null } }))?.state).toBe("unknown");
  });
});

describe("avancement et suggestions", () => {
  it("compte ce qui est fait", () => {
    expect(linksProgress(evaluateServerLinks(report({ direct: { enabled: false } })))).toEqual({ done: 1, total: 2 });
  });

  it("propose l'adresse de la page si elle vient d'Internet, et un Jellyfin du réseau local", () => {
    expect(suggestServerLinks({ pageOrigin: "https://tv.example.com/", jellyfinUrl: "http://192.168.1.50:8096/" }))
      .toEqual({ publicUrl: "https://tv.example.com", jellyfinPrivateUrl: "http://192.168.1.50:8096" });
  });

  it("ne propose ni une page du réseau local, ni un nom de conteneur", () => {
    expect(suggestServerLinks({ pageOrigin: "http://192.168.1.20:3000", jellyfinUrl: "http://jellyfin:8096" }))
      .toEqual({ publicUrl: "", jellyfinPrivateUrl: "" });
  });
});

describe("vocabulaire des liens du serveur", () => {
  it("le français et l'anglais ont les mêmes clés", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(fr).sort());
  });

  it("chaque recommandation, chaque souci et chaque note a ses mots", () => {
    const issues: LinkIssue[] = ["not-public", "internal-host", "not-https", "mixed-content", "cors-missing", "other-server", "unexpected", "http-error", "unverified"];
    const keys = [
      ...Object.entries(LINK_BENEFITS).flatMap(([id, benefits]) => [`check_${id}`, `summary_${id}`, ...benefits.map((b) => `benefit_${id}_${b}`)]),
      ...issues.map((issue) => `issue_${issue}`),
      "note_direct-disabled", "note_legacy-relayed", "note_from-env",
      "state_done", "state_todo", "state_attention", "state_unknown",
      "role_tentacle", "role_jellyfinPublic", "role_jellyfinPrivate",
    ];
    for (const key of keys) expect(fr).toHaveProperty([key]);
  });

  it("aucun texte vide", () => {
    for (const value of [...Object.values(fr), ...Object.values(en)]) expect(value.trim()).not.toBe("");
  });
});
