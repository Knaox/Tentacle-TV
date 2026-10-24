import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { execFileSync } from "child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { connect, type Socket } from "net";
import { join } from "path";
import { tmpdir } from "os";
import { spawnWorker, stopAllWorkers, stopWorker } from "./toolWorkers";

/**
 * L'ouvrier persistant d'une extension (`tools.spawnWorker`) : un VRAI Python,
 * le programme de l'HÔTE sous son amorçage, et un faux zipapp de yt-dlp (un
 * `yt_dlp` minimal, zippé comme le vrai). Le protocole fermé de bout en bout
 * (version, extract, download avec avancement, refus de l'hôte), la garde de
 * l'amorçage, la relance après une mort. Sans `python3` : sauté.
 */

const root = join(tmpdir(), `tentacle-worker-test-${process.pid}`);
const hasPython = (() => {
  try {
    execFileSync("python3", ["--version"]);
    return true;
  } catch {
    return false;
  }
})();

// Le faux zipapp existe AVANT le chargement de services/ytDlp.ts, qui choisit alors celui-ci (l'« épinglé »).
// `vi.hoisted` passe avant les imports, mais SYNCHRONE (le backend est CommonJS : pas d'`await` de premier
// niveau) : les modules de Node viennent donc de `process.getBuiltinModule`, sans `import`.
vi.hoisted(() => {
  const { join: j } = process.getBuiltinModule("path");
  const { tmpdir: t } = process.getBuiltinModule("os");
  const { mkdirSync: mk, writeFileSync: wr } = process.getBuiltinModule("fs");
  const { execFileSync: run } = process.getBuiltinModule("child_process");
  const dir = j(t(), `tentacle-worker-test-${process.pid}`);
  const src = j(dir, "zipsrc");
  process.env.TENTACLE_YTDLP_PINNED = j(dir, "yt-dlp");
  const secret = JSON.stringify(j(dir, "tentacle.db"));
  try {
    mk(j(src, "yt_dlp"), { recursive: true });
    wr(j(src, "yt_dlp", "version.py"), "__version__ = '2099.01.01'\n");
    wr(j(src, "yt_dlp", "utils.py"), "class DownloadCancelled(Exception):\n    pass\n");
    wr(j(src, "yt_dlp", "__init__.py"), [
      "from . import version, utils",
      "CREATED = [0]",
      "class YoutubeDL:",
      "    def __init__(self, opts):",
      "        self.opts = self.params = opts",
      "        CREATED[0] += 1",
      "        self.serial = CREATED[0]",
      "    def __enter__(self): return self",
      "    def __exit__(self, *a): return False",
      "    def close(self): pass",
      "    def extract_info(self, target, download=False):",
      `        if 'evil' in target: open(${secret}).read()`,
      "        if 'boom' in target: raise RuntimeError('panne')",
      "        if 'leak' in target: raise RuntimeError('args ' + repr(self.params.get('extractor_args')))",
      "        if 'serial' in target: return {'id': str(self.serial), 'formats': []}",
      "        return {'id': 'v1', 'title': 'T', 'artists': ['A'], 'duration': 61.5, 'formats': [{'format_id': '251', 'ext': 'webm', 'acodec': 'opus', 'abr': 130.5, 'url': 'https://x/' + 'a' * 1100, 'http_headers': {'User-Agent': 'UA'}}], 'raw_secret_field': 'jamais'}",
      "    def download(self, urls):",
      "        out = self.opts['outtmpl']['default']",
      "        with open(out, 'wb') as f:",
      "            for i in range(4):",
      "                f.write(b'x' * 300000)",
      "                for h in self.opts['progress_hooks']: h({'status': 'downloading', 'downloaded_bytes': (i + 1) * 300000, 'total_bytes': 1200000})",
    ].join("\n") + "\n");
    wr(j(src, "__main__.py"), "print('yt-dlp')\n");
    run("python3", ["-m", "zipapp", src, "-o", j(dir, "yt-dlp"), "-p", "/usr/bin/env python3"]);
  } catch {
    // Sans python3 : les tests sont sautés.
  }
});

const dataDir = join(root, "plugins", "w-test", "data");
const ctx = {
  pluginId: "w-test",
  manifest: { kind: "isolated" as const, entry: "x.mjs", tools: ["yt-dlp" as const], hostApi: ["tools" as const] },
  pluginDir: join(root, "plugins", "w-test"),
  dataDir,
};

