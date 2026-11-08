// Le faux flux de mise à jour du banc : clé de TEST, copies de l'app aux bonnes versions,
// archive, manifeste signé, et un serveur Node sur 127.0.0.1. Rien ne quitte la machine,
// rien n'est commité : tout vit dans $TENTACLE_CEF_CACHE/update-test/.
import { execFileSync } from "node:child_process";
import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, sign } from "node:crypto";
import { createReadStream, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import http from "node:http";
import { homedir } from "node:os";
import path from "node:path";

export const CACHE = process.env.TENTACLE_CEF_CACHE || path.join(homedir(), ".cache/tentacle-cef");
export const DIR = path.join(CACHE, "update-test");
export const BASE_VERSION = "1.0.0";

// Ce que publie chaque gravité : version, notes, raison (obligatoire).
export const RELEASES = {
  minor: { version: "1.0.1", notes: { fr: "• Corrections de stabilité", en: "• Stability fixes" } },
  major: {
    version: "1.1.0",
    notes: {
      fr: "• Nouvel accueil plus rapide\n• Octave : files d'attente partagées\n• Sous-titres plus lisibles en HDR",
      en: "• Faster new home\n• Octave: shared queues\n• More legible subtitles in HDR",
    },
  },
  critical: {
    version: "1.0.2",
    notes: { fr: "• Correctif de sécurité", en: "• Security fix" },
    reason: {
      fr: "Cette version corrige une faille qui permettait à une page piégée de lire vos jetons de connexion. Elle est obligatoire.",
      en: "This version fixes a flaw that let a crafted page read your sign-in tokens. It is mandatory.",
    },
  },
};

const sh = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: ["ignore", "pipe", "pipe"], ...opts }).toString();

// La clé de TEST (générée une fois, jamais dans le dépôt, lisible par vous seul).
export function testKey() {
  const file = path.join(DIR, "test-key.json");
  mkdirSync(DIR, { recursive: true });
  if (!existsSync(file)) {
    const { privateKey } = generateKeyPairSync("ed25519");
    writeFileSync(file, JSON.stringify({ privateKeyPem: privateKey.export({ type: "pkcs8", format: "pem" }) }), { mode: 0o600 });
  }
  const priv = createPrivateKey(JSON.parse(readFileSync(file, "utf8")).privateKeyPem);
  const raw = Buffer.from(createPublicKey(priv).export({ format: "jwk" }).x, "base64url");
  return { priv, publicKey: raw.toString("base64") };
}

// Une copie de l'app à la version voulue (clone APFS, Info.plist, signature ad hoc du paquet).
// `broken` : l'exécutable principal est remplacé par un programme qui s'arrête aussitôt.
export function appCopy(src, dst, version, { broken = false } = {}) {
  rmSync(dst, { recursive: true, force: true });
  mkdirSync(path.dirname(dst), { recursive: true });
  sh("cp", ["-cR", src, dst]);
  const plist = path.join(dst, "Contents/Info.plist");
  sh("/usr/libexec/PlistBuddy", ["-c", `Set :CFBundleShortVersionString ${version}`, "-c", `Set :CFBundleVersion ${version}`, plist]);
  if (broken) {
    const c = path.join(DIR, "crash.c");
    writeFileSync(c, "#include <stdio.h>\nint main(void) { fputs(\"version cassée du banc\\n\", stderr); return 3; }\n");
    sh("clang", ["-O2", "-o", path.join(dst, "Contents/MacOS/Tentacle"), c]);
  }
  sh("codesign", ["--force", "--sign", "-", "--timestamp=none", dst]);
  return dst;
}

function sha256(file) {
  const h = createHash("sha256");
  h.update(readFileSync(file));
  return h.digest("hex");
}

// Archive .tar.xz de la nouvelle version (gardée tant que l'app construite ne change pas).
export function archive(appSrc, severity, { broken = false } = {}) {
  const { version } = RELEASES[severity];
  const name = `Tentacle-${version}${broken ? "-broken" : ""}-macos-arm64.tar.xz`;
  const out = path.join(DIR, "feed", name);
  const stamp = statSync(path.join(appSrc, "Contents/MacOS/Tentacle")).mtimeMs;
  if (existsSync(out) && statSync(out).mtimeMs > stamp) return { name, file: out };
  const next = appCopy(appSrc, path.join(DIR, "work", `next-${version}`, "Tentacle.app"), version, { broken });
  mkdirSync(path.dirname(out), { recursive: true });
  console.log(`[flux] archive ${name} (xz, ~10 s)…`);
  sh("tar", ["--options", "xz:compression-level=0", "-cJf", out, "-C", path.dirname(next), "Tentacle.app"]);
  rmSync(path.dirname(next), { recursive: true, force: true });
  return { name, file: out };
}

// Le manifeste, signé dans son enveloppe (format décrit dans docs/MISE-A-JOUR.md).
export function envelope(key, severity, port, file, name) {
  const r = RELEASES[severity];
  const manifest = JSON.stringify({
    version: r.version, channel: "stable", severity, issuedAt: Math.floor(Date.now() / 1000),
    notes: r.notes, ...(r.reason ? { reason: r.reason } : {}),
    notesUrl: `http://127.0.0.1:${port}/notes.html`,
    assets: { "macos-arm64": { url: `http://127.0.0.1:${port}/archives/${name}`, sha256: sha256(file), size: statSync(file).size } },
  }, null, 2);
  const signature = sign(null, Buffer.from(manifest, "utf8"), key.priv).toString("base64");
  return JSON.stringify({ format: 1, keyId: "test", manifest, signature });
}

// Le serveur : /stable.json, /archives/<nom> (débit limité pour voir la progression ;
// `cutFirst` coupe le premier téléchargement en route = réseau perdu), /notes.html.
export function serve({ port, feedJson, archiveFile, archiveName, rate = 25e6, cutFirst = false, log = console.log }) {
  let cut = cutFirst;
  const server = http.createServer((req, res) => {
    log(`[flux] ${req.method} ${req.url}`);
    if (req.url === "/stable.json") {
      res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
      return res.end(feedJson);
    }
    if (req.url === `/archives/${archiveName}`) {
      const size = statSync(archiveFile).size;
      res.writeHead(200, { "content-type": "application/x-xz", "content-length": size });
      const stream = createReadStream(archiveFile, { highWaterMark: 1 << 20 });
      let sent = 0;
      const start = Date.now();
      stream.on("data", (chunk) => {
        sent += chunk.length;
        if (cut && sent > size * 0.2) {
          cut = false;
          log("[flux] coupure simulée du réseau");
          stream.destroy();
          return req.socket.destroy();
        }
        res.write(chunk);
        const ahead = sent / rate * 1000 - (Date.now() - start);  // débit limité
        if (ahead > 0) { stream.pause(); setTimeout(() => stream.resume(), ahead); }
      });
      stream.on("end", () => res.end());
      return;
    }
    if (req.url === "/notes.html") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      return res.end("<!doctype html><meta charset=utf-8><title>Nouveautés</title><h1>Nouveautés (banc)</h1>");
    }
    res.writeHead(404).end();
  });
  return new Promise((ok) => server.listen(port, "127.0.0.1", () => ok(server)));
}
