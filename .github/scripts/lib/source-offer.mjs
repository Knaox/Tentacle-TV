// L'offre de sources : pour chaque livraison, les sources CORRESPONDANTES des
// composants (L)GPL embarqués (GPL v2 §3, GPL v3 §6, LGPL §6 / §4), réunies
// dans une archive jointe à une Release `sources-<tag>`. Le code de Tentacle
// TV lui-même est l'archive du commit livré (`git archive`), ajoutée par le
// script. Ne JAMAIS compter sur la disponibilité d'un tiers : on miroite.
//
// Une entrée par composant : son nom, sa licence, l'archive amont à la
// version embarquée. Une montée de version d'un lecteur se reporte ICI.
// Zéro dépendance npm.

const GH = (repo, ref) => `https://github.com/${repo}/archive/refs/tags/${ref}.tar.gz`;
const FFMPEG = (v) => `https://ffmpeg.org/releases/ffmpeg-${v}.tar.xz`;
const PLACEBO = (v) => GH('haasn/libplacebo', `v${v}`);
const COMMIT = (repo, sha) => `https://github.com/${repo}/archive/${sha}.tar.gz`;
const APORTS = (pkg) => `https://gitlab.alpinelinux.org/alpine/aports/-/archive/3.24-stable/aports-3.24-stable.tar.gz?path=main/${pkg}`;

const C = (name, license, url) => ({ name, license, url });

/** Les composants (L)GPL de chaque application, par plateforme. */
export const SOURCES = {
  mobile: [
    // iOS — MPVKit, variante LGPL de mpvkit.yml (dépendances préconstruites
    // par les dépôts mpvkit/*-build, qui épinglent leurs versions).
    C('MPVKit (fork Streamyfin, recette)', 'LGPL-3.0', GH('streamyfin/MPVKit', '0.41.0-av5')),
    C('mpv 0.41.0', 'LGPL-2.1-or-later', GH('mpv-player/mpv', 'v0.41.0')),
    C('FFmpeg 8.1', 'LGPL-3.0-or-later', FFMPEG('8.1')),
    C('libplacebo 7.360.1', 'LGPL-2.1-or-later', PLACEBO('7.360.1')),
    C('FriBidi 1.0.16', 'LGPL-2.1-or-later', GH('fribidi/fribidi', 'v1.0.16')),
    C('GnuTLS, Nettle, GMP (recette mpvkit/gnutls-build 3.8.11)', 'LGPL', GH('mpvkit/gnutls-build', '3.8.11')),
    C('libbluray 1.4.0', 'LGPL-2.1-or-later', 'https://download.videolan.org/pub/videolan/libbluray/1.4.0/libbluray-1.4.0.tar.xz'),
    C('uchardet 0.0.8', 'LGPL-2.1-or-later', 'https://www.freedesktop.org/software/uchardet/releases/uchardet-0.0.8.tar.xz'),
    // Android — libmpv-android et le décodeur FFmpeg de Media3, reconstruits
    // en LGPL (recette : apps/mobile/android/maven-local/README.md).
    C('libmpv-android 1.0.0 (recette)', 'MIT', GH('jarnedemeulemeester/libmpv-android', 'v1.0.0')),
    C('AndroidX Media 1.9.0 (decoder_ffmpeg)', 'Apache-2.0', GH('androidx/media', '1.9.0')),
    C('FFmpeg 6.0.2 (décodeur Media3, branche release/6.0)', 'LGPL-2.1-or-later', COMMIT('FFmpeg/FFmpeg', 'b4a62c32549b8295691a8e0ff2c9b82188923159')),
  ],
  tv: [
    C('MPVKit 1.0.0 (recette)', 'LGPL-3.0', GH('mpvkit/MPVKit', '1.0.0')),
    C('FFmpeg 8.1.2', 'LGPL-3.0-or-later', FFMPEG('8.1.2')),
    C('libplacebo 7.360.1', 'LGPL-2.1-or-later', PLACEBO('7.360.1')),
    C('FriBidi 1.0.16', 'LGPL-2.1-or-later', GH('fribidi/fribidi', 'v1.0.16')),
    C('GnuTLS, Nettle, GMP (recette mpvkit/gnutls-build 3.8.11)', 'LGPL', GH('mpvkit/gnutls-build', '3.8.11')),
    // Android TV — GPL (sans bibliothèque propriétaire dans l'APK).
    C('libmpv-android 1.0.0 (recette)', 'MIT', GH('jarnedemeulemeester/libmpv-android', 'v1.0.0')),
    C('mpv 0.41.0', 'GPL-2.0-or-later', GH('mpv-player/mpv', 'v0.41.0')),
    C('FFmpeg 8.1', 'GPL-3.0-or-later', FFMPEG('8.1')),
    C('Jellyfin Media3 FFmpeg decoder 1.8.0+1', 'GPL-3.0', GH('jellyfin/jellyfin-androidx-media', 'v1.8.0+1')),
    C('AndroidX Media (sous-module du décodeur de Jellyfin 1.8.0+1)', 'Apache-2.0', COMMIT('androidx/media', 'b7bbc6e2')),
    C('FFmpeg 6.0 (sous-module du décodeur de Jellyfin 1.8.0+1)', 'LGPL-2.1-or-later', COMMIT('FFmpeg/FFmpeg', 'd388c347')),
  ],
  desktop: [
    C('mpv 0.40.0 (macOS)', 'LGPL-2.1-or-later', GH('mpv-player/mpv', 'v0.40.0')),
    C('mpv 0.41.0 (Linux)', 'GPL-2.0-or-later', GH('mpv-player/mpv', 'v0.41.0')),
    C('FFmpeg 7.1.1 (macOS, Linux)', 'LGPL-2.1-or-later', FFMPEG('7.1.1')),
    C('libplacebo 7.360.1', 'LGPL-2.1-or-later', PLACEBO('7.360.1')),
    C('FriBidi 1.0.16', 'LGPL-2.1-or-later', GH('fribidi/fribidi', 'v1.0.16')),
    // Windows — libmpv-2.dll (zhongfly/mpv-winbuild, variante LGPL, construite
    // le 2026-02-27) : révisions lues dans la DLL et dans l'historique des
    // recettes à cette date.
    C('mpv f28cea85c (libmpv-2.dll, Windows)', 'LGPL-2.1-or-later', COMMIT('mpv-player/mpv', 'f28cea85c')),
    C('FFmpeg N-123068-gaa483bc42 (libmpv-2.dll, Windows)', 'LGPL-3.0-or-later', COMMIT('FFmpeg/FFmpeg', 'aa483bc42')),
    C('mpv-winbuild-cmake 965bf378 (recette de la DLL)', 'GPL-3.0', COMMIT('shinchiro/mpv-winbuild-cmake', '965bf378a50d7f59a933aff790ed2d3c807fe545')),
    C('zhongfly/mpv-winbuild 198a40e (variante LGPL de la recette)', 'MIT', COMMIT('zhongfly/mpv-winbuild', '198a40e88b6e5d2ddbfb6b5561b67445aa523413')),
  ],
  server: [
    C('FFmpeg 8.1.2 (programme ffmpeg)', 'LGPL-2.1-or-later', FFMPEG('8.1.2')),
    C('Chromaprint 1.6.0 (programme fpcalc)', 'LGPL-2.1-or-later', GH('acoustid/chromaprint', 'v1.6.0')),
    C('FFTW 3.3.10 (lié à fpcalc)', 'GPL-2.0-or-later', 'https://www.fftw.org/fftw-3.3.10.tar.gz'),
    C('BusyBox 1.37.0', 'GPL-2.0-only', 'https://busybox.net/downloads/busybox-1.37.0.tar.bz2'),
    C('BusyBox — recette Alpine 3.24', 'GPL-2.0-only', APORTS('busybox')),
    C('apk-tools 3.0.8', 'GPL-2.0-only', 'https://gitlab.alpinelinux.org/alpine/apk-tools/-/archive/v3.0.8/apk-tools-v3.0.8.tar.gz'),
    C('alpine-baselayout — Alpine 3.24', 'GPL-2.0-only', APORTS('alpine-baselayout')),
    C('pax-utils (scanelf) — Alpine 3.24', 'GPL-2.0-only', APORTS('pax-utils')),
    C('GNU Readline 8.3', 'GPL-3.0-or-later', 'https://ftp.gnu.org/gnu/readline/readline-8.3.tar.gz'),
    C('GNU dbm 1.26', 'GPL-3.0-or-later', 'https://ftp.gnu.org/gnu/gdbm/gdbm-1.26.tar.gz'),
  ],
};

