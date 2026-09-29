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

  it("l'ordre du proxy : en-têtes Jellyfin, puis cookie, puis query, puis Bearer", () => {
    expect(readIncomingAuth({ "x-emby-token": "h" }, "c", { api_key: "q" }).token).toBe("h");
    expect(readIncomingAuth({}, "c", { api_key: "q" }).token).toBe("c");
    expect(readIncomingAuth({ authorization: "Bearer b" }, undefined, { api_key: "q" }).token).toBe("q");
  });

  it("une connexion (AuthenticateByName) : l'identité sans jeton", () => {
    const auth = readIncomingAuth({ "x-emby-authorization": MB }, undefined, {});
    expect(auth.token).toBeUndefined();
    expect(auth.identity?.Client).toBe("Tentacle TV - TV");
  });
});
