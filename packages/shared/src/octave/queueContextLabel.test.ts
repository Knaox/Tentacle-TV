import { describe, expect, it } from "vitest";
import { queueContextKind, queueContextTitleKey } from "./queueContextLabel";

describe("le titre de la file du contexte", () => {
  it("nomme la page qui a lancé la lecture", () => {
    expect(queueContextKind("album:jf:1")).toBe("album");
    expect(queueContextKind("playlist:42")).toBe("playlist");
    expect(queueContextKind("playlist:ext:sillon:9")).toBe("playlist");
    expect(queueContextKind("artist:jf:7")).toBe("artist");
    expect(queueContextKind("mood:chill")).toBe("mood");
    expect(queueContextKind("radio:jf:a")).toBe("radio");
    expect(queueContextKind("liked")).toBe("liked");
    expect(queueContextKind("playlist:liked")).toBe("liked");
  });

  it("le reste (recherche, accueil, appareil, inconnu) : « Ensuite »", () => {
    for (const id of [null, "search", "search:tycho", "home", "device", "album:", "bizarre"]) {
      expect(queueContextTitleKey(id)).toBe("queue.fromContext");
    }
    expect(queueContextTitleKey("album:1")).toBe("queue.fromAlbum");
  });
});
