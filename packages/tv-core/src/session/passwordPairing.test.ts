import { describe, expect, it } from "vitest";

import {
  LOGIN_PATH,
  LOGOUT_PATH,
  TV_TOKEN_PATH,
  classifyLoginStatus,
  pairWithPassword,
  type PairingCall,
  type PairingReply,
} from "./passwordPairing";

interface Sent { path: string; headers: Record<string, string>; body?: string }

/** Un serveur scripté : une réponse par route, et le journal des appels. */
function server(replies: Partial<Record<string, PairingReply | (() => Promise<PairingReply>)>>) {
  const sent: Sent[] = [];
  const call: PairingCall = async (path, init) => {
    sent.push({ path, headers: init.headers, body: init.body });
    const reply = replies[path];
    if (!reply) return { status: 404, body: null };
    return typeof reply === "function" ? reply() : reply;
  };
  return { call, sent };
}

const LOGIN_OK: PairingReply = { status: 200, body: { AccessToken: "jf-connexion", User: { Id: "u1", Name: "Relecteur" } } };
const DEVICE_OK: PairingReply = { status: 200, body: { token: "jwt-appareil" } };
const LOGOUT_OK: PairingReply = { status: 200, body: { success: true } };
const REQUEST = { username: "relecteur", password: "secret", identity: { deviceId: "graine", client: "Tentacle TV", device: "Apple TV" } };

describe("le jumelage par identifiant et mot de passe", () => {
  it("connecte, demande le jeton d'appareil, puis rend le jeton de connexion", async () => {
    const { call, sent } = server({ [LOGIN_PATH]: LOGIN_OK, [TV_TOKEN_PATH]: DEVICE_OK, [LOGOUT_PATH]: LOGOUT_OK });
    const result = await pairWithPassword(REQUEST, call);
    expect(result).toEqual({ ok: true, token: "jwt-appareil", user: { id: "u1", name: "Relecteur" } });
    expect(sent.map((s) => s.path)).toEqual([LOGIN_PATH, TV_TOKEN_PATH, LOGOUT_PATH]);
    expect(JSON.parse(sent[0].body!)).toEqual({ username: "relecteur", password: "secret", deviceId: "graine", client: "Tentacle TV", device: "Apple TV" });
    // Le jeton d'appareil se demande, et le jeton de connexion se rend, au nom de la connexion.
    expect(sent[1].headers.Authorization).toBe("Bearer jf-connexion");
    expect(sent[2].headers.Authorization).toBe("Bearer jf-connexion");
  });

  it("ne met le mot de passe que dans le corps de la connexion", async () => {
    const { call, sent } = server({ [LOGIN_PATH]: LOGIN_OK, [TV_TOKEN_PATH]: DEVICE_OK, [LOGOUT_PATH]: LOGOUT_OK });
    await pairWithPassword(REQUEST, call);
    const elsewhere = sent.flatMap((s, i) => [s.path, ...Object.values(s.headers), i > 0 ? s.body ?? "" : ""]);
    expect(elsewhere.join(" ")).not.toContain("secret");
  });

  it("reste jumelée même si le jeton de connexion ne peut pas être rendu", async () => {
    const { call } = server({ [LOGIN_PATH]: LOGIN_OK, [TV_TOKEN_PATH]: DEVICE_OK, [LOGOUT_PATH]: { status: null, failure: "network" } });
    expect((await pairWithPassword(REQUEST, call)).ok).toBe(true);
  });

  it("rend le jeton de connexion quand le jeton d'appareil est refusé", async () => {
    const { call, sent } = server({ [LOGIN_PATH]: LOGIN_OK, [TV_TOKEN_PATH]: { status: 429, body: null }, [LOGOUT_PATH]: LOGOUT_OK });
    expect(await pairWithPassword(REQUEST, call)).toEqual({ ok: false, error: "tooManyPairings", status: 429 });
    expect(sent.map((s) => s.path)).toEqual([LOGIN_PATH, TV_TOKEN_PATH, LOGOUT_PATH]);
  });

  it("s'arrête à une connexion refusée, sans rien demander d'autre", async () => {
    const { call, sent } = server({ [LOGIN_PATH]: { status: 401, body: { message: "Identifiants invalides" } } });
    expect(await pairWithPassword(REQUEST, call)).toEqual({ ok: false, error: "invalidCredentials", status: 401 });
    expect(sent.map((s) => s.path)).toEqual([LOGIN_PATH]);
  });

  it("distingue un serveur muet d'un serveur injoignable", async () => {
    const muet = server({ [LOGIN_PATH]: { status: null, failure: "timeout" } });
    expect(await pairWithPassword(REQUEST, muet.call)).toEqual({ ok: false, error: "connectionTimeout" });
    const coupe = server({ [LOGIN_PATH]: { status: null, failure: "network" } });
    expect(await pairWithPassword(REQUEST, coupe.call)).toEqual({ ok: false, error: "cannotReachServer" });
  });

  it("compte un transport qui lève comme un réseau coupé", async () => {
    const { call } = server({ [LOGIN_PATH]: () => Promise.reject(new Error("boum")) });
    expect(await pairWithPassword(REQUEST, call)).toEqual({ ok: false, error: "cannotReachServer" });
  });

  it("refuse une réponse de connexion illisible sans aller plus loin", async () => {
    const { call, sent } = server({ [LOGIN_PATH]: { status: 200, body: { AccessToken: "" } } });
    expect(await pairWithPassword(REQUEST, call)).toEqual({ ok: false, error: "serverError" });
    expect(sent).toHaveLength(1);
  });

  it("refuse un jeton d'appareil absent, et rend quand même le jeton de connexion", async () => {
    const { call, sent } = server({ [LOGIN_PATH]: LOGIN_OK, [TV_TOKEN_PATH]: { status: 200, body: {} }, [LOGOUT_PATH]: LOGOUT_OK });
    expect(await pairWithPassword(REQUEST, call)).toEqual({ ok: false, error: "serverError" });
    expect(sent.at(-1)?.path).toBe(LOGOUT_PATH);
  });
});

describe("le verdict d'une connexion refusée", () => {
  it("donne à chaque refus son message", () => {
    expect(classifyLoginStatus(401)).toBe("invalidCredentials");
    // Le 403 de Jellyfin (compte désactivé, bloqué, restreint), que le serveur traduit en 400.
    expect(classifyLoginStatus(400)).toBe("accountRefused");
    expect(classifyLoginStatus(429)).toBe("tooManyAttempts");
    expect(classifyLoginStatus(502)).toBe("jellyfinUnreachable");
    expect(classifyLoginStatus(503)).toBe("jellyfinUnreachable");
    expect(classifyLoginStatus(500)).toBe("serverError");
    expect(classifyLoginStatus(404)).toBe("serverError");
  });
});
