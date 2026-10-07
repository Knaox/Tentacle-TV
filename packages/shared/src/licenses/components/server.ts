import type { ThirdPartyComponent } from "../licenseTypes";

// L'image Docker du serveur. ffmpeg, fpcalc et yt-dlp sont des PROGRAMMES
// SÉPARÉS lancés par le serveur (execFile) : un agrégat, pas une œuvre
// combinée. Leurs sources s'offrent quand même avec l'image (docs/LICENCES.md).

export const SERVER_COMPONENTS: readonly ThirdPartyComponent[] = [
  { name: "Node.js", version: "24", license: "MIT", texts: ["MIT"], notice: "Copyright © Node.js contributors; includes V8, ICU, libuv, OpenSSL under their own licenses.", source: "https://github.com/nodejs/node", platforms: ["server"] },
  { name: "Fastify and plugins", version: "5", license: "MIT", texts: ["MIT"], notice: "Copyright © The Fastify Team.", source: "https://github.com/fastify/fastify", platforms: ["server"] },
  { name: "Prisma client and query engine", version: "6", license: "Apache-2.0", texts: ["Apache-2.0"], notice: "Copyright © Prisma Data, Inc.", source: "https://github.com/prisma/prisma", platforms: ["server"] },
  { name: "zod, ws, undici, pino, jsonwebtoken, MiniSearch and other npm packages", version: null, license: "MIT AND ISC AND BSD-3-Clause AND BlueOak-1.0.0", texts: ["MIT", "ISC", "BSD-3-Clause", "BlueOak-1.0.0"], source: "https://www.npmjs.com", platforms: ["server"], note: "Full list: pnpm licenses list --prod (apps/backend)." },
  { name: "FFmpeg (ffmpeg program)", version: "8.1.2", license: "LGPL-2.1-or-later", texts: ["LGPL-2.1"], notice: "Copyright © the FFmpeg developers.", source: "https://ffmpeg.org — recipe: Dockerfile (media-tools stage)", platforms: ["server"], note: "Built without --enable-gpl; MP3 to PCM only." },
  {
    name: "Chromaprint (fpcalc program)", version: "1.6.0", license: "GPL-2.0-or-later", texts: ["GPL-2.0", "GPL-3.0"],
    notice: "Copyright © Lukáš Lalinský. Statically linked with FFTW3 (GPL-2.0-or-later), which makes the fpcalc binary GPL.",
    source: "https://github.com/acoustid/chromaprint — FFTW: https://www.fftw.org — recipe: Dockerfile", platforms: ["server"],
  },
  { name: "yt-dlp (zipapp)", version: "2026.08.19", license: "Unlicense", texts: ["Unlicense", "ISC", "MIT"], notice: "Bundles meriyah (ISC) and astring (MIT).", source: "https://github.com/yt-dlp/yt-dlp", platforms: ["server"] },
  { name: "Python", version: "3.14", license: "PSF-2.0", texts: ["PSF-2.0"], notice: "Copyright © Python Software Foundation.", source: "https://www.python.org", platforms: ["server"] },
  {
    name: "Alpine Linux base system", version: null, license: "GPL-2.0-only AND GPL-3.0-or-later AND MIT AND others", texts: ["GPL-2.0", "GPL-3.0", "MIT"],
    source: "https://gitlab.alpinelinux.org/alpine/aports", platforms: ["server"],
    note: "busybox, apk-tools, musl, OpenSSL, readline… run as separate programs; not linked to Tentacle TV.",
  },
  { name: "tini, su-exec", version: null, license: "MIT", texts: ["MIT"], notice: "Copyright © Thomas Orozco; Copyright © ncopa.", source: "https://github.com/krallin/tini", platforms: ["server"] },
];
