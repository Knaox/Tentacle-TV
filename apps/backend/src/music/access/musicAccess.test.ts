/**
 * Ce qu'un compte voit de la musique : la politique Jellyfin, rien d'autre —
 * et fermé à l'échec.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { closedContentPolicy, type ContentPolicy } from "../../services/contentPolicy";
import { getMusicAccess, resetMusicAccessForTests, sees } from "./musicAccess";

const { policy, library, jf } = vi.hoisted(() => ({
  policy: vi.fn<(userId: string) => Promise<ContentPolicy>>(),
  library: vi.fn(),
  jf: vi.fn(),
}));

vi.mock("../../services/contentPolicy", async (original) => ({
  ...(await original<typeof import("../../services/contentPolicy")>()),
  getContentPolicy: (userId: string) => policy(userId),
  onContentPolicyInvalidated: () => () => undefined,
}));
vi.mock("../jellyfin/musicLibrary", () => ({ getMusicLibrary: () => library() }));
vi.mock("../jellyfin/musicJellyfin", async (original) => ({
  ...(await original<typeof import("../jellyfin/musicJellyfin")>()),
  jfAdmin: (path: string) => jf(path),
}));

const LIB = { libraryId: "lib", name: "Musique", paths: ["/music"] };
function open(extra: Partial<ContentPolicy> = {}): ContentPolicy {
  return { ...closedContentPolicy("u"), readable: true, restricted: false, enableAllFolders: true, ...extra };
}

beforeEach(() => {
  resetMusicAccessForTests();
  policy.mockReset();
  library.mockReset().mockResolvedValue(LIB);
  jf.mockReset();
});

describe("droits musique d'un compte", () => {
  it("sans bibliothèque musique, ou politique illisible : rien", async () => {
    library.mockResolvedValue(null);
    policy.mockResolvedValue(open());
    expect(await getMusicAccess("u")).toEqual({ mode: "none" });
    library.mockResolvedValue(LIB);
    policy.mockResolvedValue(closedContentPolicy("u"));
    expect(await getMusicAccess("u")).toEqual({ mode: "none" });
  });

  it("bibliothèque non permise, ou bloquée : rien", async () => {
    policy.mockResolvedValue(open({ enableAllFolders: false, enabledFolders: ["films"] }));
    expect((await getMusicAccess("u")).mode).toBe("none");
    policy.mockResolvedValue(open({ blockedMediaFolders: ["lib"] }));
    expect((await getMusicAccess("u")).mode).toBe("none");
  });

  it("permise, sans restriction : tout, sans requête", async () => {
    policy.mockResolvedValue(open({ enableAllFolders: false, enabledFolders: ["lib"] }));
    const access = await getMusicAccess("u");
    expect(access.mode).toBe("all");
    expect(sees(access, "anything")).toBe(true);
    expect(jf).not.toHaveBeenCalled();
  });

  it("restreint : ce que Jellyfin lui montre (titres, albums, artistes), au nom du compte", async () => {
    policy.mockResolvedValue(open({ restricted: true, maxParentalRating: 10 }));
    jf.mockImplementation(async (path: string) => ({ ok: true, data: { Items: path.startsWith("/Artists") ? [{ Id: "AR-1" }] : [{ Id: "T-1" }] } }));
    const access = await getMusicAccess("u");
    expect(access.mode).toBe("some");
    expect(sees(access, "t1")).toBe(true);
    expect(sees(access, "ar1")).toBe(true);
    expect(sees(access, "t2")).toBe(false);
    expect(jf.mock.calls.every(([p]) => String(p).includes("userId=u") && !String(p).includes("Ids="))).toBe(true);
  });

  it("restreint et Jellyfin muet : rien (fermé à l'échec)", async () => {
    policy.mockResolvedValue(open({ restricted: true, blockedTags: ["x"] }));
    jf.mockResolvedValue({ ok: false, failure: "unreachable" });
    expect(await getMusicAccess("u")).toEqual({ mode: "none" });
  });
});