type Msg = Record<string, unknown>;

/** Une connexion à l'ouvrier : chaque requête rend les messages reçus jusqu'à sa réponse finale. */
function session(socketPath: string): { ask: (req: Msg) => Promise<Msg[]>; close: () => void } {
  const socket: Socket = connect(socketPath);
  socket.setEncoding("utf8");
  let buffer = "";
  const waiting = new Map<number, { seen: Msg[]; done: (all: Msg[]) => void }>();
  socket.on("data", (chunk: string) => {
    buffer += chunk;
    for (let nl = buffer.indexOf("\n"); nl >= 0; nl = buffer.indexOf("\n")) {
      const msg = JSON.parse(buffer.slice(0, nl)) as Msg;
      buffer = buffer.slice(nl + 1);
      const w = waiting.get(msg.id as number);
      if (!w) continue;
      w.seen.push(msg);
      if ("ok" in msg) w.done(w.seen);
    }
  });
  return {
    ask: (req) => new Promise((done) => {
      waiting.set(req.id as number, { seen: [], done });
      socket.write(`${JSON.stringify(req)}\n`);
    }),
    close: () => socket.end(),
  };
}

beforeAll(() => {
  if (!hasPython) return;
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(join(root, "tentacle.db"), "BASE SECRÈTE");
});
afterAll(() => stopAllWorkers());

