import { afterEach, describe, expect, it } from "vitest";
import { isClientFetchJob } from "./clientFetchAgent";
import { clientFetchAnnounceHeaders, setClientFetchAnnounced } from "./clientFetchAnnounce";

const job = { type: "plugin:clientFetch", id: "0b5c0f6e-2f1a-4a8e-9d55-2d8e4c1f7a10", pluginId: "sillon", request: { method: "POST", url: "https://music.example.com/x" } };

afterEach(() => setClientFetchAnnounced(false));

describe("requêtes déléguées — l'agent de la page", () => {
  it("ne croit la socket que pour une requête bien formée", () => {
    expect(isClientFetchJob(job)).toBe(true);
    expect(isClientFetchJob({ ...job, type: "music:pending" })).toBe(false);
    expect(isClientFetchJob({ ...job, id: "../../x" })).toBe(false);
    expect(isClientFetchJob({ ...job, request: null })).toBe(false);
    expect(isClientFetchJob(null)).toBe(false);
  });

  it("annonce l'appareil sur les routes d'extension seulement, et seulement agent démarré", () => {
    expect(clientFetchAnnounceHeaders("/api/plugins/sillon/music/resolve")).toEqual({});
    setClientFetchAnnounced(true);
    expect(clientFetchAnnounceHeaders("/api/plugins/sillon/music/resolve")).toEqual({ "x-tentacle-client-fetch": "1" });
    expect(clientFetchAnnounceHeaders("/api/music/search")).toEqual({});
    setClientFetchAnnounced(false);
    expect(clientFetchAnnounceHeaders("/api/plugins/sillon/music/resolve")).toEqual({});
  });
});
