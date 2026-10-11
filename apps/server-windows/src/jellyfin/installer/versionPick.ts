/**
 * Quelle version de Jellyfin installer : la plus récente version STABLE que
 * Tentacle a éprouvée et notée `ok` dans `compat/jellyfin.json` — jamais la
 * dernière tout court (le jour de sa sortie, elle n'est éprouvée par
 * personne), et jamais une pré-version.
 *
 * Le manifeste dit « 12.1.0 », le dépôt de Jellyfin nomme « 12.1 » (et
 * « 10.11.11 » sur trois chiffres) : on compare en X.Y.Z (« X.Y » vaut
 * « X.Y.0 »), et on essaie les deux noms sur le dépôt.
 */

export interface PickedVersion {
  /** La version du manifeste, en X.Y.Z. */
  version: string;
  /** Les noms à essayer sur `repo.jellyfin.org`, le plus probable d'abord. */
  repoNames: string[];
}

const STABLE = /^(\d{1,4})\.(\d{1,4})(?:\.(\d{1,4}))?$/;

/** « 12.1 » → [12, 1, 0] ; `null` pour une pré-version ou une forme inconnue. */
export function stableParts(version: string): [number, number, number] | null {
  const match = STABLE.exec(version.trim().replace(/^v/, ""));
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3] ?? 0)];
}

function compareParts(a: readonly number[], b: readonly number[]): number {
  for (let i = 0; i < 3; i++) {
    const delta = (a[i] ?? 0) - (b[i] ?? 0);
    if (delta !== 0) return delta;
  }
  return 0;
}

export function repoNamesFor(parts: readonly [number, number, number]): string[] {
  const full = parts.join(".");
  return parts[2] === 0 ? [`${parts[0]}.${parts[1]}`, full] : [full];
}

/** `null` : aucune version notée `ok` (manifeste illisible ou vide). */
export function pickInstallVersion(manifest: unknown): PickedVersion | null {
  const versions = (manifest as { versions?: unknown } | null)?.versions;
  if (!Array.isArray(versions)) return null;
  let best: [number, number, number] | null = null;
  for (const entry of versions as { version?: unknown; verdict?: unknown }[]) {
    if (entry?.verdict !== "ok" || typeof entry.version !== "string") continue;
    const parts = stableParts(entry.version);
    if (parts && (best === null || compareParts(parts, best) > 0)) best = parts;
  }
  return best ? { version: best.join("."), repoNames: repoNamesFor(best) } : null;
}

/** Le manifeste à la révision la plus haute : le serveur en garde un plus récent que celui du paquet. */
export function newestManifest(texts: readonly (string | null)[]): unknown {
  let best: { revision: number; manifest: unknown } | null = null;
  for (const text of texts) {
    if (text === null) continue;
    try {
      const manifest = JSON.parse(text) as { revision?: unknown };
      const revision = typeof manifest.revision === "number" ? manifest.revision : 0;
      if (best === null || revision > best.revision) best = { revision, manifest };
    } catch {
      /* un manifeste illisible ne compte pas */
    }
  }
  return best?.manifest ?? null;
}
