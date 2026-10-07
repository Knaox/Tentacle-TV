# Third-party licenses — Tentacle TV web client (browser, desktop shell, LG TVs)

Tentacle TV is licensed under the **GNU Affero General Public License v3.0 or
later** (`LICENSE`), with the additional permissions of `LICENSE-EXCEPTIONS`.
The JavaScript served to the browser is object code: its source is
https://github.com/Knaox/Tentacle-TV at the tag of the running server
(`server-vX.Y.Z`), shown on the Credits page.

The Credits › Licenses page lists every bundled component with its notice and
opens the full text of each license, offline. Main components:

| Component | License |
|---|---|
| React, React DOM, React Router, TanStack Query and Virtual, i18next, react-i18next, Framer Motion, libpgs, uqr, Tailwind CSS (generated CSS), country-flag-icons | MIT |
| hls.js | Apache-2.0 |
| tslib | 0BSD |
| Lucide icons (`lucide-react`) | ISC, with portions from Feather (MIT, © Cole Bemis) |
| Heroicons v2 (paths copied into components) | MIT, © Tailwind Labs |
| Inter font (`@fontsource-variable/inter`) | SIL Open Font License 1.1 |
| LG client only: core-js, SystemJS, regenerator-runtime (legacy build) | MIT |

The desktop shell adds Electron, Chromium and the mpv / FFmpeg player:
`apps/desktop-electron/THIRD-PARTY-LICENSES.md`.
