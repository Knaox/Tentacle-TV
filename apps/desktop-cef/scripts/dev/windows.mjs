// Windows : prérequis (Visual Studio Build Tools, CMake, Ninja), CEF de l'architecture, SDL3
// (paquet VC officiel), libmpv, puis le build natif dans un environnement MSVC (vcvarsall).
// Charpente posée par l'axe linux ; l'axe windows la complète (libmpv, ressources, garde du
// profil) — jamais lancée ni construite sur le Mac du lot.
import fs from "node:fs";
import path from "node:path";
import { buildName, cache, capture, die, root, run, say, which } from "./common.mjs";
import { ensureCef } from "./cef.mjs";
import { fetchArchive } from "./fetch.mjs";

/** SDL3 : paquet de développement Visual C++ de la Release officielle (même version que macOS). */
export const SDL3_VC_PIN = {
  version: "3.4.16",
  sha256: "1a784cb2a5c64d56fe7a62090fe9d242d9865f235e4ea9678f1a6ba4e693e7de", // digest GitHub
  size: 16864776,
};

const state = {};

/** vcvarsall.bat de la dernière installation de Visual Studio (vswhere), ou null. */
function vcvarsall() {
  const pf = process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";
  const vswhere = path.join(pf, "Microsoft Visual Studio", "Installer", "vswhere.exe");
  if (!fs.existsSync(vswhere)) return null;
  const install = capture(vswhere, ["-latest", "-products", "*", "-requires", "Microsoft.VisualStudio.Component.VC.Tools.x86.x64", "-property", "installationPath"]);
  if (!install) return null;
  const bat = path.join(install, "VC", "Auxiliary", "Build", "vcvarsall.bat");
  return fs.existsSync(bat) ? bat : null;
}

function checkPrereqs() {
  const missing = [];
  if (!which("cmake")) missing.push("CMake (winget install Kitware.CMake)");
  if (!which("ninja")) missing.push("Ninja (winget install Ninja-build.Ninja)");
  state.vcvars = vcvarsall();
  if (!state.vcvars) missing.push("Visual Studio Build Tools, charge « Développement Desktop en C++ » (winget install Microsoft.VisualStudio.2022.BuildTools)");
  if (missing.length) die(`prérequis manquants :\n  - ${missing.join("\n  - ")}`);
}

async function ensureSdl3() {
  return fetchArchive({
    url: `https://github.com/libsdl-org/SDL/releases/download/release-${SDL3_VC_PIN.version}/SDL3-devel-${SDL3_VC_PIN.version}-VC.zip`,
    pin: { sha256: SDL3_VC_PIN.sha256 },
    dest: path.join(cache, "deps", "sdl3", `${SDL3_VC_PIN.version}-vc`),
    inner: `SDL3-${SDL3_VC_PIN.version}`,
    marker: "cmake/SDL3Config.cmake",
    sizeHint: SDL3_VC_PIN.size,
    what: `SDL3 ${SDL3_VC_PIN.version} (Visual C++)`,
    small: true,
  });
}

/** Une commande dans l'environnement MSVC (cl.exe, link.exe, SDK Windows). */
function inMsvc(cmd) {
  const arch = process.arch === "arm64" ? "arm64" : "x64";
  run("cmd.exe", ["/d", "/s", "/c", `"call "${state.vcvars}" ${arch} >nul && ${cmd}"`], { windowsVerbatimArguments: true });
}

export const windows = {
  quitHint: "Alt+F4 ou la fenêtre",
  async prepare() {
    if (state.ready) return;
    checkPrereqs();
    state.cef = await ensureCef();
    state.sdl = await ensureSdl3();
    // libmpv (axe windows) : en attendant, un préfixe fourni (include/, lib/ avec mpv.lib et
    // libmpv-2.dll), par exemple un paquet mpv-dev de shinchiro, épinglé par l'axe windows.
    state.mpv = process.env.TENTACLE_MPV_PREFIX;
    if (!state.mpv) die("libmpv : TENTACLE_MPV_PREFIX=<préfixe> requis pour l'instant (à épingler par l'axe windows)");
    state.ready = true;
  },
  async build() {
    await windows.prepare();
    const build = path.join(cache, "build", buildName());
    const q = (s) => `"${s}"`;
    if (!fs.existsSync(path.join(build, "build.ninja"))) {
      inMsvc(["cmake", "-G", "Ninja", "-S", q(root), "-B", q(build), "-DCMAKE_BUILD_TYPE=Release",
        q(`-DCEF_ROOT=${state.cef}`), q(`-DMPV_PREFIX=${state.mpv}`), q(`-DCMAKE_PREFIX_PATH=${state.sdl}`)].join(" "));
    }
    inMsvc(`ninja -C ${q(build)}`);
    const binary = path.join(build, "app", "tentacle.exe");
    if (!fs.existsSync(binary)) die(`exécutable absent après le build : ${binary}`);
    say(`build : ${binary}`);
    return binary;
  },
  env(env) {
    return env;
  },
};
