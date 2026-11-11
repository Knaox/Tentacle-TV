// Windows : prérequis (Visual Studio Build Tools avec le C++, CMake et Ninja — ceux de Visual
// Studio conviennent), CEF de l'architecture, SDL3 (paquet VC officiel), libmpv (la DLL
// d'Electron), libsodium et nlohmann/json épinglés, puis le build natif dans l'environnement de
// Visual Studio (vcvarsall x64). Aucun bash. Écrit par l'axe windows sur la charpente de l'axe
// linux ; jamais lancé depuis le Mac du lot : la recette est docs/A-TESTER-WINDOWS.md.
import fs from "node:fs";
import path from "node:path";
import { buildName, cache, cmakePath, desktopVersion, die, dry, root, run, say } from "./common.mjs";
import { ensureCef } from "./cef.mjs";
import { cefProfileFor } from "./profile.mjs";
import { ensureJson, ensureMpvPrefix, ensureSdl3, ensureSodium, ensureSqlite, msvcEnv, vcvarsall, whichIn } from "./windows-deps.mjs";

export { SDL3_VC_PIN } from "./windows-deps.mjs";

const state = {};

function checkPrereqs() {
  if (process.arch !== "x64") {
    die(`Windows ${process.arch} : seul x64 est pris en charge (la libmpv-2.dll d'Electron est x64)`);
  }
  const bat = vcvarsall();
  if (!bat) {
    die("Visual Studio introuvable (vswhere) : installer Visual Studio Build Tools, charge « Développement Desktop en C++ »\n" +
      "  winget install Microsoft.VisualStudio.2022.BuildTools --override \"--add Microsoft.VisualStudio.Workload.VCTools --includeRecommended --passive\"");
  }
  state.env = msvcEnv(bat);
  const missing = [];
  // CMake et Ninja : ceux de Visual Studio (composant « Outils CMake C++ », inclus dans la
  // charge recommandée), sinon ceux du PATH (winget install Kitware.CMake Ninja-build.Ninja).
  for (const tool of ["cl", "link", "rc", "lib", "dumpbin", "cmake", "ninja"]) {
    if (!whichIn(state.env, tool)) missing.push(tool);
  }
  if (missing.length) {
    die(`introuvables dans l'environnement de Visual Studio : ${missing.join(", ")}\n` +
      "  cmake/ninja : winget install Kitware.CMake Ninja-build.Ninja, ou le composant « Outils CMake C++ pour Windows »");
  }
  say(`Visual Studio : ${bat}`);
}

/**
 * Jamais Electron (ou un autre Tentacle CEF) sur le même stockage. Sous Windows, ni lien
 * SingletonLock ni lsof : Chromium tient `lockfile` à la racine de son profil, ouvert en
 * écriture SANS partage tant que le processus vit (ProcessSingleton, supprimé à la fermeture),
 * et LevelDB verrouille ses LOCK (LockFileEx). Un fichier qu'on ne peut ouvrir est tenu.
 */
function heldOnWindows(file) {
  if (!fs.existsSync(file)) return false;
  let fd;
  try {
    fd = fs.openSync(file, "r+");
    const buf = Buffer.alloc(1);
    fs.readSync(fd, buf, 0, 1, 0);  // une plage verrouillée par un autre : EBUSY
    return false;
  } catch (e) {
    return ["EBUSY", "EPERM", "EACCES"].includes(e.code);
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

function extraHolders(profile, locks) {
  const out = [];
  for (const f of [path.join(profile, "lockfile"), path.join(cefProfileFor(profile), "lockfile"), ...locks]) {
    if (heldOnWindows(f)) out.push(`(fichier tenu : ${f})`);
  }
  return out;
}

export const windows = {
  quitHint: "Alt+F4 ou la fenêtre",
  extraHolders,
  async prepare() {
    if (state.ready) return;
    if (dry) {
      state.ready = true;
      return;
    }
    checkPrereqs();
    state.cef = await ensureCef();
    state.sdl3Dir = await ensureSdl3();
    state.sodium = await ensureSodium();
    state.jsonDir = await ensureJson();
    state.mpv = await ensureMpvPrefix(state.env);
    await ensureSqlite();  // hors ligne : l'amalgamation que src/offline/sqlite.cmake lira
    state.ready = true;
  },
  async build() {
    await windows.prepare();
    const build = path.join(cache, "build", buildName());
    const binary = path.join(build, "app", "Tentacle.exe");
    if (dry) {
      console.log(`DRY build Windows → ${binary}`);
      return binary;
    }
    const opts = { env: state.env };
    if (!fs.existsSync(path.join(build, "build.ninja"))) {
      // Les chemins en barres obliques (`cmakePath`) : CMake les accepte sous Windows, et un
      // antislash dans une valeur de cache finit en séquence d'échappement ailleurs.
      run("cmake", ["-G", "Ninja", "-S", cmakePath(root), "-B", cmakePath(build),
        "-DCMAKE_BUILD_TYPE=Release",
        "-DCMAKE_MSVC_RUNTIME_LIBRARY=MultiThreaded",  // le CRT statique de CEF, wrapper compris
        `-DCEF_ROOT=${cmakePath(state.cef)}`,
        `-DSDL3_DIR=${cmakePath(state.sdl3Dir)}`,
        `-Dnlohmann_json_DIR=${cmakePath(state.jsonDir)}`,
        `-DMPV_PREFIX=${cmakePath(state.mpv)}`,
        `-DSODIUM_INCLUDE_DIR=${cmakePath(state.sodium.include)}`,
        `-DSODIUM_LIBRARY=${cmakePath(state.sodium.lib)}`,
        `-DTENTACLE_APP_VERSION=${desktopVersion()}`,
      ], opts);
    }
    run("ninja", ["-C", build], opts);
    if (!fs.existsSync(binary)) die(`exécutable absent après le build : ${binary}`);
    say(`build : ${binary}`);
    return binary;
  },
  env(env) {
    // Sous Windows, HOME n'existe pas hors Git Bash : le cache de l'app (args.cpp) est le même
    // dossier que celui du lanceur.
    return { ...env, TENTACLE_CEF_CACHE: cache };
  },
};
