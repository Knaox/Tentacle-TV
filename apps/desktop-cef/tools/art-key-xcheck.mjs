#!/usr/bin/env node
// Parité des clés du cache des pochettes : la règle d'Electron (artCachePolicy.ts, chargée
// telle quelle par Node) contre celle de CEF (sonde tentacle_art_key_probe). Même clé ⇒ même
// nom de fichier ⇒ Electron et CEF relisent le cache l'un de l'autre.
//   node tools/art-key-xcheck.mjs ~/.cache/tentacle-cef/build/cef-reseau/src/net/tentacle_art_key_probe
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const policy = await import(pathToFileURL(path.resolve(here, "../../desktop-electron/src/main/octaveArt/artCachePolicy.ts")).href);
const probe = process.argv[2];
if (!probe) throw new Error("usage : art-key-xcheck.mjs <sonde>");

const urls = [
  "http://srv:3001/api/music/artwork/abc?tag=t1&size=128&api_key=JETON1",
  "http://127.0.0.1:3471/api/music/artwork/3f2a?tag=9c1e&size=300&api_key=abcdef0123",
  "https://x.test/a.jpg?ApiKey=z",
  "HTTP://SRV:80/a/./b/../c?x=1",
  "https://x.test:443/a b?q=a+b&r=%C3%A9",
  "http://0x7f.1:3001/p",
  "http://x.test:99999/",
  "https://@x.test/a",
  "https://x/a?maxHeight=1&max_width=2&B=3&b=4&1=5",
  "https://coverartarchive.org/release/5f8a/front-250.jpg",
  "https://lastfm.freetls.fastly.net/i/u/300x300/abc.png?x-emby-token=1&token=2&size=3",
  "https://img.test/a.jpg?b=2&a=1&a=0&c=%zz&d=%E2%82%AC&e=é&f=a%2Bb&g==&h",
  "https://img.test/%7Ea/b%2fc/%2e%2E/d?",
  "https://img.test/a?Z=1&z=1&_=1&-=1&.=1&~=1&$=1&0=1&é=1&e=1&E=1",
  "https://user:pw@x.test/a.jpg",
  "file:///etc/passwd",
  "tentacle://local/media/a.jpg",
  "pas une adresse",
  " https://x.test/a\t?b=1 ",
  "https://x.test/a#frag?x=1",
  "https://X.Test/A?TAG=1",
  "http://[::1]:3001/a?tag=1",
  "http://192.168.001.010/a",
  "https://img.test/a?è=1&é=1&ê=1&ë=1&e=1&ç=1&c=1&ñ=1&n=1&o=1&ö=1&Ö=1&ô=1&à=1&a=1&A=1&À=1",
  "https://img.test/art?artist=Beyonc%C3%A9&artist=Beyonce&artist=beyonce&tag=1",
];
const fileOf = (k) => createHash("sha256").update(k).digest("hex").slice(0, 40);
const out = execFileSync(probe, { input: urls.join("\n") + "\n" }).toString().trimEnd().split("\n");
let bad = 0;
urls.forEach((u, i) => {
  const k = policy.artKey(u);
  const want = `${k ?? "-"}\t${k ? fileOf(k) : "-"}`;
  if (out[i] !== want) {
    bad++;
    console.log(`ÉCART  ${JSON.stringify(u)}\n  electron ${want}\n  cef      ${out[i]}`);
  }
});
console.log(bad === 0 ? `parité : ${urls.length}/${urls.length} clés identiques` : `${bad} écart(s) sur ${urls.length}`);
process.exit(bad === 0 ? 0 : 1);
