import { isNewerVersion } from "../lib/updateCheckers";
import type { WhatsNewRelease, WhatsNewSelectedFeature } from "./types";

export const WHATS_NEW_MAX_FEATURES = 12;

export interface WhatsNewSelection {
  features: WhatsNewSelectedFeature[];
  /** La version vue dont on part (`null` : tout le registre, crochet de développement). */
  from: string | null;
  /** La plus récente version retenue. */
  to: string | null;
  /** Plusieurs releases ont des nouveautés : l'en-tête dit « depuis la version… ». */
  spansReleases: boolean;
}

/**
 * Les nouveautés à montrer entre la version vue et la version courante : les
 * releases `seen < v ≤ current`, plus récentes d'abord, plafonnées. La borne
 * haute exclut un registre en avance sur le bundle. Une borne à `null` ne
 * borne pas — c'est le crochet de développement qui s'en sert pour tout
 * revoir ; la porte, elle, n'appelle jamais sans version vue : une première
 * installation n'affiche rien.
 */
export function selectWhatsNewFeatures(
  current: string | null,
  seen: string | null,
  releases: readonly WhatsNewRelease[],
  cap = WHATS_NEW_MAX_FEATURES,
): WhatsNewSelection {
  const kept = releases
    .filter(
      (release) =>
        (seen === null || isNewerVersion(release.version, seen)) &&
        (current === null || !isNewerVersion(release.version, current)),
    )
    .sort((a, b) => (isNewerVersion(a.version, b.version) ? -1 : isNewerVersion(b.version, a.version) ? 1 : 0));

  const features: WhatsNewSelectedFeature[] = [];
  for (const release of kept) {
    for (const feature of release.features) features.push({ ...feature, version: release.version });
  }
  const versionsWithFeatures = new Set(features.map((f) => f.version));
  return {
    features: features.slice(0, cap),
    from: seen,
    to: kept[0]?.version ?? null,
    spansReleases: versionsWithFeatures.size > 1,
  };
}
