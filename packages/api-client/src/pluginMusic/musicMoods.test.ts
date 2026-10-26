import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchMusicMood, fetchMusicMoods } from "./musicMoods";
import type { MusicProvider } from "./musicProvider";

const BEFORE: MusicProvider = { pluginId: "sillon", name: "Sillon", music: { search: "/music/search", resolve: "/music/resolve" } };
const WITH: MusicProvider = { ...BEFORE, music: { ...BEFORE.music, moods: "/music/moods", mood: "/music/mood" } };
const MOOD = { id: "chill", name: "Détente", color: "#2f6f8f", artworkUrl: null, keywords: ["chill"] };

function answer(body: unknown) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe("ambiances (points moods et mood)", () => {
  it("une extension d'avant : aucune requête, rien", async () => {
    const fetchMock = answer({});
    expect(await fetchMusicMoods(BEFORE, "fr")).toEqual([]);
    expect(await fetchMusicMood(BEFORE, "chill", "fr")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("la liste passe par la lecture validée ; la playlist exige sa forme", async () => {
    const fetchMock = answer({ moods: [MOOD, { id: "../x" }] });
    expect((await fetchMusicMoods(WITH, "fr")).map((m) => m.id)).toEqual(["chill"]);
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toContain("/api/plugins/sillon/music/moods?lang=fr");
    answer({ key: "ext:sillon:mood:chill", title: "Détente", mood: MOOD, tracks: [] });
    expect((await fetchMusicMood(WITH, "chill", "fr"))?.playlists).toEqual([]);
    answer({ key: "k", title: "t", mood: { id: "chill" }, tracks: [] });
    expect(await fetchMusicMood(WITH, "chill", "fr")).toBeNull();
  });
});
