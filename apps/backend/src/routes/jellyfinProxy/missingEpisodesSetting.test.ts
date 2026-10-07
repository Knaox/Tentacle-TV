import { afterEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();
vi.mock("undici", async (original) => ({ ...(await original<typeof import("undici")>()), fetch: (...args: unknown[]) => fetchMock(...args) }));

const { displayMissingEpisodes, resetMissingEpisodesCache } = await import("./missingEpisodesSetting");

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const HEADERS = { Authorization: 'MediaBrowser Token="t"' };

afterEach(() => {
  fetchMock.mockReset();
  resetMissingEpisodesCache();
});

describe("displayMissingEpisodes — « Afficher les épisodes manquants » du compte Jellyfin", () => {
  it("lit le réglage du compte, avec l'autorisation de la requête", async () => {
    fetchMock.mockResolvedValueOnce(json({ Id: "u1", Configuration: { DisplayMissingEpisodes: true } }));
    expect(await displayMissingEpisodes("http://jf", "u1", HEADERS)).toBe(true);
    expect(fetchMock.mock.calls[0][0]).toBe("http://jf/Users/u1");
    expect(fetchMock.mock.calls[0][1].headers).toBe(HEADERS);
  });

  it("décoché, ou absent : le défaut de Jellyfin — les dossiers vides sont cachés", async () => {
    fetchMock.mockResolvedValueOnce(json({ Configuration: { DisplayMissingEpisodes: false } }));
    expect(await displayMissingEpisodes("http://jf", "u1", HEADERS)).toBe(false);
    fetchMock.mockResolvedValueOnce(json({}));
    expect(await displayMissingEpisodes("http://jf", "u2", HEADERS)).toBe(false);
  });

  it("un refus ou un Jellyfin muet vaut le défaut, sans lever", async () => {
    fetchMock.mockResolvedValueOnce(json({ error: "nope" }, 401));
    expect(await displayMissingEpisodes("http://jf", "u1", HEADERS)).toBe(false);
    fetchMock.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    expect(await displayMissingEpisodes("http://jf", "u2", HEADERS)).toBe(false);
  });

  it("gardé une minute par compte, relu ensuite", async () => {
    fetchMock.mockResolvedValue(json({ Configuration: { DisplayMissingEpisodes: true } }));
    await displayMissingEpisodes("http://jf", "u1", HEADERS, 0);
    await displayMissingEpisodes("http://jf", "u1", HEADERS, 59_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await displayMissingEpisodes("http://jf", "u1", HEADERS, 61_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
