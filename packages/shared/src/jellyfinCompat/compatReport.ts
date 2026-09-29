/**
 * Le contrat de `GET /api/admin/jellyfin/compat` : la version de Jellyfin
 * installée et la dernière publiée, chacune jugée par le manifeste de
 * compatibilité (`compatVerdict.ts`), et ce que les sondes du serveur connecté
 * confirment.
 *
 * MIROIR : recopié octet pour octet dans
 * `apps/backend/src/services/jellyfinCompat/` — voir l'en-tête de
 * `compatManifest.ts`. N'importer que les fichiers du trio.
 */

import type { CompatBasis, CompatReason, CompatStatus, ResolvedFeature } from "./compatVerdict";

/** Ce que le document OpenAPI du Jellyfin connecté dit d'une fonctionnalité. */
export interface FeatureProbe {
  /** `present` : tout ce qu'elle exige y est publié ; `missing` : il y manque `missing`. */
  state: "present" | "missing";
  missing: string[];
}

export interface CompatFeatureView extends ResolvedFeature {
  /** `null` : rien à sonder (aucun endpoint déclaré), ou sondes indisponibles. */
  probe: FeatureProbe | null;
}

/** Une version de Jellyfin, jugée. */
export interface CompatVersionView {
  version: string;
  status: CompatStatus;
  reason: CompatReason;
  basis: CompatBasis | null;
  line: string | null;
  minTentacle: string | null;
  tentacleTooOld: boolean;
  features: CompatFeatureView[];
}

export interface CompatManifestInfo {
  revision: number;
  generatedAt: string | null;
  /** `embedded` : celui de l'image ; `remote` : une révision plus récente lue sur GitHub. */
  source: "embedded" | "remote";
  /** Dernière lecture du manifeste publié, réussie ou non. */
  remoteCheckedAt: string | null;
  remoteError: string | null;
  testedVersions: string[];
}

/** Pourquoi la version installée n'a pas pu être lue. */
export type InstalledFailure = "not-configured" | "unreachable" | "rejected" | "invalid";

export interface InstalledJellyfin extends CompatVersionView {
  serverName: string | null;
  /** `unavailable` : le document OpenAPI ne s'est pas lu, aucune capacité n'est confirmée. */
  probes: "ok" | "unavailable";
}

export interface LatestJellyfin extends CompatVersionView {
  tag: string;
  publishedAt: string | null;
  /** Les notes de version, sur GitHub. */
  url: string;
  /** Plus récente que l'installée ; `false` aussi quand l'installée est inconnue. */
  newer: boolean;
  /** Dernière lecture réussie de GitHub. */
  checkedAt: string | null;
}

export interface JellyfinCompatReport {
  checkedAt: string;
  tentacleServer: string;
  manifest: CompatManifestInfo | null;
  installed: InstalledJellyfin | null;
  installedError: InstalledFailure | null;
  latest: LatestJellyfin | null;
  /** GitHub n'a pas répondu et rien n'en est connu : `unreachable`, `rate-limited`, `invalid`. */
  latestError: string | null;
}
