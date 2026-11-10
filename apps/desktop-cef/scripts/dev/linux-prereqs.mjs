// Linux : ce qu'il faut sur la machine, et quoi installer — par distribution.
import fs from "node:fs";
import { capture, die, versionAtLeast, which } from "./common.mjs";

/** Famille de la distribution, d'après /etc/os-release (ID puis ID_LIKE). */
export function distroFamily() {
  let text = "";
  try {
    text = fs.readFileSync("/etc/os-release", "utf8");
  } catch {}
  const field = (k) => (new RegExp(`^${k}=(.*)$`, "m").exec(text)?.[1] || "").replaceAll('"', "");
  const ids = `${field("ID")} ${field("ID_LIKE")}`.split(/\s+/);
  const name = field("PRETTY_NAME") || field("ID") || "Linux";
  if (ids.some((i) => ["fedora", "rhel", "centos"].includes(i))) return { family: "fedora", name };
  if (ids.some((i) => ["debian", "ubuntu"].includes(i))) return { family: "debian", name };
  if (ids.some((i) => ["arch", "archlinux"].includes(i))) return { family: "arch", name };
  if (ids.some((i) => i.startsWith("opensuse") || i === "suse")) return { family: "suse", name };
  return { family: "unknown", name };
}

const installCmd = {
  fedora: "sudo dnf install",
  debian: "sudo apt install",
  arch: "sudo pacman -S --needed",
  suse: "sudo zypper install",
};

// Paquets par besoin : [fedora, debian, arch, suse].
const PKG = {
  cmake: ["cmake", "cmake", "cmake", "cmake"],
  ninja: ["ninja-build", "ninja-build", "ninja", "ninja"],
  cxx: ["gcc-c++", "g++", "gcc", "gcc-c++"],
  pkgconfig: ["pkgconf-pkg-config", "pkg-config", "pkgconf", "pkgconf-pkg-config"],
  bzip2: ["bzip2", "bzip2", "bzip2", "bzip2"],
  patch: ["patch", "patch", "patch", "patch"],
  meson: ["meson", "meson", "meson", "meson"],
  sdl3: ["SDL3-devel", "libsdl3-dev", "sdl3", "SDL3-devel"],
  json: ["json-devel", "nlohmann-json3-dev", "nlohmann-json", "nlohmann_json-devel"],
  wayland: ["wayland-devel", "libwayland-dev", "wayland", "wayland-devel"],
  protocols: ["wayland-protocols-devel", "wayland-protocols", "wayland-protocols", "wayland-protocols-devel"],
  xkb: ["libxkbcommon-devel", "libxkbcommon-dev", "libxkbcommon", "libxkbcommon-devel"],
  egl: ["libglvnd-devel", "libegl-dev libgles-dev", "libglvnd", "Mesa-libEGL-devel Mesa-libGLESv2-devel"],
  x11: ["libX11-devel", "libx11-dev", "libx11", "libX11-devel"],
  dbus: ["dbus-devel", "libdbus-1-dev", "dbus", "dbus-1-devel"],
  // Moteur de mise à jour (src/update) : libcurl (pile de l'OS) et libsodium (ed25519).
  curl: ["libcurl-devel", "libcurl4-openssl-dev", "curl", "libcurl-devel"],
  sodium: ["libsodium-devel", "libsodium-dev", "libsodium", "libsodium-devel"],
  // Notre libmpv (fork + correctifs) : ses dépendances de build.
  ffmpeg: [
    "ffmpeg-free-devel",
    "libavcodec-dev libavformat-dev libavutil-dev libavfilter-dev libswresample-dev libswscale-dev",
    "ffmpeg",
    "ffmpeg-devel",
  ],
  placebo: ["libplacebo-devel", "libplacebo-dev", "libplacebo", "libplacebo-devel"],
  ass: ["libass-devel", "libass-dev", "libass", "libass-devel"],
  vulkan: ["vulkan-loader-devel vulkan-headers", "libvulkan-dev", "vulkan-icd-loader vulkan-headers", "vulkan-devel"],
  audio: ["pipewire-devel pulseaudio-libs-devel alsa-lib-devel", "libpipewire-0.3-dev libpulse-dev libasound2-dev", "libpipewire libpulse alsa-lib", "pipewire-devel libpulse-devel alsa-devel"],
  va: ["libva-devel libdrm-devel", "libva-dev libdrm-dev", "libva libdrm", "libva-devel libdrm-devel"],
  // Repli : la libmpv de la distribution.
  libmpv: ["mpv-libs-devel", "libmpv-dev", "mpv", "mpv-devel"],
};
const COL = { fedora: 0, debian: 1, arch: 2, suse: 3 };

