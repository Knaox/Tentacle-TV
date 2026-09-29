/**
 * Le verdict d'UNE version de Jellyfin, tiré du manifeste de compatibilité
 * (`compatManifest.ts`) — pour la version installée comme pour la dernière
 * publiée. Cinq états, et jamais une devinette présentée comme un fait :
 *
 * - `compatible` : éprouvée, tout fonctionne ;
 * - `partial` : éprouvée, fonctionne, avec des manques — `gaps` les liste ;
 * - `presumed` : pas éprouvée elle-même, mais sa lignée l'a été (une 10.11.9
 *   quand la 10.11.8 l'est) — « compatible, non testée », d'après `basis` ;
 * - `untested` : rien n'en est connu ;
 * - `incompatible` : éprouvée et en échec, ou sous le minimum déclaré.
 *
 * MIROIR : recopié octet pour octet dans
 * `apps/backend/src/services/jellyfinCompat/` — voir l'en-tête de
 * `compatManifest.ts`. N'importer que les fichiers du trio.
 */

import {
  compareJellyfinVersions,
  isValidJellyfinVersion,
  type CompatFeature,
  type CompatManifest,
  type FeatureResult,
  type FeatureVerdict,
  type LocalizedText,
  type TestedVerdict,
  type TestedVersion,
} from "./compatManifest";

export type CompatStatus = "compatible" | "partial" | "presumed" | "untested" | "incompatible";

/** L'état d'une fonctionnalité pour une version : son verdict, ou « non testée ». */
export type FeatureState = FeatureVerdict | "untested";

export interface ResolvedFeature {
  id: string;
  area: string;
  critical: boolean;
  label: LocalizedText;
  state: FeatureState;
  note: LocalizedText | null;
  /** Première version de Jellyfin qui l'offre, pour dire « nouveauté de Jellyfin 12 ». */
  since: string | null;
  endpoints: string[];
}

/** Pourquoi ce statut : la version elle-même, sa lignée, le minimum, ou rien. */
export type CompatReason = "tested" | "line" | "below-minimum" | "unknown";

/** La version éprouvée dont le verdict est repris. */
export interface CompatBasis {
  version: string;
  verdict: TestedVerdict;
  ranAt: string | null;
  tentacleServer: string | null;
}

export interface CompatResolution {
  version: string;
  status: CompatStatus;
  reason: CompatReason;
  basis: CompatBasis | null;
  /** La lignée à laquelle la version se rattache, s'il y en a une. */
  line: string | null;
  /** Le catalogue, dans son ordre, sans les fonctionnalités sans objet pour cette version. */
  features: ResolvedFeature[];
  /** Ce qui manque ou cloche : les fonctionnalités partielles, en échec ou refusées. */
  gaps: ResolvedFeature[];
  /** Le verdict ne vaut qu'à partir de ce serveur Tentacle ; `null` : pour tous. */
  minTentacle: string | null;
  /** Le serveur Tentacle qui répond est plus ancien que `minTentacle`. */
  tentacleTooOld: boolean;
}

const GAP_STATES: ReadonlySet<FeatureState> = new Set(["partial", "fail", "unsupported"]);

/**
 * Le verdict global que méritent des résultats : `fail` dès qu'une
 * fonctionnalité CRITIQUE échoue, `partial` dès qu'une seule n'est pas `ok`,
 * `ok` sinon. La suite l'écrit dans le manifeste ; un test vérifie qu'on y lit
 * bien ce que la règle en tire.
 */
export function deriveTestedVerdict(
  results: Readonly<Record<string, FeatureResult>>,
  catalogue: readonly CompatFeature[],
): TestedVerdict {
  const critical = new Set(catalogue.filter((feature) => feature.critical).map((feature) => feature.id));
  const entries = Object.entries(results);
  if (entries.some(([id, result]) => result.verdict === "fail" && critical.has(id))) return "fail";
  if (entries.some(([, result]) => result.verdict !== "ok")) return "partial";
  return "ok";
}

