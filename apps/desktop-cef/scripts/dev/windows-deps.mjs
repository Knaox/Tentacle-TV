// Windows : l'environnement de Visual Studio et les dépendances du build, chacune épinglée par
// version ET SHA-256 (fetch.mjs vérifie avant d'extraire). Aucun bash : Node, l'outillage de
// Visual Studio (vswhere, vcvarsall, dumpbin, lib) et le tar.exe de Windows.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { cache, capture, die, repo, run, say } from "./common.mjs";
import { download, fetchArchive, tarBinary, verify } from "./fetch.mjs";

/** SDL3 : paquet de développement Visual C++ de la Release officielle (même version que macOS). */
export const SDL3_VC_PIN = {
  version: "3.4.16",
  sha256: "1a784cb2a5c64d56fe7a62090fe9d242d9865f235e4ea9678f1a6ba4e693e7de", // digest GitHub
  size: 16864776,
};

/**
 * libsodium (moteur de mise à jour, src/update : ed25519 + SHA-256) : paquet MSVC officiel de la
 * Release 1.0.22 (09/04/2026), bibliothèque STATIQUE v143 (/MT, le CRT de CEF). Empreinte :
 * digest GitHub de l'asset, recalculée sur l'archive téléchargée le 10/11/2026.
 */
export const SODIUM_PIN = {
  version: "1.0.22",
  sha256: "3e03a726fac4bc09cb61d8f29d658ef7a5eca0811de59082130414f7ca2e4279",
  size: 17690194,
};

/**
 * nlohmann/json : les en-têtes de la Release v3.12.0 (include.zip, 11/04/2025 — la version de
 * Homebrew sur le Mac du lot). Pas de digest publié pour cette Release : SHA-256 calculée sur
 * l'archive téléchargée le 10/11/2026.
 */
export const JSON_PIN = {
  version: "3.12.0",
  sha256: "b8cb0ef2dd7f57f18933997c9934bb1fa962594f701cd5a8d3c2c80541559372",
  size: 309160,
};

/**
 * libmpv : la DLL QU'ELECTRON LIVRE au Microsoft Store, déjà dans le dépôt
 * (apps/desktop-electron/lib/mpv/libmpv-2.dll — zhongfly/mpv-winbuild, variante LGPL, mpv
 * v0.41.0-233-gf28cea85c ; THIRD-PARTY-LICENSES.md). Rien à télécharger, la même lecture
 * qu'Electron, et elle a le mode composition de mpv (d3d11-output-mode, display-swapchain).
 * Ses en-têtes : ceux de CE commit de mpv (API cliente 2.5), épinglés fichier par fichier.
 */
export const MPV_PIN = {
  commit: "f28cea85c1",
  dll: "apps/desktop-electron/lib/mpv/libmpv-2.dll",
  dllSha256: "b85a8366b572fab2ed2b3c8af26f9c834e6526b16d3e07d94726f88562aed67f",
  headers: {
    "client.h": "3c073236a09cb456c6e80587d5523c8771c32fb22ca014e0f99cc3d43905b75c",
    "render.h": "192691941602052f00df0587f126246c48785a1cf21de68d22a92ea1908d1c55",
    "render_gl.h": "48662c0ed9872a14dd9e1684105c97f69f94a0414709c254c5d372adc41d2e69",
    "stream_cb.h": "188e58b6d14383e15a5dffdc4ecebbdfbf2e412b9c099ff21b571f747a8ce32d",
  },
};

/**
 * SQLite (hors ligne, src/offline/sqlite.cmake) : l'amalgamation officielle 3.46.1, LE MÊME
 * épinglage que sqlite.cmake (qui la télécharge sinon lui-même, à la configuration). Rangée là
 * où sqlite.cmake la cherche — archive gardée dans dl/ : CMake en revérifie l'empreinte.
 */
export const SQLITE_PIN = {
  version: "3460100",
  sha256: "77823cb110929c2bcb0f5d48e4833b5c59a8a6e40cdea3936b99e199dbbe5784",
  size: 2764032,
};

/** vcvarsall.bat de la dernière installation de Visual Studio dotée du C++ (vswhere), ou null. */
export function vcvarsall() {
  const pf = process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";
  const vswhere = path.join(pf, "Microsoft Visual Studio", "Installer", "vswhere.exe");
  if (!fs.existsSync(vswhere)) return null;
  const install = capture(vswhere, ["-latest", "-products", "*", "-requires",
    "Microsoft.VisualStudio.Component.VC.Tools.x86.x64", "-property", "installationPath"]);
  if (!install) return null;
  const bat = path.join(install.split(/\r?\n/)[0], "VC", "Auxiliary", "Build", "vcvarsall.bat");
  return fs.existsSync(bat) ? bat : null;
}

