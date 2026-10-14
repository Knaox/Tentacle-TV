import { describe, expect, it } from "vitest";
import { parseVideoRef, refOfQuery, refPathSegment } from "./videoRef";

describe("référence d'une vidéo relayée", () => {
  it("garde l'identifiant YouTube NU comme clé, et y ramène `yt:`", () => {
    expect(parseVideoRef("Way9Dexny3w")).toEqual({ kind: "youtube", id: "Way9Dexny3w", key: "Way9Dexny3w" });
    expect(parseVideoRef("yt:Way9Dexny3w")?.key).toBe("Way9Dexny3w");
  });

  it("préfixe Dailymotion par `dm:`", () => {
    expect(parseVideoRef("dm:x8e90ff")).toEqual({ kind: "dailymotion", id: "x8e90ff", key: "dm:x8e90ff" });
  });

  it("refuse tout le reste", () => {
    for (const value of ["../../etc", "dm:", "dm:x8/../a", "yt:short", "x8e90ff", 42, null]) expect(parseVideoRef(value)).toBeNull();
  });

  it("encode le `:` dans un chemin, que la règle des téléviseurs accepte", () => {
    const segment = refPathSegment("dm:x8e90ff");
    expect(segment).toBe("dm%3Ax8e90ff");
    expect(`/api/trailers/hls/${segment}/master.m3u8`).toMatch(/^\/api\/trailers\/[\w./?=&%-]+$/);
    expect(refPathSegment("Way9Dexny3w")).toBe("Way9Dexny3w");
  });

  it("lit `ytId` OU `dmId`, jamais les deux", () => {
    expect(refOfQuery({ ytId: "Way9Dexny3w" })?.kind).toBe("youtube");
    expect(refOfQuery({ dmId: "x8e90ff" })?.key).toBe("dm:x8e90ff");
    expect(refOfQuery({ ytId: "Way9Dexny3w", dmId: "x8e90ff" })).toBeNull();
    expect(refOfQuery({ dmId: "x8e/90" })).toBeNull();
  });
});