describe.skipIf(!hasPython)("ouvrier persistant fourni par l'hôte", () => {
  it("version, extract (champs choisis), download tel quel avec avancement", async () => {
    const { socketPath, workerId } = await spawnWorker(ctx, "yt-dlp", "probe");
    expect(workerId).toBe("w-test-probe");
    const s = session(socketPath);
    expect(await s.ask({ id: 1, op: "version" })).toEqual([{ id: 1, ok: true, result: { version: "2099.01.01" } }]);
    const [extract] = await s.ask({ id: 2, op: "extract", target: "https://music.youtube.com/watch?v=abc", options: { flat: true, limit: 5 } });
    const info = (extract.result ?? {}) as Msg;
    expect(info).toMatchObject({ id: "v1", title: "T", artists: ["A"], durationS: 61.5, formats: [{ formatId: "251", acodec: "opus", abr: 130.5, httpHeaders: { "User-Agent": "UA" } }] });
    // Une URL directe réelle dépasse 1 000 caractères : rendue ENTIÈRE, jamais tronquée.
    expect((info as { formats: { url: string }[] }).formats[0].url).toBe(`https://x/${"a".repeat(1100)}`);
    expect(info.raw_secret_field).toBeUndefined();
    const download = await s.ask({ id: 3, op: "download", url: "https://www.youtube.com/watch?v=abc", formatId: "251", output: "cache/v1.webm" });
    expect(download.filter((m) => m.event === "progress").length, JSON.stringify(download)).toBeGreaterThanOrEqual(3);
    expect(download.at(-1)).toEqual({ id: 3, ok: true, result: { path: "cache/v1.webm", bytes: 1_200_000 } });
    expect(readFileSync(join(dataDir, "cache", "v1.webm")).length).toBe(1_200_000);
    s.close();
  }, 20_000);

  it("l'hôte refuse avant Python : option hors liste, cible hors contrat, sortie hors des données", async () => {
    const { socketPath } = await spawnWorker(ctx, "yt-dlp", "probe");
    const s = session(socketPath);
    const refused: [number, Msg][] = [
      [10, { op: "extract", target: "https://youtube.com/x", options: { exec: "id" } }],
      [11, { op: "extract", target: "file:///etc/passwd" }],
      [12, { op: "download", url: "https://youtube.com/x", formatId: "251", output: "../../tentacle.db" }],
      [13, { op: "download", url: "https://youtube.com/x", formatId: "251", output: "evil.so" }],
      [14, { op: "download", url: "https://youtube.com/x", formatId: "251", output: "%(title)s.webm" }],
    ];
    for (const [id, req] of refused) {
      expect(await s.ask({ id, ...req }), String(id)).toEqual([{ id, ok: false, error: { code: "invalid", message: expect.any(String) } }]);
    }
    expect(existsSync(join(dataDir, "evil.so"))).toBe(false);
    s.close();
  });

  it("youtube.visitor_data : une valeur bornée passe, jamais recopiée dans un message ; le reste garde 100 caractères", async () => {
    const { socketPath } = await spawnWorker(ctx, "yt-dlp", "probe");
    const s = session(socketPath);
    const visitor = `Cgt${"x".repeat(440)}%3D%3D`;
    const args = (youtube: Record<string, string[]>) => ({ op: "extract", target: "https://www.youtube.com/watch?v=leak", options: { extractorArgs: { youtube } } });
    const refused: [number, Msg][] = [
      [50, args({ visitor_data: [visitor, visitor] })],
      [51, args({ visitor_data: ["A".repeat(1025)] })],
      [52, args({ visitor_data: ["Cgt abc def ghi jkl mno"] })],
      [53, args({ visitor_data: ["Cgt\nabcdefghijklmnopqrstu"] })],
      [54, args({ player_client: ["v".repeat(101)] })],
      [55, { op: "extract", target: "https://www.youtube.com/watch?v=leak", options: { extractorArgs: { other: { visitor_data: [visitor] } } } }],
    ];
    for (const [id, req] of refused) {
      const [reply] = await s.ask({ id, ...req });
      expect(reply, String(id)).toEqual({ id, ok: false, error: { code: "invalid", message: "requête refusée par l'hôte" } });
    }
    const [passed] = await s.ask({ id: 56, ...args({ visitor_data: [visitor], player_skip: ["webpage", "configs"] }) });
    // Arrivée jusqu'à yt-dlp (le faux la recopie dans son erreur) : la réponse ne la porte plus.
    expect(passed).toMatchObject({ id: 56, ok: false, error: { code: "failed" } });
    const message = String((passed.error as { message: string }).message);
    expect(message).toContain("[visitor_data]");
    expect(message).not.toContain(visitor);
    s.close();
  });

  it("le programme de l'hôte reste sous la garde de l'amorçage (tentacle.db illisible)", async () => {
    const { socketPath } = await spawnWorker(ctx, "yt-dlp", "probe");
    const s = session(socketPath);
    const [reply] = await s.ask({ id: 20, op: "extract", target: "https://www.youtube.com/watch?v=evil" });
    expect(reply).toMatchObject({ id: 20, ok: false, error: { code: "failed" } });
    expect(String((reply.error as { message: string }).message)).toContain("lecture refusée");
    s.close();
  });

  it("extract reprend l'instance gardée pour les mêmes options, jamais celle d'un échec", async () => {
    const { socketPath, workerId } = await spawnWorker(ctx, "yt-dlp", "keep");
    const s = session(socketPath);
    const serial = async (id: number, options?: Msg, target = "https://www.youtube.com/watch?v=serial") =>
      ((await s.ask({ id, op: "extract", target, ...(options ? { options } : {}) }))[0].result as { id: string } | undefined)?.id;
    const music = { extractorArgs: { youtube: { player_client: ["visionos"] } } };
    const first = await serial(40, music);
    expect(await serial(41, music)).toBe(first);
    const other = await serial(42, { flat: true });
    expect(other).not.toBe(first);
    expect(await serial(43, music)).toBe(first);
    const [failed] = await s.ask({ id: 44, op: "extract", target: "https://www.youtube.com/watch?v=boom", options: music });
    expect(failed).toMatchObject({ ok: false, error: { code: "failed" } });
    // L'instance de l'échec est jetée : la suivante est neuve.
    const after = await serial(45, music);
    expect(after).not.toBe(first);
    expect(after).not.toBe(other);
    s.close();
    // Arrêté : le test de relance ci-dessous ne doit trouver que l'ouvrier « probe ».
    stopWorker("w-test", workerId);
  });

  it("un ouvrier mort est relancé, la socket reste la même", async () => {
    const { socketPath } = await spawnWorker(ctx, "yt-dlp", "probe");
    // Seul l'interpréteur de l'ouvrier porte ce dossier de test dans ses arguments.
    const pid = Number(execFileSync("pgrep", ["-f", dataDir]).toString().trim().split("\n")[0]);
    expect(pid).toBeGreaterThan(0);
    process.kill(pid, "SIGKILL");
    await new Promise((r) => setTimeout(r, 1_500));
    const s = session(socketPath);
    expect(await s.ask({ id: 30, op: "version" })).toEqual([{ id: 30, ok: true, result: { version: "2099.01.01" } }]);
    s.close();
  }, 15_000);
});