/**
 * L'environnement de Visual Studio x64 (cl, link, rc, mt, le SDK Windows ; CMake et Ninja si la
 * charge « Outils CMake C++ » est installée), lu UNE fois par `vcvarsall x64 && set` et réutilisé
 * pour chaque commande — pas de chaîne cmd.exe à guillemets imbriqués par commande.
 */
export function msvcEnv(bat) {
  const r = spawnSync("cmd.exe", ["/d", "/s", "/c", `""${bat}" x64 >nul && set"`],
    { encoding: "utf8", windowsVerbatimArguments: true, maxBuffer: 16 << 20 });
  if (r.status !== 0 || !r.stdout) die(`vcvarsall x64 a échoué :\n${r.stderr || r.stdout}`);
  const env = {};
  for (const line of r.stdout.split(/\r?\n/)) {
    const i = line.indexOf("=");
    if (i > 0) env[line.slice(0, i)] = line.slice(i + 1);
  }
  return env;
}

/** Un exécutable du PATH de `env` (Windows : extensions de PATHEXT), ou null. */
export function whichIn(env, name) {
  const pathVar = env.Path ?? env.PATH ?? "";
  for (const dir of pathVar.split(";")) {
    if (!dir) continue;
    for (const ext of [".exe", ".cmd", ".bat"]) {
      const p = path.join(dir, name + ext);
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}

export async function ensureSdl3() {
  const dest = await fetchArchive({
    url: `https://github.com/libsdl-org/SDL/releases/download/release-${SDL3_VC_PIN.version}/SDL3-devel-${SDL3_VC_PIN.version}-VC.zip`,
    pin: { sha256: SDL3_VC_PIN.sha256 },
    dest: path.join(cache, "deps", "sdl3", `${SDL3_VC_PIN.version}-vc`),
    inner: `SDL3-${SDL3_VC_PIN.version}`,
    marker: "cmake/SDL3Config.cmake",
    sizeHint: SDL3_VC_PIN.size,
    what: `SDL3 ${SDL3_VC_PIN.version} (Visual C++)`,
    small: true,
  });
  return path.join(dest, "cmake"); // SDL3_DIR
}

export async function ensureSodium() {
  const dest = await fetchArchive({
    url: `https://github.com/jedisct1/libsodium/releases/download/${SODIUM_PIN.version}-RELEASE/libsodium-${SODIUM_PIN.version}-msvc.zip`,
    pin: { sha256: SODIUM_PIN.sha256 },
    dest: path.join(cache, "deps", "libsodium", `${SODIUM_PIN.version}-msvc`),
    inner: "libsodium",
    marker: "include/sodium.h",
    sizeHint: SODIUM_PIN.size,
    what: `libsodium ${SODIUM_PIN.version} (MSVC)`,
    small: true,
  });
  const lib = path.join(dest, "x64", "Release", "v143", "static", "libsodium.lib");
  if (!fs.existsSync(lib)) die(`libsodium : ${lib} absent de l'archive`);
  return { include: path.join(dest, "include"), lib };
}

export async function ensureSqlite() {
  const base = path.join(cache, "deps", "sqlite");
  const dir = path.join(base, `sqlite-amalgamation-${SQLITE_PIN.version}`);
  const zip = path.join(base, "dl", `sqlite-amalgamation-${SQLITE_PIN.version}.zip`);
  if (fs.existsSync(path.join(dir, "sqlite3.c")) && !verify(zip, { sha256: SQLITE_PIN.sha256 })) return dir;
  if (!fs.existsSync(zip) || verify(zip, { sha256: SQLITE_PIN.sha256 })) {
    await download(`https://www.sqlite.org/2024/sqlite-amalgamation-${SQLITE_PIN.version}.zip`, zip, SQLITE_PIN.size);
  }
  const bad = verify(zip, { sha256: SQLITE_PIN.sha256 });
  if (bad) die(`SQLite : ${bad}`);
  run(tarBinary(), ["-xf", zip, "-C", base]);
  if (!fs.existsSync(path.join(dir, "sqlite3.c"))) die(`SQLite : ${dir}/sqlite3.c absent après extraction`);
  say(`SQLite ${SQLITE_PIN.version} prêt : ${dir}`);
  return dir;
}

/** nlohmann/json : en-têtes + un fichier de configuration CMake (find_package CONFIG). */
export async function ensureJson() {
  const dest = await fetchArchive({
    url: `https://github.com/nlohmann/json/releases/download/v${JSON_PIN.version}/include.zip`,
    pin: { sha256: JSON_PIN.sha256 },
    dest: path.join(cache, "deps", "nlohmann-json", JSON_PIN.version),
    inner: "include",
    marker: "nlohmann/json.hpp",
    sizeHint: JSON_PIN.size,
    what: `nlohmann/json ${JSON_PIN.version}`,
    small: true,
  });
  const cfgDir = path.join(path.dirname(dest), `${JSON_PIN.version}-cmake`);
  const cfg = path.join(cfgDir, "nlohmann_jsonConfig.cmake");
  if (!fs.existsSync(cfg)) {
    fs.mkdirSync(cfgDir, { recursive: true });
    const inc = dest.replaceAll("\\", "/");
    fs.writeFileSync(cfg, [
      "# Écrit par scripts/dev/windows-deps.mjs : la cible de la bibliothèque, en-têtes seuls.",
      "if(NOT TARGET nlohmann_json::nlohmann_json)",
      "  add_library(nlohmann_json::nlohmann_json INTERFACE IMPORTED)",
      `  set_target_properties(nlohmann_json::nlohmann_json PROPERTIES INTERFACE_INCLUDE_DIRECTORIES "${inc}")`,
      "endif()",
      "",
    ].join("\n"));
    fs.writeFileSync(path.join(cfgDir, "nlohmann_jsonConfigVersion.cmake"), [
      `set(PACKAGE_VERSION "${JSON_PIN.version}")`,
      "if(PACKAGE_FIND_VERSION VERSION_GREATER PACKAGE_VERSION)",
      "  set(PACKAGE_VERSION_COMPATIBLE FALSE)",
      "else()",
      "  set(PACKAGE_VERSION_COMPATIBLE TRUE)",
      "endif()",
      "",
    ].join("\n"));
  }
  return cfgDir; // nlohmann_json_DIR
}

/**
 * Le préfixe de libmpv attendu par src/player : include/mpv/*.h, lib/mpv.lib (bibliothèque
 * d'importation fabriquée depuis les exports de la DLL : dumpbin /exports puis lib /def) et
 * bin/libmpv-2.dll. Un dossier par empreinte de la DLL : changer de DLL ne mélange rien.
 */
export async function ensureMpvPrefix(env) {
  const dll = path.join(repo, MPV_PIN.dll);
  if (!fs.existsSync(dll)) die(`libmpv : ${MPV_PIN.dll} absente du dépôt`);
  const bad = verify(dll, { sha256: MPV_PIN.dllSha256 });
  if (bad) die(`libmpv : ${MPV_PIN.dll} — ${bad} (la DLL d'Electron a changé : mettre MPV_PIN à jour)`);
  const prefix = path.join(cache, "deps", "mpv-win", MPV_PIN.dllSha256.slice(0, 8));
  const lib = path.join(prefix, "lib", "mpv.lib");
  if (fs.existsSync(lib)) return prefix;
  for (const d of ["include/mpv", "lib", "bin"]) fs.mkdirSync(path.join(prefix, d), { recursive: true });
  for (const [name, sha256] of Object.entries(MPV_PIN.headers)) {
    const out = path.join(prefix, "include", "mpv", name);
    await download(`https://raw.githubusercontent.com/mpv-player/mpv/${MPV_PIN.commit}/include/mpv/${name}`, out);
    const err = verify(out, { sha256 });
    if (err) {
      fs.rmSync(out, { force: true });
      die(`en-tête mpv ${name} : ${err}`);
    }
  }
  fs.copyFileSync(dll, path.join(prefix, "bin", "libmpv-2.dll"));
  // Exports de la DLL → mpv.def → mpv.lib (MSVC ne lit pas la libmpv.dll.a de mingw).
  const dump = spawnSync("dumpbin", ["/nologo", "/exports", dll], { encoding: "utf8", env, maxBuffer: 16 << 20 });
  if (dump.status !== 0) die(`dumpbin /exports a échoué : ${dump.stderr}`);
  const names = [];
  for (const line of dump.stdout.split(/\r?\n/)) {
    const m = /^\s+\d+\s+[0-9A-F]+\s+[0-9A-F]{8}\s+(\S+)/.exec(line);
    if (m) names.push(m[1]);
  }
  if (!names.includes("mpv_create")) die("libmpv-2.dll : mpv_create introuvable dans ses exports");
  const def = path.join(prefix, "lib", "mpv.def");
  fs.writeFileSync(def, ["LIBRARY libmpv-2.dll", "EXPORTS", ...names.map((n) => `  ${n}`), ""].join("\r\n"));
  run("lib", ["/nologo", `/def:${def}`, "/machine:x64", `/out:${lib}`], { env });
  say(`libmpv prête : ${prefix} (${names.length} fonctions exportées)`);
  return prefix;
}