function pkgs(keys, family) {
  if (!(family in COL)) return keys.join(", ") + " (paquets de développement)";
  return [...new Set(keys.flatMap((k) => PKG[k][COL[family]].split(" ")))].join(" ");
}

export function installLine(keys, family) {
  if (!(family in installCmd)) return `à installer (noms indicatifs) : ${pkgs(keys, family)}`;
  return `${installCmd[family]} ${pkgs(keys, family)}`;
}

/** pkg-config --modversion, ou null. */
export function pkgVersion(mod) {
  return capture("pkg-config", ["--modversion", mod]);
}

/**
 * Prérequis du build natif (sans libmpv : voir mpv-linux.mjs, qui a son repli). Arrête le
 * lanceur avec LA commande d'installation de la distribution s'il manque quelque chose.
 */
export function checkBuildPrereqs(recommended = []) {
  const { family, name } = distroFamily();
  const missing = [];
  const cmakeV = /cmake version (\S+)/.exec(capture("cmake", ["--version"]) || "")?.[1];
  if (!cmakeV || !versionAtLeast(cmakeV, "3.24")) missing.push("cmake");
  if (!which("ninja") && !which("ninja-build")) missing.push("ninja");
  if (!which("c++") && !which("g++") && !which("clang++")) missing.push("cxx");
  if (!which("pkg-config") && !which("pkgconf")) missing.push("pkgconfig");
  if (!which("bzip2")) missing.push("bzip2");
  if (!which("patch")) missing.push("patch");
  const libs = [
    ["json", "nlohmann_json"],
    ["wayland", "wayland-client"],
    ["wayland", "wayland-egl"],
    ["wayland", "wayland-scanner"],
    ["protocols", "wayland-protocols"],
    ["xkb", "xkbcommon"],
    ["egl", "egl"],
    ["egl", "glesv2"],
    ["x11", "x11"],
    ["dbus", "dbus-1"],
    ["curl", "libcurl"],
    ["sodium", "libsodium"],
  ];
  // Sans pkg-config, on ne peut rien sonder : toute la liste, pour UNE seule commande à taper.
  const probe = which("pkg-config") || which("pkgconf") ? (mod) => pkgVersion(mod) : () => null;
  for (const [key, mod] of libs) if (!probe(mod) && !missing.includes(key)) missing.push(key);
  if (missing.length === 0) return { family, name };
  // UNE commande : l'indispensable, plus ce qui évite un repli (SDL3 du système, notre libmpv).
  const all = [...missing, ...recommended.filter((k) => !missing.includes(k))];
  console.error(`dev : prérequis manquants sur ${name} : ${all.join(", ")}`);
  console.error(`      ${installLine(all, family)}`);
  die("installer ces paquets puis relancer pnpm dev:cef");
}

/** SDL3 du système (>= 3.2), ou null : le lanceur construit alors la version épinglée. */
export function systemSdl3() {
  const v = pkgVersion("sdl3");
  return v && versionAtLeast(v, "3.2.0") ? v : null;
}

/** Bibliothèques que libcef.so ne trouve pas sur ce système (ldd), ou []. */
export function missingCefRuntime(libcef) {
  const out = capture("ldd", [libcef]) || "";
  return [...out.matchAll(/^\s*(\S+) => not found/gm)].map((m) => m[1]);
}

/** Paquets d'exécution de CEF (Chromium) — affichés quand ldd trouve un manque. */
export function cefRuntimeLine(family) {
  const runtime = {
    fedora: "nss atk at-spi2-atk cups-libs libdrm mesa-libgbm libXcomposite libXdamage libXrandr libxkbcommon pango alsa-lib libxshmfence",
    debian: "libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libgbm1 libxcomposite1 libxdamage1 libxrandr2 libxkbcommon0 libpango-1.0-0 libasound2 libxshmfence1",
    arch: "nss atk at-spi2-core libcups libdrm mesa libxcomposite libxdamage libxrandr libxkbcommon pango alsa-lib libxshmfence",
    suse: "mozilla-nss libatk-1_0-0 libatk-bridge-2_0-0 libcups2 libdrm2 libgbm1 libXcomposite1 libXdamage1 libXrandr2 libxkbcommon0 libpango-1_0-0 libasound2 libxshmfence1",
  };
  return family in runtime ? `${installCmd[family]} ${runtime[family]}` : "installer les bibliothèques d'exécution de Chromium (nss, atk, cups, gbm, Xcomposite…)";
}

export const mpvBuildKeys = ["meson", "ffmpeg", "placebo", "ass", "vulkan", "audio", "va"];
