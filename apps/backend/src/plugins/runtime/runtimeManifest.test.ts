import { describe, expect, it } from "vitest";
import { isPublicRoute, readRuntimeManifest, runtimeEntryPath } from "./runtimeManifest";
import { guestEnv, guestExecArgv } from "./guestLaunch";
import { clientResponseHeaders, guestRequestHeaders, relaySessionOf } from "./relay/relayHeaders";

const SILLON = {
  runtime: {
    kind: "isolated",
    entry: "server/index.mjs",
    tools: ["yt-dlp"],
    env: ["LIDARR_URL", "LIDARR_API_KEY"],
    publicRoutes: ["/webhooks/lidarr"],
    hostApi: ["jellyfin.music", "users", "events", "tools"],
  },
};

describe("manifeste `runtime`", () => {
  it("lit le manifeste de Sillon", () => {
    expect(readRuntimeManifest(SILLON)).toEqual({ ...SILLON.runtime });
  });

  it("refuse un manifeste à moitié valide plutôt que d'en garder une partie", () => {
    const bad = (patch: Record<string, unknown>) => readRuntimeManifest({ runtime: { ...SILLON.runtime, ...patch } });
    expect(bad({ kind: "inprocess" })).toBeNull();
    expect(bad({ entry: "../../index.mjs" })).toBeNull();
    expect(bad({ entry: "/abs/index.mjs" })).toBeNull();
    expect(bad({ entry: "server/index.sh" })).toBeNull();
    expect(bad({ tools: ["yt-dlp", "bash"] })).toBeNull();
    expect(bad({ hostApi: ["jellyfin.admin"] })).toBeNull();
    expect(bad({ env: ["JELLYFIN_API_KEY"] })).toBeNull();
    expect(bad({ env: ["TENTACLE_SECRET"] })).toBeNull();
    expect(bad({ env: ["DATABASE_URL"] })).toBeNull();
    expect(bad({ env: ["PATH"] })).toBeNull();
    expect(bad({ publicRoutes: ["/../admin"] })).toBeNull();
    expect(readRuntimeManifest({})).toBeNull();
  });

  it("lit les requêtes déléguées déclarées, refuse le manifeste si elles sont mal formées", () => {
    const withClient = { runtime: { ...SILLON.runtime, hostApi: [...SILLON.runtime.hostApi, "client"], clientFetch: { hosts: ["music.example.com"], mediaHosts: ["*.media.example.net"] } } };
    expect(readRuntimeManifest(withClient)?.clientFetch).toEqual({ hosts: ["music.example.com"], mediaHosts: ["*.media.example.net"] });
    expect(readRuntimeManifest({ runtime: { ...withClient.runtime, clientFetch: { hosts: ["localhost"] } } })).toBeNull();
    expect(readRuntimeManifest({ runtime: { ...withClient.runtime, clientFetch: { hosts: [] } } })).toBeNull();
    expect(readRuntimeManifest(SILLON)?.clientFetch).toBeUndefined();
  });

  it("garde le module dans le dossier de l'extension", () => {
    expect(runtimeEntryPath("/data/plugins/sillon", "server/index.mjs")).toBe("/data/plugins/sillon/server/index.mjs");
    expect(runtimeEntryPath("/data/plugins/sillon", "../vigie/server/index.mjs")).toBeNull();
  });

  it("une route publique est une égalité stricte, jamais un préfixe", () => {
    const manifest = readRuntimeManifest(SILLON);
    expect(manifest && isPublicRoute(manifest, "/webhooks/lidarr")).toBe(true);
    expect(manifest && isPublicRoute(manifest, "/webhooks/lidarr/x")).toBe(false);
    expect(manifest && isPublicRoute(manifest, "/admin/settings")).toBe(false);
  });
});

