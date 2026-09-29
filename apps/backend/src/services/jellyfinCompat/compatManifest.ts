/**
 * Le manifeste de compatibilité Jellyfin — ce que Tentacle SAIT de chaque
 * version de Jellyfin parce qu'une suite de tests l'a éprouvée
 * (`pnpm test:jellyfin-compat`), et non ce qu'il en devine.
 *
 * Le fichier, `compat/jellyfin.json`, est embarqué dans l'image du serveur
 * (connu hors ligne) et relu sur GitHub : un verdict nouveau arrive sans
 * nouvelle version du serveur. Ici la forme et la lecture ; `compatVerdict.ts`
 * en tire le verdict d'une version.
 *
 * La lecture est STRICTE : une seule entrée mal formée fait refuser tout le
 * manifeste. Un manifeste distant douteux ne remplace jamais celui qu'on a —
 * un verdict faux est pire qu'un verdict absent.
 *
 * MIROIR : recopié octet pour octet dans
 * `apps/backend/src/services/jellyfinCompat/` (le backend ne dépend pas de
 * `@tentacle-tv/shared` — tsc CommonJS, image Docker sans packages/). On le
 * modifie ICI, puis :
 *
 *   cp packages/shared/src/jellyfinCompat/{compat{Manifest,Verdict,Report},setupContract}.ts apps/backend/src/services/jellyfinCompat/
 *
 * `compatMirror.test.ts` (backend) refuse toute divergence. Aucun import hors
 * du trio : les fichiers compilent seuls des deux côtés.
 */

/** La forme que ce code sait lire. Une autre valeur fait refuser le fichier. */
export const JELLYFIN_COMPAT_SCHEMA = 1;

export interface LocalizedText { fr: string; en: string }

/** Le verdict global d'une version éprouvée. */
export type TestedVerdict = "ok" | "partial" | "fail";

/**
 * Le verdict d'une fonctionnalité sur une version éprouvée. `unsupported` : la
 * capacité devrait exister, mais ce serveur la refuse (réglage coupé…) — elle
 * compte comme un manque, contrairement à une fonctionnalité SANS OBJET, qui
 * n'apparaît simplement pas dans l'entrée de la version.
 */
export type FeatureVerdict = "ok" | "partial" | "fail" | "unsupported";

/** Une lignée de versions : une version non testée s'y rattache à ses sœurs éprouvées. */
export interface CompatLine {
  id: string;
  /** Première version de la lignée (incluse), puis la première HORS de la lignée (exclue). */
  from: string;
  until: string;
}

export interface CompatFeature {
  /** Identifiant stable, par zone : `segments.media-segments`. */
  id: string;
  area: string;
  /** Sans elle, Tentacle ne sert à rien : son échec rend la version incompatible. */
  critical: boolean;
  label: LocalizedText;
  /**
   * Ce que le Jellyfin connecté doit publier dans son document OpenAPI pour
   * l'offrir : « GET /MediaSegments/{itemId} ». Vérifié À L'EXÉCUTION.
   */
  endpoints: string[];
  /** Première version de Jellyfin qui l'offre ; en dessous, elle est sans objet. */
  since: string | null;
}

export interface FeatureResult {
  verdict: FeatureVerdict;
  checks: number | null;
  failed: number | null;
  /** Ce qui manque ou ce qui cloche, dit à l'administrateur. */
  note: LocalizedText | null;
}

export interface TestedVersion {
  /** La version EXACTE que rapporte `/System/Info` (« 12.1.0 »). */
  version: string;
  image: string | null;
  ranAt: string | null;
  tentacle: { server: string | null; commit: string | null };
  /** Le verdict ne vaut qu'à partir de ce serveur Tentacle ; `null` : pour tous. */
  minTentacle: string | null;
  verdict: TestedVerdict;
  features: Record<string, FeatureResult>;
}

export interface CompatManifest {
  schema: number;
  /** Croît à chaque publication : on n'accepte jamais une révision plus basse. */
  revision: number;
  generatedAt: string | null;
  /** En dessous, Jellyfin est déclaré incompatible. */
  minimum: string | null;
  lines: CompatLine[];
  areas: Record<string, LocalizedText>;
  features: CompatFeature[];
  versions: TestedVersion[];
}

export type ManifestParse = { ok: true; manifest: CompatManifest } | { ok: false; errors: string[] };

// ── Versions ──────────────────────────────────────────────────────────────

const VERSION_RE = /^v?(\d{1,4})(?:\.(\d{1,4})){0,3}$/;

