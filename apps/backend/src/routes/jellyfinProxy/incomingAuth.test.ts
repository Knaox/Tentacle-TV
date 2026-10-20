import { describe, expect, it } from "vitest";
import { readIncomingAuth } from "./incomingAuth";

const MB = 'MediaBrowser Client="Tentacle TV - TV", Device="AndroidTV", DeviceId="d-1", Version="2.0"';

describe("readIncomingAuth", () => {
  it("client ancien : X-Emby-Token et X-Emby-Authorization", () => {
    const auth = readIncomingAuth({ "x-emby-token": "t1", "x-emby-authorization": `${MB}, Token="t1"` }, undefined, {});
    expect(auth.token).toBe("t1");
    expect(auth.identity?.Device).toBe("AndroidTV");
    expect(auth.identityHeader).toContain('Device="AndroidTV"');
  });

  it("client à jour : Authorization: MediaBrowser, jeton compris", () => {
    const auth = readIncomingAuth({ authorization: `${MB}, Token="t2"` }, undefined, {});
    expect(auth.token).toBe("t2");
    expect(auth.identity?.DeviceId).toBe("d-1");
    expect(auth.identityHeader).toContain('Device="AndroidTV"');
  });

  it("page web : le cookie seul", () => {
    expect(readIncomingAuth({}, "cookie-token", {}).token).toBe("cookie-token");
  });

  it("lecteurs sans en-tête : api_key, ApiKey ou toute casse en query", () => {
    expect(readIncomingAuth({}, undefined, { api_key: "q1" }).token).toBe("q1");
    expect(readIncomingAuth({}, undefined, { ApiKey: "q2" }).token).toBe("q2");
    expect(readIncomingAuth({}, undefined, { apikey: "q3" }).token).toBe("q3");
  });

  it("relais des extensions : un Bearer, en dernier recours, sans identité", () => {
    const auth = readIncomingAuth({ authorization: "Bearer b1" }, undefined, {});
    expect(auth.token).toBe("b1");
    expect(auth.identity).toBeNull();
    expect(auth.identityHeader).toBeUndefined();
  });

  it("l'ordre du proxy : en-têtes Jellyfin, puis le cookie départagé de la query, puis du Bearer", () => {
    expect(readIncomingAuth({ "x-emby-token": "h" }, "c", { api_key: "q" }).token).toBe("h");
    expect(readIncomingAuth({}, "c", {}).token).toBe("c");
    expect(readIncomingAuth({ authorization: "Bearer b" }, undefined, { api_key: "q" }).token).toBe("q");
  });

  describe("le cookie face au jeton explicite (cf. sessionTokenChoice)", () => {
    const ACCOUNT = "0f1e2d3c4b5a69788796a5b4c3d2e1f0"; // connexion du compte (le pot du téléphone)
    const PROFILE = "eyJhbGciOiJIUzI1NiJ9.eyJzY29wZSI6InByb2ZpbGUifQ.c2ln"; // JWT d'une session de profil
    const IMPERSONATION = "eyJhbGciOiJIUzI1NiJ9.eyJpbXAiOnRydWV9.c2ln";

    it("AVPlayer en session de profil : l'`api_key` du profil, jamais le cookie du compte", () => {
      expect(readIncomingAuth({}, ACCOUNT, { api_key: PROFILE }).token).toBe(PROFILE);
      expect(readIncomingAuth({ authorization: `Bearer ${PROFILE}` }, ACCOUNT, {}).token).toBe(PROFILE);
    });

    it("la page web en session de profil (compte en réserve) : son cookie JWT l'emporte", () => {
      expect(readIncomingAuth({}, PROFILE, { api_key: ACCOUNT }).token).toBe(PROFILE);
      expect(readIncomingAuth({}, PROFILE, { api_key: PROFILE }).token).toBe(PROFILE);
    });

    it("« voir en tant que » : le cookie JWT de l'usurpation l'emporte", () => {
      expect(readIncomingAuth({}, IMPERSONATION, { api_key: ACCOUNT }).token).toBe(IMPERSONATION);
    });

    it("le moteur hors ligne, qui présente VOLONTAIREMENT le jeton du compte : inchangé", () => {
      expect(readIncomingAuth({}, ACCOUNT, { api_key: ACCOUNT }).token).toBe(ACCOUNT);
      expect(readIncomingAuth({ authorization: `Bearer ${ACCOUNT}` }, ACCOUNT, {}).token).toBe(ACCOUNT);
    });
  });

  it("une connexion (AuthenticateByName) : l'identité sans jeton", () => {
    const auth = readIncomingAuth({ "x-emby-authorization": MB }, undefined, {});
    expect(auth.token).toBeUndefined();
    expect(auth.identity?.Client).toBe("Tentacle TV - TV");
  });
});
