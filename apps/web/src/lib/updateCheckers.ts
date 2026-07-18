import { fetchStoreVersions, pickManifestNotes } from "./storeVersions";

/**
 * Détection des mises à jour par canal store (macOS App Store / Microsoft
 * Store) — extraction de useAutoUpdate (limite 300 lignes). Le canal Linux a
 * déjà son module dédié (linuxUpdate.ts).
 */

/** Fiche App Store (achat universel iOS+macOS) — repli si absent du manifest. */
export const APP_STORE_ID = "6760205634";

/** Compare deux versions semver simples ("1.2.3"). true si `a` > `b`. */
export function isNewerVersion(a: string, b: string): boolean {
  const pa = a.replace(/^v/, "").split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.replace(/^v/, "").split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x > y) return true;
    if (x < y) return false;
  }
  return false;
}

/** Vérifie la dernière version macOS publiée via le manifest du repo
 *  (updates/store-versions.json). L'API iTunes Lookup ne référence PAS la
 *  fiche macOS d'une app en achat universel iOS+macOS (elle renvoie la fiche
 *  iOS ou rien) → l'ancienne détection était muette. Le manifest est patché
 *  automatiquement par la CI à chaque tag desktop-v*. */
export async function checkAppStoreUpdate(): Promise<{ version: string; notes?: string; storeUrl: string } | null> {
  // Version réelle du bundle en cours (1.0.0+), pas la constante de build web.
  const { getVersion } = await import("@tauri-apps/api/app");
  const current = await getVersion();

  const manifest = await fetchStoreVersions();
  const mac = manifest?.macAppStore;
  if (!mac?.version) return null;
  if (!isNewerVersion(mac.version, current)) return null;
  return {
    version: mac.version,
    notes: pickManifestNotes(mac.notes),
    storeUrl: `macappstore://apps.apple.com/app/id${mac.appId ?? APP_STORE_ID}`,
  };
}

interface MsixUpdateInfo {
  version: string;
  mandatory: boolean;
}

export interface MsixCheckResult {
  /** Numéro affiché dans la pastille — seulement si le manifest est cohérent. */
  displayVersion?: string;
  notes?: string;
}

/** Windows — Microsoft Store (WinRT StoreContext). ⚠️ Le natif ne connaît PAS
 *  la version de la MAJ : StorePackageUpdate.Package est le package INSTALLÉ
 *  (c'était la « version actuelle » affichée à tort). → détection par WinRT,
 *  version et notes par le manifest du repo. Retourne null si aucune MAJ. */
export async function checkMsixUpdate(): Promise<MsixCheckResult | null> {
  const { invoke } = await import("@tauri-apps/api/core");
  const update = await invoke<MsixUpdateInfo | null>("check_msix_update");
  if (!update) return null;
  let displayVersion: string | undefined;
  let notes: string | undefined;
  try {
    const { getVersion } = await import("@tauri-apps/api/app");
    const current = await getVersion();
    const ms = (await fetchStoreVersions())?.microsoftStore;
    if (ms?.version && isNewerVersion(ms.version, current)) {
      displayVersion = ms.version;
      notes = pickManifestNotes(ms.notes);
    }
  } catch { /* pastille de version simplement absente */ }
  return { displayVersion, notes };
}
