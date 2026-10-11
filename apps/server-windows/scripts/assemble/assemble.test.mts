import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { parseAssembleArgs } from "./args.mts";
import { quoteArg } from "./build.mts";
import { SERVER_COPIES, dockerServerSources } from "./layout.mts";
import { partOf } from "./measure.mts";
import { dockerArg, shasumOf, ytDlpPin } from "./pins.mts";
import { SUBSYSTEM, readSubsystem, setSubsystem } from "./peSubsystem.mts";
import { isDeadDir, isDeadFile, keepsPrismaClientFile, pruneNodeModules } from "./prune.mts";

const repo = resolve(import.meta.dirname, "..", "..", "..", "..");
const dockerfile = readFileSync(join(repo, "Dockerfile"), "utf8");

describe("plan de /app", () => {
  it("reprend chaque COPY --from=base de l'étape « server » du Dockerfile, rien de plus", () => {
    expect(SERVER_COPIES.map((step) => step.from).sort()).toEqual(dockerServerSources(dockerfile).sort());
  });
});

describe("épingles", () => {
  it("yt-dlp suit le Dockerfile, version et empreinte", () => {
    const pin = ytDlpPin(dockerfile);
    expect(pin.version).toBe(dockerArg(dockerfile, "YTDLP_VERSION"));
    expect(pin.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(pin.url).toContain(`/download/${pin.version}/yt-dlp`);
  });

  it("lit une empreinte de SHASUMS256.txt, et seulement celle du fichier demandé", () => {
    const text = `${"a".repeat(64)}  node-v24.21.0-win-x86.zip\n${"B".repeat(64)}  node-v24.21.0-win-x64.zip\n`;
    expect(shasumOf(text, "node-v24.21.0-win-x64.zip")).toBe("b".repeat(64));
    expect(shasumOf(text, "node-v24.21.0-win-arm64.zip")).toBeNull();
  });
});

describe("sous-système PE", () => {
  function fakePe(magic: number): Buffer {
    const image = Buffer.alloc(0x200);
    image.writeUInt16LE(0x5a4d, 0);
    image.writeUInt32LE(0x80, 0x3c);
    image.writeUInt32LE(0x00004550, 0x80);
    image.writeUInt16LE(magic, 0x80 + 24);
    image.writeUInt16LE(SUBSYSTEM.CONSOLE, 0x80 + 24 + 68);
    return image;
  }

  it("passe un exe console en GUI, en PE32+ comme en PE32", () => {
    for (const magic of [0x20b, 0x10b]) {
      const image = fakePe(magic);
      expect(setSubsystem(image, SUBSYSTEM.GUI)).toBe(SUBSYSTEM.CONSOLE);
      expect(readSubsystem(image)).toBe(SUBSYSTEM.GUI);
    }
  });

  it("refuse ce qui n'est pas un exécutable", () => {
    expect(() => readSubsystem(Buffer.from("pas un exe, pas un exe, pas un exe, pas un exe, pas un exe, pas un exe"))).toThrow();
  });
});

describe("élagage (jumeau de prune-node-modules.sh)", () => {
  let dir = "";
  afterEach(() => {
    if (dir !== "") rmSync(dir, { recursive: true, force: true });
  });

  it("garde les moteurs Prisma de Windows ET de Linux, et le client généré", () => {
    for (const name of ["query_engine-windows.dll.node", "libquery_engine-debian-openssl-3.0.x.so.node", "index.js", "default.js", "schema.prisma"]) {
      expect(keepsPrismaClientFile(name)).toBe(true);
    }
    for (const name of ["index.d.ts", "wasm.js", "edge.js", "query_engine_bg.wasm"]) expect(keepsPrismaClientFile(name)).toBe(false);
  });

  it("retire cartes, types, docs et tests, jamais une licence", () => {
    for (const name of ["a.js.map", "index.d.ts", "README.md", "CHANGELOG", "History.md", "tsconfig.build.json", ".npmignore"]) {
      expect(isDeadFile(name)).toBe(true);
    }
    for (const name of ["LICENSE.md", "license", "NOTICE.md", "COPYING", "index.js", "package.json"]) expect(isDeadFile(name)).toBe(false);
    expect(isDeadDir("__tests__")).toBe(true);
    expect(isDeadDir("lib")).toBe(false);
  });

  it("élague un arbre réel en gardant ce que Node charge", () => {
    dir = mkdtempSync(join(tmpdir(), "prune-"));
    const files: Record<string, string> = {
      ".prisma/client/query_engine-windows.dll.node": "x",
      ".prisma/client/index.js": "x",
      ".prisma/client/wasm.js": "x",
      "@prisma/client/runtime/library.js": "x",
      "@prisma/client/runtime/edge.js": "x",
      "@prisma/engines/index.js": "x",
      "fastify/LICENSE": "x",
      "fastify/fastify.js": "x",
      "fastify/fastify.d.ts": "x",
      "fastify/test/a.js": "x",
    };
    for (const [path, content] of Object.entries(files)) {
      mkdirSync(join(dir, path, ".."), { recursive: true });
      writeFileSync(join(dir, path), content);
    }
    pruneNodeModules(dir);
    const kept = Object.keys(files).filter((path) => existsSync(join(dir, path)));
    expect(kept.sort()).toEqual(
      [".prisma/client/query_engine-windows.dll.node", ".prisma/client/index.js", "@prisma/client/runtime/library.js", "fastify/LICENSE", "fastify/fastify.js"].sort(),
    );
  });
});

describe("options", () => {
  it("lit le contrat du fil E et tolère le « -- » de pnpm", () => {
    const options = parseAssembleArgs(["--", "--out", "out", "--version", "1.0.0.0", "--tv-client", "tv"], repo);
    expect(options.version).toBe("1.0.0.0");
    expect(options.tvClient).toBe(resolve("tv"));
    expect(options.skipBuild).toBe(false);
    expect(options.jellyfinInstaller).toBe(true);
    expect(parseAssembleArgs(["--out", "o", "--version", "1.0.0.0", "--no-jellyfin-installer"], repo).jellyfinInstaller).toBe(false);
    expect(options.identity.publisher).toBe("CN=Tentacle Server Dev");
  });

  it("refuse une version que le Store refuserait", () => {
    expect(() => parseAssembleArgs(["--out", "o", "--version", "1.0.0"], repo)).toThrow();
    expect(() => parseAssembleArgs(["--out", "o", "--version", "1.0.0.3"], repo)).toThrow();
    expect(() => parseAssembleArgs(["--out", "o", "--version", "1.0.0.0", "--bogus"], repo)).toThrow();
  });
});

describe("petits outils", () => {
  it("cite un chemin à espace pour cmd.exe, laisse une option nue", () => {
    expect(quoteArg("--prod")).toBe("--prod");
    expect(quoteArg("C:\\a b\\deploy")).toBe('"C:\\a b\\deploy"');
    expect(() => quoteArg('a"b')).toThrow();
  });

  it("range chaque fichier dans son poste", () => {
    expect(partOf(join("node_modules", ".prisma", "client", "x.node"))).toBe("node_modules/.prisma");
    expect(partOf(join("apps", "web", "dist", "index.html"))).toBe("apps/web");
    expect(partOf("Tentacle Server.exe")).toBe("Tentacle Server.exe");
  });
});
