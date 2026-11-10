// CEF épinglé, par OS et architecture. La version est celle de scripts/deps/cef-version.env
// (macOS : scripts/deps/fetch-cef.sh, inchangé) ; ici les autres plateformes, même version.
import fs from "node:fs";
import path from "node:path";
import { cache, die, root } from "./common.mjs";
import { fetchArchive } from "./fetch.mjs";

/** CEF_VERSION de cef-version.env : UNE version pour les trois OS. */
export function cefVersion() {
  const env = fs.readFileSync(path.join(root, "scripts/deps/cef-version.env"), "utf8");
  const v = /^CEF_VERSION="([^"]+)"/m.exec(env)?.[1];
  if (!v) die("CEF_VERSION introuvable dans scripts/deps/cef-version.env");
  return v;
}

/**
 * Empreintes de la distribution « minimal » du CDN de CEF (cef-builds.spotifycdn.com) pour
 * CETTE version. sha1 : publiée par l'index du CDN (index.json, relu le 10/11/2026) ; sha256 :
 * calculée sur l'archive téléchargée. Changer de version = refaire toute la table.
 */
export const CEF_PINS = {
  version: "156.0.15+gcf671c0+chromium-156.0.8078.80",
  linux64: {
    sha1: "09235427222e026a4f34399742df27c5d98a4f8a",
    sha256: "6873f975bb047316680ea1839980ed5bd4c33c8cd4ce45761c94211856605388",  // 10/11, téléchargée sur le Mac
    size: 333318600,
  },
  linuxarm64: {
    sha1: "85602db8e813ad824b45ae54218476aa3d91d561",
    sha256: "806663a9eca2a8f7be185480ce7e779c5864b5cdd52bd77489053bdb1933feb8",  // 10/11, banc Fedora 44
    size: 431229830,
  },
  windows64: {
    sha1: "b690e035689ee20ba9d2500ac8953815bc7ed46a",
    sha256: "371efdf09dce30569d9a0880727be79fea96ab5ba6f7be533c9332bb0790385a",  // 10/11, axe windows
    size: 174836914,
  },
  windowsarm64: { sha1: "446515cfaed802200749083ea64f8718e885c91f", sha256: null, size: 170136968 },
};

/** Plateforme CEF de cette machine (« linux64 », « linuxarm64 », « windows64 »…). */
export function cefPlatform() {
  const arch = process.arch;
  if (process.platform === "linux") {
    if (arch === "x64") return "linux64";
    if (arch === "arm64") return "linuxarm64";
  } else if (process.platform === "win32") {
    if (arch === "x64") return "windows64";
    if (arch === "arm64") return "windowsarm64";
  }
  die(`aucune distribution CEF épinglée pour ${process.platform}/${arch}`);
}

/** Distribution CEF prête pour cette machine ; renvoie sa racine (CEF_ROOT). */
export async function ensureCef() {
  const version = cefVersion();
  if (version !== CEF_PINS.version) {
    die(`cef-version.env (${version}) et scripts/dev/cef.mjs (${CEF_PINS.version}) divergent : mettre la table à jour`);
  }
  const plat = cefPlatform();
  const pin = CEF_PINS[plat];
  const name = `cef_binary_${version}_${plat}_minimal`;
  const url = `https://cef-builds.spotifycdn.com/${name.replaceAll("+", "%2B")}.tar.bz2`;
  return fetchArchive({
    url,
    pin,
    dest: path.join(cache, "deps", "cef", version),
    inner: name,
    marker: "include/cef_version.h",
    sizeHint: pin.size,
    what: `CEF ${plat} (~${Math.round(pin.size / 1e6)} Mo)`,
  });
}
