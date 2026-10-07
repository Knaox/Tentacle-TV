# Third-party licenses — Tentacle TV Server (Docker image)

Tentacle TV is licensed under the **GNU Affero General Public License v3.0 or
later** (`LICENSE`), with the additional permissions of `LICENSE-EXCEPTIONS`.
Source code of every release: https://github.com/Knaox/Tentacle-TV (tags
`server-vX.Y.Z`). Releases published before 7 October 2026 remain under the MIT
License.

This image also contains third-party software, each under its own license. The
full list, with notices and full license texts, is shown by the web client
(Credits › Licenses) and kept in `packages/shared/src/licenses/` (French
inventory: `docs/LICENCES.md`).

## Separate programs (not linked to Tentacle TV)

| Program | Version | License | Source |
|---|---|---|---|
| ffmpeg | 8.1.2 (MP3 → PCM only) | LGPL-2.1-or-later (built without `--enable-gpl`) | https://ffmpeg.org — recipe: `Dockerfile`, stage `media-tools` |
| fpcalc (Chromaprint) | 1.6.0 | **GPL-2.0-or-later** — statically linked with FFTW3 (GPL-2.0-or-later) | https://github.com/acoustid/chromaprint — https://www.fftw.org — recipe: `Dockerfile` |
| yt-dlp (zipapp) | 2026.08.19 | Unlicense (bundles meriyah, ISC, and astring, MIT) | https://github.com/yt-dlp/yt-dlp |
| Python | 3.14 (Alpine package) | PSF-2.0 | https://www.python.org |
| Node.js | 24 (base image) | MIT (with V8, ICU, libuv, OpenSSL under their own licenses) | https://github.com/nodejs/node |
| Alpine Linux base system | see `apk list -I` in the image | GPL-2.0-only (busybox, apk-tools…), GPL-3.0-or-later (readline, gdbm), MIT, Apache-2.0 (OpenSSL)… | https://gitlab.alpinelinux.org/alpine/aports |
| tini, su-exec | — | MIT | https://github.com/krallin/tini — https://github.com/ncopa/su-exec |

They are invoked as separate processes (`execFile`); they form an aggregate
with Tentacle TV, not a combined work (AGPL section 5). **Source offer:** the
corresponding source of the GPL and LGPL programs above, at the versions
shipped, is published with every release as the GitHub pre-release
`sources-server-vX.Y.Z` (`.github/workflows/sources.yml`). For images published
before that mechanism existed (up to `server-v1.23.0`, whose ffmpeg was
Alpine's GPL build with x264 / x265), the source is available on request from
the maintainer through GitHub issues, for at least three years after the image
was published.

## Node.js packages

All production dependencies are under permissive licenses — MIT (Fastify, ws,
undici, zod, pino, jsonwebtoken, MiniSearch…), ISC, BSD-3-Clause, BlueOak-1.0.0
and Apache-2.0 (Prisma client and query engine). Each package keeps its own
`LICENSE` file under `/app/node_modules`. Full list: `pnpm licenses list --prod`
in `apps/backend`.

## Web client and LG client served by the server

See `apps/web/THIRD-PARTY-LICENSES.md`.
