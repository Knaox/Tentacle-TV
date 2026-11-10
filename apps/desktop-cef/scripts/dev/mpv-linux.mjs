// Linux : notre libmpv (fork + correctifs), sinon celle de la distribution, dit à l'écran.
//   base       : andrewrabert/mpv, branche jellium-desktop (ab0467ff24) — la même que macOS
//   correctifs : scripts/deps/mpv-patches/*.patch (communs : 0001 n'agit que sous macOS,
//                0002/0003 sont le lecteur) puis scripts/deps/mpv-patches-linux/*.patch
//   build LGPL (-Dgpl=false : le X11 de mpv est GPL, notre vidéo X11 passe par l'API de rendu)
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { cache, root, run, say, warn, which } from "./common.mjs";
import { fetchArchive } from "./fetch.mjs";
import { installLine, mpvBuildKeys, pkgVersion } from "./linux-prereqs.mjs";

export const MPV_BASE = {
  sha: "ab0467ff24c2efc995b2b6e6b50a8b0912d373a6",
  // Archive GitHub du commit (stable) : SHA-256 calculée le 10/11/2026 (7,4 Mo).
  sha256: "b457806bfdbd7cda1baec1d69812ca1fdd47d73088c7340dbcf5e462df1b709a",
};

function patchFiles() {
  const dirs = ["scripts/deps/mpv-patches", "scripts/deps/mpv-patches-linux"].map((d) => path.join(root, d));
  return dirs.flatMap((d) => (fs.existsSync(d) ? fs.readdirSync(d).filter((f) => f.endsWith(".patch")).sort().map((f) => path.join(d, f)) : []));
}

/** Identifiant REPRODUCTIBLE du jeu (base + correctifs) : nomme le préfixe d'installation. */
function setId(patches) {
  const h = createHash("sha256").update(MPV_BASE.sha);
  for (const p of patches) h.update(fs.readFileSync(p));
  return h.digest("hex").slice(0, 8);
}

/** Ce qui manque pour construire notre libmpv (clés de linux-prereqs.mjs). */
export function mesonDepsMissing() {
  const missing = [];
  if (!which("meson")) missing.push("meson");
  const need = { ffmpeg: ["libavcodec", "libavformat", "libavfilter", "libswresample", "libswscale"], placebo: ["libplacebo"], ass: ["libass"], vulkan: ["vulkan"] };
  for (const [key, mods] of Object.entries(need)) if (mods.some((m) => !pkgVersion(m))) missing.push(key);
  if (!pkgVersion("libpipewire-0.3") && !pkgVersion("libpulse") && !pkgVersion("alsa")) missing.push("audio");
  if (!pkgVersion("libva")) missing.push("va");  // décodage matériel VA-API (facultatif pour meson)
  return missing;
}

/**
 * Renvoie { kind: "fork" | "system", prefix?, warning? } :
 *  - fork   : préfixe $cache/deps/mpv/linux-<id> (lib/, include/), construit une fois ;
 *  - system : la libmpv de la distribution (pkg-config mpv), avec l'avertissement à afficher.
 * TENTACLE_MPV=system force le repli ; TENTACLE_MPV_PREFIX=<préfixe> impose un préfixe.
 */
export async function ensureLibmpv(family) {
  if (process.env.TENTACLE_MPV_PREFIX) return { kind: "fork", prefix: process.env.TENTACLE_MPV_PREFIX };
  const patches = patchFiles();
  const prefix = path.join(cache, "deps", "mpv", `linux-${setId(patches)}`);
  if (fs.existsSync(path.join(prefix, "lib", "libmpv.so"))) return { kind: "fork", prefix };
  let why = null;
  if (process.env.TENTACLE_MPV === "system") why = "TENTACLE_MPV=system";
  const missing = why ? [] : mesonDepsMissing();
  if (!why && missing.length) why = `dépendances de build absentes (${installLine(missing, family)})`;
  if (!why) {
    try {
      await buildFork(patches, prefix);
      return { kind: "fork", prefix };
    } catch (e) {
      why = `échec du build du fork : ${e.message}`;
    }
  }
  if (!pkgVersion("mpv")) {
    throw new Error(`libmpv introuvable : ni le fork (${why}), ni celle de la distribution — ${installLine(["libmpv"], family)}, ou pour le fork : ${installLine(mpvBuildKeys, family)}`);
  }
  return {
    kind: "system",
    warning:
      `libmpv de la distribution (${pkgVersion("mpv")}) au lieu du fork — ${why}. ` +
      "Sans les correctifs 0002/0003, changer de piste audio ou de sous-titres vide le cache et " +
      "une bascule audio peut figer l'image ; sous Wayland, la vidéo passe par l'API de rendu (pas de HDR).",
  };
}

async function buildFork(patches, prefix) {
  const srcRoot = path.join(cache, "deps", "mpv-src-linux");
  const src = await fetchArchive({
    url: `https://github.com/andrewrabert/mpv/archive/${MPV_BASE.sha}.tar.gz`,
    pin: { sha256: MPV_BASE.sha256 },
    dest: path.join(srcRoot, MPV_BASE.sha.slice(0, 10)),
    inner: `mpv-${MPV_BASE.sha}`,
    marker: "meson.build",
    sizeHint: 7.4e6,
    what: "sources de mpv (fork)",
    small: true,
  });
  // Une copie de travail par jeu de correctifs : la source téléchargée reste vierge.
  const work = `${prefix}.src`;
  if (!fs.existsSync(path.join(work, ".patched"))) {
    fs.rmSync(work, { recursive: true, force: true });
    fs.cpSync(src, work, { recursive: true });
    for (const p of patches) {
      say(`mpv : correctif ${path.basename(p)}`);
      run("patch", ["-p1", "--forward", "--quiet", "-d", work, "-i", p]);
    }
    fs.writeFileSync(path.join(work, ".patched"), patches.map((p) => path.basename(p)).join("\n"));
  }
  const build = path.join(work, "build");
  if (!fs.existsSync(path.join(build, "build.ninja"))) {
    run("meson", [
      "setup", build, work, `--prefix=${prefix}`, "--libdir=lib", "--buildtype=release",
      "-Dgpl=false", "-Dlibmpv=true", "-Dcplayer=false", "-Dvulkan=enabled", "-Dwayland=enabled",
      "-Degl=enabled", "-Dlua=disabled", "-Djavascript=disabled", "-Dmanpage-build=disabled",
      "-Drubberband=disabled", "-Dvapoursynth=disabled",
    ]);
  }
  run(which("ninja") ? "ninja" : "ninja-build", ["-C", build, `-j${jobs()}`]);
  run(which("ninja") ? "ninja" : "ninja-build", ["-C", build, "install"], { stdio: ["inherit", "ignore", "inherit"] });
  say(`libmpv (fork) prête : ${prefix}`);
}

/** Fils de build : TENTACLE_JOBS, sinon tous les cœurs. */
export function jobs() {
  const forced = parseInt(process.env.TENTACLE_JOBS || "", 10);
  if (forced > 0) return forced;
  return Math.max(1, (globalThis.navigator?.hardwareConcurrency ?? 2));
}

export function warnLibmpv(mpv) {
  if (mpv.warning) warn(mpv.warning);
}
