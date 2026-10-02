/**
 * L'ouvrier yt-dlp contre un FAUX zipapp : un paquet `yt_dlp` minimal, préfixé
 * d'un shebang comme l'officiel, joué par le vrai Python du poste — le
 * programme de l'ouvrier et son protocole sont donc éprouvés pour de bon.
 */
import { execFileSync } from "child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { isZipapp, stopYtWorker, workerExtract } from "./ytWorker";

const hasPython = (() => {
  try {
    execFileSync("python3", ["--version"]);
    return true;
  } catch {
    return false;
  }
})();

const FAKE_YT_DLP = `
from . import version
import time
class YoutubeDL:
    def __init__(self, opts):
        self.opts = opts
    def __enter__(self):
        return self
    def __exit__(self, *exc):
        return False
    def extract_info(self, url, download=False):
        if url.endswith("slow"):
            time.sleep(5)
        if url.endswith("gone"):
            self.opts["logger"].error("ERROR: [youtube] gone: Video unavailable. This video has been removed by the uploader")
            raise Exception("Video unavailable")
        clients = self.opts["extractor_args"]["youtube"]["player_client"]
        return {"formats": [{"format_id": "270", "protocol": "m3u8_native", "vcodec": "avc1.640028", "acodec": "none",
                             "height": 1080, "manifest_url": "https://m.test/master.m3u8?" + ",".join(clients),
                             "http_headers": {"User-Agent": "UA", "Accept": "x"}, "fragments": [1, 2]}]}
`;

let zipapp = "";
let script = "";

beforeAll(() => {
  if (!hasPython) return;
  const dir = mkdtempSync(join(tmpdir(), "ytworker-"));
  const zip = join(dir, "yt.zip");
  execFileSync("python3", ["-c", [
    "import sys, zipfile",
    "z = zipfile.ZipFile(sys.argv[1], 'w')",
    "z.writestr('yt_dlp/__init__.py', sys.argv[2])",
    "z.writestr('yt_dlp/version.py', \"__version__ = 'test'\\n\")",
    "z.close()",
  ].join("\n"), zip, FAKE_YT_DLP]);
  zipapp = join(dir, "yt-dlp");
  writeFileSync(zipapp, Buffer.concat([Buffer.from("#!/usr/bin/env python3\n"), readFileSync(zip)]));
  script = join(dir, "script");
  writeFileSync(script, "#!/bin/sh\nexec python3 -m yt_dlp \"$@\"\n");
});

afterEach(() => stopYtWorker());

const request = (id: string, clients = ["visionos"]) => ({ url: `https://www.youtube.com/watch?v=${id}`, clients, ejs: false });

describe.skipIf(!hasPython)("ouvrier yt-dlp", () => {
  it("reconnaît le zipapp officiel, pas un script", () => {
    expect(isZipapp(zipapp)).toBe(true);
    expect(isZipapp(script)).toBe(false);
    expect(isZipapp(join(tmpdir(), "absent-yt-dlp"))).toBe(false);
  });

  it("rend les formats, réduits aux champs du choix, pour les clients demandés", async () => {
    const outcome = await workerExtract(zipapp, request("Way9Dexny3w", ["visionos", "web"]), 15_000);
    expect(outcome?.formats).toEqual([{
      format_id: "270", protocol: "m3u8_native", vcodec: "avc1.640028", acodec: "none", height: 1080,
      manifest_url: "https://m.test/master.m3u8?visionos,web", http_headers: { "User-Agent": "UA" },
    }]);
  });

  it("sert plusieurs extractions à la fois, et rend l'erreur de yt-dlp", async () => {
    const [ok, gone] = await Promise.all([
      workerExtract(zipapp, request("Way9Dexny3w"), 15_000),
      workerExtract(zipapp, request("gone"), 15_000),
    ]);
    expect(ok?.formats).toHaveLength(1);
    expect(gone?.formats).toEqual([]);
    expect(gone?.stderr).toContain("has been removed");
  });

  it("cède à la ligne de commande sans zipapp, ou quand l'extraction s'éternise", async () => {
    expect(await workerExtract(script, request("Way9Dexny3w"), 15_000)).toBeNull();
    expect(await workerExtract(zipapp, request("slow"), 1_000)).toBeNull();
    // L'ouvrier coincé a été arrêté ; le suivant repart d'un processus neuf.
    expect((await workerExtract(zipapp, request("Way9Dexny3w"), 15_000))?.formats).toHaveLength(1);
  });
});
