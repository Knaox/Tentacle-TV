/**
 * Auto-updater Linux universel (aucun store — l'updater Tauri ne gère pas
 * pacman). Réutilise le manifeste `updates/store-versions.json` (bloc `linux`)
 * et l'UI `UpdateModal`/`useAutoUpdate`. Trois étapes :
 *   1. checkLinuxUpdate()   — compare la version, détecte le format installé
 *                             (commande Rust) et résout l'asset correspondant.
 *   2. downloadLinuxUpdate() — télécharge (progression) + vérifie le SHA256 (Rust).
 *   3. applyLinuxUpdate()    — installe (pkexec deb/rpm/pacman ou self-swap
 *                             AppImage, Rust) puis relance l'app.
 */
import { fetchStoreVersions, pickManifestNotes } from "./storeVersions";
import { getVersion, invoke, listen, relaunch } from "../desktop/bridge";

const REPO = "Knaox/Tentacle-TV";

/** Format d'installation détecté côté Rust (`detect_linux_install_format`). */
export type LinuxFormat = "appimage" | "deb" | "rpm" | "pacman" | "unknown";

export interface LinuxUpdateFound {
  version: string;
  notes?: string;
  format: Exclude<LinuxFormat, "unknown">;
  url: string;
  sha256: string;
  fileName: string;
}

/** Compare deux versions semver simples ("1.2.3"). true si `a` > `b`. */
function isNewer(a: string, b: string): boolean {
  const pa = a.replace(/^v/, "").split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.replace(/^v/, "").split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return true;
    if ((pa[i] || 0) < (pb[i] || 0)) return false;
  }
  return false;
}

/**
 * Détecte une mise à jour Linux disponible pour CE format d'installation, ou
 * null (pas de MAJ, format inconnu/hors gestionnaire, ou asset manquant).
 */
export async function checkLinuxUpdate(): Promise<LinuxUpdateFound | null> {
  // Version réelle du bundle en cours (pas la constante de build).
  const current = await getVersion();

  const lin = (await fetchStoreVersions())?.linux;
  if (!lin?.version || !lin.tag || !isNewer(lin.version, current)) return null;

  // Format installé (AppImage/deb/rpm/pacman) — commande native dédiée.
  const format = await invoke<LinuxFormat>("detect_linux_install_format").catch(() => "unknown" as LinuxFormat);
  if (format === "unknown") return null; // installé hors d'un gestionnaire connu → on ne touche à rien

  const asset = lin.assets?.[format];
  if (!asset?.name) return null; // pas d'asset publié pour ce format sur cette release

  return {
    version: lin.version,
    notes: pickManifestNotes(lin.notes),
    format,
    fileName: asset.name,
    sha256: asset.sha256 ?? "",
    url: `https://github.com/${REPO}/releases/download/${lin.tag}/${encodeURIComponent(asset.name)}`,
  };
}

/**
 * Télécharge l'asset (via Rust : temp + progression + vérif SHA256) et renvoie
 * le chemin local. `onProgress` reçoit un pourcentage 0..100.
 */
export async function downloadLinuxUpdate(
  found: LinuxUpdateFound,
  onProgress: (pct: number) => void,
): Promise<string> {
  const unlisten = await listen<number>("linux-update-progress", (e) =>
    onProgress(Math.round((e.payload ?? 0) * 100)),
  );
  try {
    return await invoke<string>("download_update", {
      url: found.url,
      sha256: found.sha256,
      fileName: found.fileName,
    });
  } finally {
    unlisten();
  }
}

/**
 * Installe le paquet téléchargé (pkexec pour deb/rpm/pacman → invite polkit ;
 * remplacement direct pour AppImage) puis relance l'app. En cas de succès la
 * fonction NE REND PAS la main (relaunch). Throw sinon (pkexec absent, refus…).
 */
export async function applyLinuxUpdate(path: string, format: LinuxFormat): Promise<void> {
  await invoke("install_linux_update", { path, format });
  await relaunch();
}
