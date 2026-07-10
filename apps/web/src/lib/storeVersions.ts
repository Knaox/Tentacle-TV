/**
 * Manifest des versions publiées sur les stores desktop — source de vérité
 * `updates/store-versions.json` du repo GitHub public, maintenu à chaque bump.
 *
 * Pourquoi pas les APIs stores ? L'API iTunes Lookup ne référence pas la fiche
 * macOS d'une app en achat universel iOS+macOS (détection muette), et WinRT
 * n'expose pas la version d'une MAJ MSIX (StorePackageUpdate.Package = package
 * INSTALLÉ — c'était la « version actuelle » affichée à tort dans la popup).
 */
/** Un asset Linux (nom de fichier de la Release + son SHA256 pour vérif intégrité). */
export interface LinuxUpdateAsset { name: string; sha256: string }

export interface StoreVersionsManifest {
  macAppStore?: { version: string; appId?: string; notes?: { fr?: string; en?: string } };
  microsoftStore?: { version: string; notes?: { fr?: string; en?: string } };
  /** Auto-updater Linux (aucun store) : version + assets par format sur la
   *  Release `<tag>`. Maintenu par le workflow release-linux.yml. */
  linux?: {
    version: string;
    tag: string;
    notes?: { fr?: string; en?: string };
    assets?: Partial<Record<"appimage" | "deb" | "rpm" | "pacman", LinuxUpdateAsset>>;
  };
}

const MANIFEST_URL = "https://raw.githubusercontent.com/Knaox/Tentacle-TV/main/updates/store-versions.json";

export async function fetchStoreVersions(timeoutMs = 8000): Promise<StoreVersionsManifest | null> {
  try {
    const res = await fetch(MANIFEST_URL, { signal: AbortSignal.timeout(timeoutMs), cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as StoreVersionsManifest;
  } catch {
    return null;
  }
}

/** Notes localisées du manifest (langue UI, repli EN puis FR). */
export function pickManifestNotes(notes?: { fr?: string; en?: string }, lang = navigator.language): string | undefined {
  if (!notes) return undefined;
  return (lang?.toLowerCase().startsWith("fr") ? notes.fr : notes.en) ?? notes.en ?? notes.fr;
}