describe("lancement de l'invité", () => {
  it("pose le modèle de permissions : lecture du dossier, écriture des données, réseau selon Node", () => {
    const paths = { pluginDir: "/d/plugins/sillon", dataDir: "/d/plugins/sillon/data" };
    expect(guestExecArgv(paths, 24)).toEqual([
      "--permission", "--allow-fs-read=/d/plugins/sillon", "--allow-fs-write=/d/plugins/sillon/data",
      "--max-old-space-size=512", "--disable-warning=ExperimentalWarning",
    ]);
    expect(guestExecArgv(paths, 26)).toContain("--allow-net");
    expect(guestExecArgv(paths, 26).some((a) => a.includes("child-process") || a.includes("worker") || a.includes("addons"))).toBe(false);
  });

  it("reconstruit l'environnement : jamais celui du serveur", () => {
    const manifest = readRuntimeManifest(SILLON);
    if (!manifest) throw new Error("manifeste");
    const env = guestEnv("sillon", manifest, { dataDir: "/d", socket: "/s.sock" }, "fr", {
      LIDARR_URL: "http://lidarr:8686",
      JELLYFIN_API_KEY: "secret",
      DATABASE_URL: "mysql://x",
      TENTACLE_JWT_SECRET: "jwt",
      PATH: "/usr/bin",
      TZ: "Europe/Paris",
    });
    expect(env).toEqual({
      TZ: "Europe/Paris",
      LIDARR_URL: "http://lidarr:8686",
      TENTACLE_PLUGIN_ID: "sillon",
      TENTACLE_PLUGIN_DATA_DIR: "/d",
      TENTACLE_PLUGIN_SOCKET: "/s.sock",
      TENTACLE_LOCALE: "fr",
    });
  });
});

describe("en-têtes du relais", () => {
  it("retire ce qui authentifie le client et tout x-tentacle-* qu'il aurait posé", () => {
    const out = guestRequestHeaders(
      {
        authorization: "Bearer jeton",
        cookie: "tentacle_token=x",
        "x-emby-token": "y",
        "x-tentacle-user-id": "usurpé",
        "x-tentacle-is-admin": "1",
        "x-forwarded-for": "1.2.3.4",
        range: "bytes=0-99",
        "content-type": "application/json",
        connection: "keep-alive",
      },
      { userId: "u1", userName: "Zoé", isAdmin: false, session: "profile" },
      "fr",
      "req-1",
    );
    expect(out).toEqual({
      range: "bytes=0-99",
      "content-type": "application/json",
      host: "tentacle-plugin",
      "x-tentacle-user-id": "u1",
      "x-tentacle-user-name": "Zo%C3%A9",
      "x-tentacle-is-admin": "0",
      "x-tentacle-session": "profile",
      "x-tentacle-locale": "fr",
      "x-tentacle-request-id": "req-1",
    });
  });

  it("une route publique arrive sans identité", () => {
    const out = guestRequestHeaders({ "x-tentacle-user-id": "usurpé" }, null, "en", "r");
    expect(out["x-tentacle-user-id"]).toBeUndefined();
  });

  it("la réponse de l'invité ne pose ni cookie ni CORS", () => {
    expect(
      clientResponseHeaders({ "set-cookie": ["a=b"], "access-control-allow-origin": "*", "content-range": "bytes 0-9/100", "content-type": "audio/flac" }),
    ).toEqual({ "content-range": "bytes 0-9/100", "content-type": "audio/flac" });
  });

  it("un en-tête nommé « __proto__ » ne touche le prototype d'aucun des deux objets", () => {
    // JSON.parse crée une VRAIE propriété « __proto__ », comme le ferait un analyseur d'en-têtes.
    const hostile = JSON.parse('{"__proto__": ["x"], "constructor": "y", "content-type": "audio/flac"}');
    const response = clientResponseHeaders(hostile);
    expect(Object.getPrototypeOf(response)).toBeNull();
    expect(Object.keys(response)).toEqual(["content-type"]);
    const request = guestRequestHeaders(hostile, null, "en", "r");
    expect(Object.getPrototypeOf(request)).toBeNull();
    expect(Object.keys(request)).not.toContain("__proto__");
    expect(Object.keys(request)).not.toContain("constructor");
  });

  it("seule une session personnelle administre", () => {
    expect(relaySessionOf("personal")).toBe("personal");
    expect(relaySessionOf("tvProfile")).toBe("profile");
    expect(relaySessionOf("impersonation")).toBe("profile");
    expect(relaySessionOf("tvLegacy")).toBe("device");
    expect(relaySessionOf(undefined)).toBe("device");
  });
});