export const APPS = Object.keys(SOURCES);

/** Le nom de fichier d'une archive amont, sans ambiguïté entre composants. */
export function archiveName(component, index) {
  const ext = component.url.split('?')[0].match(/\.(tar\.gz|tar\.xz|tar\.bz2|zip)$/)?.[1] ?? 'tar.gz';
  const slug = component.name.toLowerCase().replace(/[^a-z0-9.]+/g, '-').replace(/^-|-$/g, '');
  return `${String(index + 1).padStart(2, '0')}-${slug}.${ext}`;
}

/** Le SOURCES.md joint à l'archive : ce qu'elle contient, et d'où cela vient. */
export function sourcesManifest(app, tag, sha) {
  const rows = SOURCES[app].map((c, i) => `| \`${archiveName(c, i)}\` | ${c.name} | ${c.license} | ${c.url} |`);
  return [
    `# Sources correspondantes — ${tag}`,
    '',
    `Tentacle TV (AGPL-3.0-or-later) au commit \`${sha}\` : \`tentacle-tv-${tag}.tar.gz\`.`,
    'Ci-dessous, les sources des composants GPL et LGPL embarqués par cette livraison,',
    'à la version embarquée (recettes de construction comprises). Inventaire complet :',
    '`docs/LICENCES.md` et les `THIRD-PARTY-LICENSES.md` de chaque application.',
    '',
    '| Archive | Composant | Licence | Origine |',
    '|---|---|---|---|',
    ...rows,
    '',
  ].join('\n');
}
