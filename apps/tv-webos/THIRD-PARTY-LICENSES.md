# Third-party licenses — Tentacle TV for LG webOS

Tentacle TV is licensed under the **GNU Affero General Public License v3.0 or
later** (`LICENSE`), with the additional permissions of `LICENSE-EXCEPTIONS`
(including distribution through the LG Content Store). Source:
https://github.com/Knaox/Tentacle-TV (tags `webos-vX.Y.Z`).

- **The IPK** (`shell/`) contains only Tentacle TV's own code and images — no
  third-party code, font or binary. LG's `webOSTV.js` is not part of the
  repository; check its license before shipping it in an IPK.
- **The TV client** is served by the Tentacle TV server under `/tv`: its
  third-party components are those of the web client
  (`apps/web/THIRD-PARTY-LICENSES.md`), plus core-js, SystemJS and
  regenerator-runtime (MIT) from the legacy build. The TV uses the system font
  "LG Smart UI", which is not shipped.