/** Une fonctionnalité qui n'existe pas encore dans cette version de Jellyfin. */
const isNotApplicable = (feature: CompatFeature, version: string) =>
  feature.since !== null && compareJellyfinVersions(version, feature.since) < 0;

/** Le catalogue vu depuis `version` ; sans version éprouvée de référence, tout y est « non testé ». */
function resolveFeatures(catalogue: readonly CompatFeature[], basis: TestedVersion | null, version: string): ResolvedFeature[] {
  return catalogue
    .filter((feature) => !isNotApplicable(feature, version))
    .map((feature) => {
      const result = basis?.features[feature.id];
      return {
        id: feature.id,
        area: feature.area,
        critical: feature.critical,
        label: feature.label,
        state: result ? result.verdict : "untested",
        note: result?.note ?? null,
        since: feature.since,
        endpoints: feature.endpoints,
      };
    });
}

const STATUS_OF: Record<TestedVerdict, CompatStatus> = { ok: "compatible", partial: "partial", fail: "incompatible" };

function unknown(version: string, status: CompatStatus = "untested", reason: CompatReason = "unknown"): CompatResolution {
  return { version, status, reason, basis: null, line: null, features: [], gaps: [], minTentacle: null, tentacleTooOld: false };
}

/**
 * Le verdict de `version` d'après `manifest` ; `tentacleServer` (la version du
 * serveur Tentacle qui répond) sert à dire qu'un verdict exige un serveur plus
 * récent. Sans manifeste lisible, tout est « non testé ».
 */
export function resolveCompat(
  manifest: CompatManifest | null,
  version: string,
  tentacleServer: string | null = null,
): CompatResolution {
  if (!manifest || !isValidJellyfinVersion(version)) return unknown(version);
  if (manifest.minimum && compareJellyfinVersions(version, manifest.minimum) < 0) {
    return unknown(version, "incompatible", "below-minimum");
  }

  const inRange = (candidate: string, from: string, until: string) =>
    compareJellyfinVersions(candidate, from) >= 0 && compareJellyfinVersions(candidate, until) < 0;
  const line = manifest.lines.find((candidate) => inRange(version, candidate.from, candidate.until)) ?? null;
  const exact = manifest.versions.find((entry) => compareJellyfinVersions(entry.version, version) === 0);
  // Non éprouvée : la sœur de lignée la plus proche par en dessous (ce qu'on a
  // déjà vu marcher), sinon la première au-dessus.
  const siblings = line
    ? manifest.versions
      .filter((entry) => inRange(entry.version, line.from, line.until))
      .sort((a, b) => compareJellyfinVersions(a.version, b.version))
    : [];
  const basis: TestedVersion | undefined =
    exact ?? [...siblings].reverse().find((entry) => compareJellyfinVersions(entry.version, version) <= 0) ?? siblings[0];
  // Rien d'éprouvé : le catalogue reste montré, « non testé », pour que les
  // sondes du serveur connecté disent au moins ce qui y est présent.
  if (!basis) return { ...unknown(version), line: line?.id ?? null, features: resolveFeatures(manifest.features, null, version) };
  // Une sœur en échec ne dit rien de celle-ci : elle a pu être corrigée.
  const status: CompatStatus = exact
    ? STATUS_OF[exact.verdict]
    : basis.verdict === "fail" ? "untested" : "presumed";

  const features = resolveFeatures(manifest.features, basis, version);
  const minTentacle = basis.minTentacle;
  return {
    version,
    status,
    reason: exact ? "tested" : "line",
    basis: { version: basis.version, verdict: basis.verdict, ranAt: basis.ranAt, tentacleServer: basis.tentacle.server },
    line: line?.id ?? null,
    features,
    gaps: features.filter((feature) => GAP_STATES.has(feature.state)),
    minTentacle,
    tentacleTooOld:
      minTentacle !== null && tentacleServer !== null && compareJellyfinVersions(tentacleServer, minTentacle) < 0,
  };
}