/**
 * Les segments numériques d'une version Jellyfin — « 10.11.8 », « 12.1 »,
 * « v12.1 », « 12.1.0.0 » ; `null` pour tout le reste (pré-versions comprises :
 * elles ne sont jamais comparées à un verdict).
 */
export function parseJellyfinVersion(raw: string): number[] | null {
  const text = raw.trim();
  if (!VERSION_RE.test(text)) return null;
  return text.replace(/^v/, "").split(".").map((part) => Number(part));
}

/**
 * Négatif si `a` est plus ancienne que `b`, positif si plus récente, zéro si
 * égales — segments absents valant zéro : « 12.1 » vaut « 12.1.0 ». Une
 * version illisible se range avant toutes les autres.
 */
export function compareJellyfinVersions(a: string, b: string): number {
  const x = parseJellyfinVersion(a);
  const y = parseJellyfinVersion(b);
  if (!x || !y) return x ? 1 : y ? -1 : 0;
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const delta = (x[i] ?? 0) - (y[i] ?? 0);
    if (delta !== 0) return delta;
  }
  return 0;
}

export const isValidJellyfinVersion = (raw: unknown): raw is string =>
  typeof raw === "string" && parseJellyfinVersion(raw) !== null;

// ── Lecture ───────────────────────────────────────────────────────────────

type Json = Record<string, unknown>;

const isRecord = (value: unknown): value is Json => typeof value === "object" && value !== null && !Array.isArray(value);
const optionalText = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null);
const optionalCount = (value: unknown): number | null => (typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null);
/** Absente, nulle, ou une version lisible : tout le reste est une faute. */
const isOptionalVersion = (value: unknown) => value === undefined || value === null || isValidJellyfinVersion(value);

const TESTED_VERDICTS: readonly string[] = ["ok", "partial", "fail"];
const FEATURE_VERDICTS: readonly string[] = ["ok", "partial", "fail", "unsupported"];
const ENDPOINT_RE = /^(GET|POST|PUT|DELETE|PATCH|HEAD) \/\S*$/;

function readText(value: unknown): LocalizedText | null {
  if (!isRecord(value) || typeof value.fr !== "string" || typeof value.en !== "string") return null;
  if (value.fr.trim() === "" || value.en.trim() === "") return null;
  return { fr: value.fr, en: value.en };
}

/** Une note : `{ fr, en }`, ou un texte seul, alors montré dans les deux langues. */
function readNote(value: unknown): LocalizedText | null {
  if (typeof value === "string" && value.trim() !== "") return { fr: value, en: value };
  return readText(value);
}

function readLine(raw: unknown, errors: string[]): CompatLine | null {
  if (!isRecord(raw) || typeof raw.id !== "string" || !isValidJellyfinVersion(raw.from) || !isValidJellyfinVersion(raw.until)) {
    errors.push(`lignée illisible : ${JSON.stringify(raw)}`);
    return null;
  }
  if (compareJellyfinVersions(raw.from, raw.until) >= 0) errors.push(`lignée ${raw.id} vide (from ≥ until)`);
  return { id: raw.id, from: raw.from, until: raw.until };
}

function readFeature(raw: unknown, errors: string[]): CompatFeature | null {
  if (!isRecord(raw) || typeof raw.id !== "string" || raw.id === "" || typeof raw.area !== "string") {
    errors.push(`fonctionnalité illisible : ${JSON.stringify(raw)?.slice(0, 120)}`);
    return null;
  }
  const label = readText(raw.label);
  if (!label) errors.push(`fonctionnalité ${raw.id} : libellé { fr, en } manquant`);
  const endpoints: unknown[] = Array.isArray(raw.endpoints) ? raw.endpoints : raw.endpoints === undefined ? [] : [null];
  if (!endpoints.every((e) => typeof e === "string" && ENDPOINT_RE.test(e))) {
    errors.push(`fonctionnalité ${raw.id} : endpoints attendus sous la forme « GET /Chemin »`);
  }
  if (!isOptionalVersion(raw.since)) errors.push(`fonctionnalité ${raw.id} : since illisible`);
  return {
    id: raw.id,
    area: raw.area,
    critical: raw.critical === true,
    label: label ?? { fr: raw.id, en: raw.id },
    endpoints: endpoints.filter((e): e is string => typeof e === "string"),
    since: isValidJellyfinVersion(raw.since) ? raw.since : null,
  };
}

