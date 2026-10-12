import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { afterEach, describe, expect, it } from "vitest";
import { downloadVerified, type BodyFetcher } from "./download";
import { JellyfinInstaller, type InstallerDeps } from "./installer";
import { installerUrl, parseMirrorlist, parseSha256, resolveInstaller, type FetchText } from "./repo";
import { pickInstallVersion, repoNamesFor } from "./versionPick";

const MANIFEST = {
  versions: [
    { version: "10.10.7", verdict: "ok" },
    { version: "12.1.0", verdict: "ok" },
    { version: "12.2.0", verdict: "partial" },
    { version: "12.3.0-rc1", verdict: "ok" },
  ],
};

describe("version à installer", () => {
  it("la plus récente notée « ok », jamais une pré-version ni un verdict partiel", () => {
    expect(pickInstallVersion(MANIFEST)).toEqual({ version: "12.1.0", repoNames: ["12.1", "12.1.0"] });
    expect(pickInstallVersion({ versions: [{ version: "12.1", verdict: "ok" }] })?.version).toBe("12.1.0");
    expect(pickInstallVersion({ versions: [] })).toBeNull();
    expect(pickInstallVersion(null)).toBeNull();
    expect(repoNamesFor([10, 11, 11])).toEqual(["10.11.11"]);
  });
});

const SHA = "28e11b817b3410c860733591fbb88b9248b8d0b31cf2793b65ce0588cffe3da3";
const MIRRORLIST = `The file <b>/x.exe</b> has a size of 198.7 MB (208318088 bytes) and was last modified…
<tr><td>SHA256</td><td style="font-family: monospace;">${SHA}</td></tr>`;

describe("dépôt de Jellyfin", () => {
  it("lit l'empreinte et la taille sur l'origine", () => {
    expect(parseSha256(`${SHA}  jellyfin_12.1_windows-x64.exe`)).toBe(SHA);
    expect(parseMirrorlist(MIRRORLIST)).toEqual({ size: 208318088, sha256: SHA });
    expect(installerUrl("https://r/stable", "12.1")).toBe("https://r/stable/v12.1/amd64/jellyfin_12.1_windows-x64.exe");
  });

  it("essaie le nom suivant sur un 404, et refuse une page miroir qui contredit l'empreinte", async () => {
    const asked: string[] = [];
    const fetchText = (pages: Record<string, string>): FetchText => async (url) => {
      asked.push(url);
      return url in pages ? { status: 200, text: pages[url] ?? "" } : { status: 404, text: "" };
    };
    const url = installerUrl("https://r", "12.1.0");
    const ok = await resolveInstaller(fetchText({ [`${url}?sha256`]: SHA, [`${url}?mirrorlist`]: MIRRORLIST }), "https://r", ["12.1", "12.1.0"]);
    expect(ok).toEqual({ ok: true, installer: { repoName: "12.1.0", url, sha256: SHA, size: 208318088 } });
    expect(asked[0]).toContain("v12.1/");
    const lying = await resolveInstaller(fetchText({ [`${url}?sha256`]: "a".repeat(64), [`${url}?mirrorlist`]: MIRRORLIST }), "https://r", ["12.1.0"]);
    expect(lying).toEqual({ ok: false, failure: "checksum" });
    expect(await resolveInstaller(fetchText({}), "https://r", ["12.1"])).toEqual({ ok: false, failure: "no_version" });
    expect(await resolveInstaller(async () => Promise.reject(new Error("dns")), "https://r", ["12.1"])).toEqual({ ok: false, failure: "network" });
  });
});

