import { describe, expect, it } from "vitest";
import { newSecret, runStackInit, type StackInitFs } from "./stackInit";

/** Un système de fichiers en mémoire : chemins, contenus, propriétaires. */
function memoryFs(initial: Record<string, { uid?: number; content?: string }> = {}) {
  const nodes = new Map(Object.entries(initial).map(([p, n]) => [p, { uid: n.uid ?? 0, gid: n.uid ?? 0, content: n.content }]));
  const fs: StackInitFs = {
    exists: (p) => nodes.has(p),
    mkdir: (p) => void nodes.set(p, { uid: 0, gid: 0, content: undefined }),
    writeSecret: (p, v) => {
      if (nodes.has(p)) throw new Error("EEXIST");
      nodes.set(p, { uid: 0, gid: 0, content: v });
    },
    chown: (p, uid, gid) => {
      const n = nodes.get(p)!;
      n.uid = uid;
      n.gid = gid;
    },
  };
  return { fs, nodes };
}

const quiet = () => {};

describe("service init des piles Docker", () => {
  it("génère les deux secrets de la base une seule fois", () => {
    const { fs, nodes } = memoryFs({ "/run/tentacle-secrets": {} });
    runStackInit({}, fs, quiet);
    const first = nodes.get("/run/tentacle-secrets/db_password")?.content;
    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(nodes.get("/run/tentacle-secrets/db_root_password")?.content).toMatch(/^[A-Za-z0-9_-]{43}$/);
    runStackInit({}, fs, quiet);
    expect(nodes.get("/run/tentacle-secrets/db_password")?.content).toBe(first);
  });

  it("crée films et series au propriétaire choisi, sans toucher à ce qui existe", () => {
    const { fs, nodes } = memoryFs({ "/media": {}, "/media/films": { uid: 1234 } });
    runStackInit({ PUID: "1001", PGID: "1002" }, fs, quiet);
    expect(nodes.get("/media/films")).toMatchObject({ uid: 1234 });
    expect(nodes.get("/media/series")).toMatchObject({ uid: 1001, gid: 1002 });
  });

  it("suit TENTACLE_MEDIA_SUBDIRS, et ne fait rien sans volumes montés", () => {
    const { fs, nodes } = memoryFs({ "/media": {} });
    runStackInit({ TENTACLE_MEDIA_SUBDIRS: "films, animes ,," }, fs, quiet);
    expect([...nodes.keys()].sort()).toEqual(["/media", "/media/animes", "/media/films"]);
    const empty = memoryFs({});
    runStackInit({}, empty.fs, quiet);
    expect(empty.nodes.size).toBe(0);
  });

  it("retombe sur 1000 quand PUID ou PGID ne sont pas des nombres", () => {
    const { fs, nodes } = memoryFs({ "/media": {} });
    runStackInit({ PUID: "abc", PGID: "-4" }, fs, quiet);
    expect(nodes.get("/media/films")).toMatchObject({ uid: 1000, gid: 1000 });
  });

  it("des secrets tous différents", () => {
    const seen = new Set(Array.from({ length: 50 }, () => newSecret()));
    expect(seen.size).toBe(50);
  });
});