function readFeatureResult(id: string, raw: unknown, errors: string[]): FeatureResult | null {
  const record: Json = typeof raw === "string" ? { verdict: raw } : isRecord(raw) ? raw : {};
  if (typeof record.verdict !== "string" || !FEATURE_VERDICTS.includes(record.verdict)) {
    errors.push(`résultat de ${id} illisible : ${JSON.stringify(raw)?.slice(0, 120)}`);
    return null;
  }
  return {
    verdict: record.verdict as FeatureVerdict,
    checks: optionalCount(record.checks),
    failed: optionalCount(record.failed),
    note: readNote(record.note),
  };
}

function readVersion(raw: unknown, errors: string[]): TestedVersion | null {
  if (!isRecord(raw) || !isValidJellyfinVersion(raw.version)) {
    errors.push(`version illisible : ${JSON.stringify(isRecord(raw) ? raw.version : raw)}`);
    return null;
  }
  const where = `version ${raw.version}`;
  if (typeof raw.verdict !== "string" || !TESTED_VERDICTS.includes(raw.verdict)) {
    errors.push(`${where} : verdict attendu ok, partial ou fail`);
    return null;
  }
  if (!isOptionalVersion(raw.minTentacle)) errors.push(`${where} : minTentacle illisible`);
  const features: Record<string, FeatureResult> = {};
  if (!isRecord(raw.features)) errors.push(`${where} : features attendu sous la forme { id: verdict }`);
  else {
    for (const [id, value] of Object.entries(raw.features)) {
      const result = readFeatureResult(`${where} › ${id}`, value, errors);
      if (result) features[id] = result;
    }
  }
  const tentacle = isRecord(raw.tentacle) ? raw.tentacle : {};
  return {
    version: raw.version,
    image: optionalText(raw.image),
    ranAt: optionalText(raw.ranAt),
    tentacle: { server: optionalText(tentacle.server), commit: optionalText(tentacle.commit) },
    minTentacle: isValidJellyfinVersion(raw.minTentacle) ? raw.minTentacle : null,
    verdict: raw.verdict as TestedVerdict,
    features,
  };
}

function readList<T>(raw: unknown, name: string, read: (item: unknown, errors: string[]) => T | null, errors: string[]): T[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) {
    errors.push(`${name} attendu sous la forme d'une liste`);
    return [];
  }
  return raw.map((item) => read(item, errors)).filter((item): item is T => item !== null);
}

/** Lit un manifeste — et dit tout ce qui ne va pas, plutôt que de s'arrêter au premier défaut. */
export function parseCompatManifest(raw: unknown): ManifestParse {
  if (!isRecord(raw)) return { ok: false, errors: ["le manifeste n'est pas un objet JSON"] };
  if (raw.schema !== JELLYFIN_COMPAT_SCHEMA) {
    return { ok: false, errors: [`schéma ${JSON.stringify(raw.schema)} inconnu (attendu ${String(JELLYFIN_COMPAT_SCHEMA)})`] };
  }
  const errors: string[] = [];
  if (typeof raw.revision !== "number" || !Number.isInteger(raw.revision) || raw.revision < 0) {
    errors.push("revision attendue : un entier positif ou nul");
  }
  if (!isOptionalVersion(raw.minimum)) errors.push("minimum illisible");
  const areas: Record<string, LocalizedText> = {};
  if (raw.areas !== undefined && !isRecord(raw.areas)) errors.push("areas attendu sous la forme { id: { fr, en } }");
  for (const [id, value] of Object.entries(isRecord(raw.areas) ? raw.areas : {})) {
    const label = readText(value);
    if (label) areas[id] = label;
    else errors.push(`zone ${id} : libellé { fr, en } manquant`);
  }
  const lines = readList(raw.lines, "lines", readLine, errors);
  const features = readList(raw.features, "features", readFeature, errors);
  const versions = readList(raw.versions, "versions", readVersion, errors);

  const featureIds = new Set<string>();
  for (const feature of features) {
    if (featureIds.has(feature.id)) errors.push(`fonctionnalité ${feature.id} en double`);
    featureIds.add(feature.id);
  }
  const seen: string[] = [];
  for (const entry of versions) {
    if (seen.some((other) => compareJellyfinVersions(other, entry.version) === 0)) {
      errors.push(`version ${entry.version} en double`);
    }
    seen.push(entry.version);
    for (const id of Object.keys(entry.features)) {
      if (!featureIds.has(id)) errors.push(`version ${entry.version} : fonctionnalité ${id} absente du catalogue`);
    }
  }
  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    manifest: {
      schema: JELLYFIN_COMPAT_SCHEMA,
      revision: raw.revision as number,
      generatedAt: optionalText(raw.generatedAt),
      minimum: isValidJellyfinVersion(raw.minimum) ? raw.minimum : null,
      lines,
      areas,
      features,
      versions,
    },
  };
}
