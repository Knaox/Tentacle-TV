// Linux : prérequis (dits par distribution), CEF de l'architecture, SDL3 et libmpv, puis le
// build natif dans $cache/build/<nom>/ — l'exécutable et les ressources de CEF dans app/.
import fs from "node:fs";
import path from "node:path";
import { buildName, cache, desktopVersion, die, dry, root, run, say, warn, which } from "./common.mjs";
import { ensureCef } from "./cef.mjs";
import { fetchArchive } from "./fetch.mjs";
import { cefRuntimeLine, checkBuildPrereqs, missingCefRuntime, systemSdl3 } from "./linux-prereqs.mjs";
import { ensureLibmpv, jobs, warnLibmpv } from "./mpv-linux.mjs";

/** SDL3 de repli : la version de Homebrew sur le Mac du lot, archive officielle épinglée. */
export const SDL3_PIN = {
  version: "3.4.16",
  // Empreinte publiée par GitHub pour l'asset de la Release (API, champ digest).
  sha256: "7322236cd12090c3eb40b9728be4d49c76f66ad17d04369584d4ecad5cf77c68",
  size: 15640667,
};

const state = {};

function ninja() {
  return which("ninja") ? "ninja" : "ninja-build";
}

/** SDL3 du système, sinon construite depuis l'archive épinglée ; renvoie un préfixe ou null. */
async function ensureSdl3() {
  if (process.env.TENTACLE_SDL3_PREFIX) return process.env.TENTACLE_SDL3_PREFIX;
  const v = systemSdl3();
  if (v) {
    say(`SDL3 du système : ${v}`);
    return null;
  }
  const prefix = path.join(cache, "deps", "sdl3", `${SDL3_PIN.version}-linux-${process.arch}`);
  if (fs.existsSync(path.join(prefix, "lib", "cmake", "SDL3", "SDL3Config.cmake"))) return prefix;
  warn(`SDL3 >= 3.2 absente du système : construction de SDL3 ${SDL3_PIN.version} (archive épinglée)`);
  const src = await fetchArchive({
    url: `https://github.com/libsdl-org/SDL/releases/download/release-${SDL3_PIN.version}/SDL3-${SDL3_PIN.version}.tar.gz`,
    pin: { sha256: SDL3_PIN.sha256 },
    dest: path.join(cache, "deps", "sdl3", `${SDL3_PIN.version}-src`),
    inner: `SDL3-${SDL3_PIN.version}`,
    marker: "CMakeLists.txt",
    sizeHint: SDL3_PIN.size,
    what: `SDL3 ${SDL3_PIN.version} (sources)`,
    small: true,
  });
  const build = `${prefix}.build`;
  run("cmake", ["-G", "Ninja", "-S", src, "-B", build, "-DCMAKE_BUILD_TYPE=Release", `-DCMAKE_INSTALL_PREFIX=${prefix}`,
    "-DCMAKE_INSTALL_LIBDIR=lib", "-DSDL_TESTS=OFF", "-DSDL_EXAMPLES=OFF", "-DSDL_STATIC=OFF"]);
  run(ninja(), ["-C", build, `-j${jobs()}`, "install"]);
  return prefix;
}

/** Ce qu'il manque à libcef.so pour démarrer (bibliothèques de Chromium) : dit, pas fatal. */
function checkCefRuntime(cefRoot, family) {
  const missing = missingCefRuntime(path.join(cefRoot, "Release", "libcef.so"));
  if (missing.length === 0) return;
  warn(`libcef.so ne trouve pas : ${missing.join(" ")}`);
  warn(`  ${cefRuntimeLine(family)}`);
}

export const linux = {
  quitHint: "Ctrl+Q ou la fenêtre",
  /** Prérequis et dépendances, avant le build web (on échoue tôt). */
  async prepare() {
    if (state.ready) return;
    const { family, name } = checkBuildPrereqs();
    say(`${name} (${process.arch}) — famille ${family}`);
    state.cef = await ensureCef();
    checkCefRuntime(state.cef, family);
    state.sdl = await ensureSdl3();
    try {
      state.mpv = await ensureLibmpv(family);
    } catch (e) {
      die(e.message);
    }
    warnLibmpv(state.mpv);
    state.ready = true;
  },
  /** Configure (si besoin) et construit ; renvoie l'exécutable. */
  async build() {
    await linux.prepare();
    const name = buildName();
    const build = path.join(cache, "build", name);
    const defs = [
      "-DCMAKE_BUILD_TYPE=Release",
      `-DCEF_ROOT=${state.cef}`,
      // Version courante du moteur de mise à jour (sans Info.plist hors macOS).
      `-DTENTACLE_APP_VERSION=${desktopVersion()}`,
      state.mpv.kind === "fork" ? `-DMPV_PREFIX=${state.mpv.prefix}` : "-DTENTACLE_MPV_SYSTEM=ON",
      ...(state.sdl ? [`-DCMAKE_PREFIX_PATH=${state.sdl}`] : []),
    ];
    // Reconfigure quand la chaîne change (CEF, libmpv, SDL3) : sinon CMake garderait l'ancienne.
    const stamp = path.join(build, ".dev-config");
    const want = defs.join("\n");
    const have = fs.existsSync(stamp) ? fs.readFileSync(stamp, "utf8") : null;
    if (!fs.existsSync(path.join(build, "build.ninja")) || have !== want) {
      run("cmake", ["-G", "Ninja", "-S", root, "-B", build, ...defs]);
      if (!dry) fs.writeFileSync(stamp, want);
    }
    run(ninja(), ["-C", build, `-j${jobs()}`]);
    const binary = path.join(build, "app", "tentacle");
    if (!dry && !fs.existsSync(binary)) die(`exécutable absent après le build : ${binary}`);
    say(`build : ${binary}`);
    return binary;
  },
  env(env) {
    if (state.mpv?.warning) warn(state.mpv.warning); // redit juste avant le lancement
    return env;
  },
};
