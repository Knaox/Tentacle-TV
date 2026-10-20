/**
 * Le cookie de session ou le jeton explicite ? Le téléphone garde le cookie de
 * sa connexion (le compte) et présente le jeton de son profil : c'est le
 * profil. Le web, lui, envoie le même jeton des deux façons, et sa session de
 * profil (un JWT posé par le serveur, compte en réserve) n'est jamais remplacée.
 */

import { describe, expect, it } from "vitest";
import { chooseSessionToken, cookieDecidesAtOnce, isServerPlacedSession } from "./sessionTokenChoice";

const ACCOUNT = "0f1e2d3c4b5a69788796a5b4c3d2e1f0"; // jeton Jellyfin (connexion du compte)
const PROFILE = "eyJhbGciOiJIUzI1NiJ9.eyJzY29wZSI6InByb2ZpbGUifQ.c2lnbmF0dXJl"; // JWT d'un profil
const OTHER_ACCOUNT = "aaaabbbbccccddddeeeeffff00001111";

describe("chooseSessionToken", () => {
  it("le téléphone en session de profil : le jeton du profil, malgré le cookie du compte", () => {
    expect(chooseSessionToken(ACCOUNT, PROFILE)).toBe(PROFILE);
  });

  it("un Bearer d'une autre connexion l'emporte aussi sur un cookie de connexion resté", () => {
    expect(chooseSessionToken(ACCOUNT, OTHER_ACCOUNT)).toBe(OTHER_ACCOUNT);
  });

  it("la session de profil du web (cookie JWT) l'emporte, même devant le Bearer du compte", () => {
    expect(chooseSessionToken(PROFILE, ACCOUNT)).toBe(PROFILE);
  });

  it("le même jeton des deux façons, un seul des deux, ou aucun", () => {
    expect(chooseSessionToken(ACCOUNT, ACCOUNT)).toBe(ACCOUNT);
    expect(chooseSessionToken(ACCOUNT, undefined)).toBe(ACCOUNT);
    expect(chooseSessionToken(undefined, PROFILE)).toBe(PROFILE);
    expect(chooseSessionToken(undefined, undefined)).toBeUndefined();
    expect(chooseSessionToken("", "")).toBeUndefined();
  });
});

describe("isServerPlacedSession", () => {
  it("un JWT oui, un jeton Jellyfin non", () => {
    expect(isServerPlacedSession(PROFILE)).toBe(true);
    expect(isServerPlacedSession(ACCOUNT)).toBe(false);
  });
});

describe("cookieDecidesAtOnce — la poignée de main de la socket", () => {
  it("un navigateur (« Mozilla/… », Electron compris) : son cookie l'authentifie aussitôt", () => {
    expect(cookieDecidesAtOnce(ACCOUNT, { "user-agent": "Mozilla/5.0 (Macintosh) Safari/605.1.15" })).toBe(true);
    expect(cookieDecidesAtOnce(ACCOUNT, { "user-agent": "Mozilla/5.0 (X11; Linux) Electron/43.0.0" })).toBe(true);
  });

  it("une app native (iOS sans User-Agent, OkHttp) : le cookie de connexion attend son message `auth`", () => {
    expect(cookieDecidesAtOnce(ACCOUNT, {})).toBe(false);
    expect(cookieDecidesAtOnce(ACCOUNT, { "user-agent": "okhttp/4.12.0" })).toBe(false);
  });

  it("`Sec-Fetch-Mode` ne fait pas un navigateur : la WebSocket de Node l'envoie aussi", () => {
    expect(cookieDecidesAtOnce(ACCOUNT, { "sec-fetch-mode": "websocket", "user-agent": "node" })).toBe(false);
  });

  it("une session posée par le serveur dans le cookie décide toujours aussitôt", () => {
    expect(cookieDecidesAtOnce(PROFILE, {})).toBe(true);
  });
});