describe("téléchargement vérifié", () => {
  let dir = "";
  let server: Server | null = null;
  afterEach(() => {
    server?.close();
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  const payload = Buffer.from("MZ".padEnd(5000, "x"));
  const sha = createHash("sha256").update(payload).digest("hex");
  const fromBuffer: BodyFetcher = async () => ({ status: 200, body: Readable.from([payload.subarray(0, 2000), payload.subarray(2000)]) });

  it("le fichier ne prend son nom qu'une fois vérifié", async () => {
    dir = mkdtempSync(join(tmpdir(), "tt-dl-"));
    const file = join(dir, "setup.exe");
    const seen: number[] = [];
    expect(await downloadVerified(fromBuffer, "u", file, { sha256: sha, size: payload.length }, (n) => seen.push(n), AbortSignal.timeout(5000))).toEqual({ ok: true });
    expect(readFileSync(file).equals(payload)).toBe(true);
    expect(seen.at(-1)).toBe(payload.length);
  });

  it("une empreinte, une taille ou un dépassement faux effacent tout", async () => {
    dir = mkdtempSync(join(tmpdir(), "tt-dl-"));
    const file = join(dir, "setup.exe");
    const signal = AbortSignal.timeout(5000);
    expect(await downloadVerified(fromBuffer, "u", file, { sha256: "0".repeat(64), size: null }, () => undefined, signal)).toEqual({ ok: false, failure: "checksum" });
    expect(await downloadVerified(fromBuffer, "u", file, { sha256: sha, size: 10 }, () => undefined, signal)).toEqual({ ok: false, failure: "checksum" });
    expect(existsSync(file) || existsSync(`${file}.part`)).toBe(false);
  });

  it("par HTTP pour de vrai : une réponse 404 est une erreur réseau", async () => {
    dir = mkdtempSync(join(tmpdir(), "tt-dl-"));
    server = createServer((req, res) => {
      if (req.url === "/ok") res.end(payload);
      else res.writeHead(404).end();
    });
    await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    const base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
    const { fetchBody } = await import("./download");
    const file = join(dir, "real.exe");
    expect(await downloadVerified(fetchBody, `${base}/ok`, file, { sha256: sha, size: payload.length }, () => undefined, AbortSignal.timeout(5000))).toEqual({ ok: true });
    expect(await downloadVerified(fetchBody, `${base}/missing`, `${file}2`, { sha256: sha, size: null }, () => undefined, AbortSignal.timeout(5000))).toEqual({ ok: false, failure: "network" });
  });
});

function installerDeps(overrides: Partial<InstallerDeps> = {}): InstallerDeps & { launched: string[]; removed: string[] } {
  const launched: string[] = [];
  const removed: string[] = [];
  return {
    arm64: false,
    enabled: true,
    readManifest: () => MANIFEST,
    resolve: async (names) => ({ ok: true, installer: { repoName: names[0] ?? "", url: "https://r/x.exe", sha256: SHA, size: 10 } }),
    download: async (_url, _file, _expected, onProgress) => {
      onProgress(10);
      return { ok: true };
    },
    launch: async (file) => {
      launched.push(file);
      return { ok: true, exitCode: 0 };
    },
    folder: "C:\\data\\cache\\jellyfin-installer",
    ensureFolder: () => undefined,
    remove: (path) => removed.push(path),
    log: () => undefined,
    ...overrides,
    launched,
    removed,
  };
}

async function settle(installer: JellyfinInstaller): Promise<void> {
  for (let i = 0; i < 50 && installer.busy; i++) await new Promise((resolve) => setTimeout(resolve, 5));
}

describe("installation guidée", () => {
  it("ARM64 ou interrupteur coupé : refus d'office, sans rien télécharger", () => {
    expect(new JellyfinInstaller(installerDeps({ arm64: true })).install()).toMatchObject({ phase: "failed", failure: "unsupported_arch" });
    const off = new JellyfinInstaller(installerDeps({ enabled: false }));
    expect(off.offer).toBe("disabled");
    expect(off.install()).toMatchObject({ phase: "failed", failure: "disabled" });
  });

  it("de bout en bout : version, téléchargement, installateur, puis le fichier effacé", async () => {
    const deps = installerDeps();
    const installer = new JellyfinInstaller(deps);
    expect(installer.install().phase).toBe("resolving");
    await settle(installer);
    expect(installer.status()).toEqual({ phase: "done", version: "12.1.0", receivedBytes: 10, totalBytes: 10, failure: null });
    expect(deps.launched[0]).toMatch(/jellyfin_12\.1_windows-x64\.exe$/);
    expect(deps.removed).toEqual(deps.launched);
  });

  it("installé : Jellyfin est démarré avant de dire « fini » ; un échec du démarrage ne fait pas échouer l'installation", async () => {
    const order: string[] = [];
    const ok = new JellyfinInstaller(installerDeps({ afterInstall: async () => (order.push("start"), "Jellyfin démarré"), remove: () => order.push("remove") }));
    ok.install();
    await settle(ok);
    expect(ok.status().phase).toBe("done");
    expect(order).toEqual(["start", "remove"]);
    const failing = new JellyfinInstaller(installerDeps({ afterInstall: async () => Promise.reject(new Error("explorer")) }));
    failing.install();
    await settle(failing);
    expect(failing.status().phase).toBe("done");
    const cancelled = installerDeps({ launch: async () => ({ ok: true, exitCode: 2 }), afterInstall: async () => (order.push("never"), "") });
    const stopped = new JellyfinInstaller(cancelled);
    stopped.install();
    await settle(stopped);
    expect(order).not.toContain("never");
  });

  it("élévation refusée, installateur fermé, empreinte fausse : chacun sa cause", async () => {
    const cases: [Partial<InstallerDeps>, string][] = [
      [{ launch: async () => ({ ok: false, reason: "cancelled", error: 1223 }) }, "cancelled"],
      [{ launch: async () => ({ ok: false, reason: "blocked", error: 4551 }) }, "blocked"],
      [{ launch: async () => ({ ok: true, exitCode: 2 }) }, "cancelled"],
      [{ launch: async () => ({ ok: true, exitCode: 5 }) }, "installer_failed"],
      [{ download: async () => ({ ok: false, failure: "checksum" }) }, "checksum"],
      [{ readManifest: () => ({}) }, "no_version"],
    ];
    for (const [overrides, failure] of cases) {
      const installer = new JellyfinInstaller(installerDeps(overrides));
      installer.install();
      await settle(installer);
      expect(installer.status()).toMatchObject({ phase: "failed", failure });
    }
  });
});
