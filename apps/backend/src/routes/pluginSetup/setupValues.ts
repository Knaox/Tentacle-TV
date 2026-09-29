import {
  isSetupUrl,
  SETUP_ENABLE_KEY,
  type PluginSetupMeta,
  type PluginSetupResult,
  type PluginSetupState,
} from "./pluginSetup";

/**
 * Ce que Tentacle fait des valeurs d'un formulaire `setup`, en logique pure :
 * les valider champ par champ, garder un secret déjà enregistré quand le champ
 * revient vide, et lire le verdict de la route de test du plugin.
 */

type Config = Record<string, unknown>;

export type ResolvedValues =
  | { ok: true; values: Record<string, string> }
  | { ok: false; field: string; reason: "missing" | "invalid" };

const MAX_LENGTH = 500;
const CODE_RE = /^[a-z0-9-]{1,40}$/;

const isRecord = (value: unknown): value is Config => typeof value === "object" && value !== null && !Array.isArray(value);
const stored = (config: Config, key: string): string => (typeof config[key] === "string" ? (config[key] as string).trim() : "");

/**
 * Les valeurs saisies, complétées et vérifiées. Un secret laissé vide garde
 * celui qui est enregistré : changer d'adresse ne demande pas de ressortir la
 * clé. Une adresse perd sa barre finale.
 */
export function resolveSetupValues(meta: PluginSetupMeta, typed: unknown, config: Config): ResolvedValues {
  const input = isRecord(typed) ? typed : {};
  const values: Record<string, string> = {};
  for (const field of meta.fields) {
    const raw = input[field.key];
    let value = typeof raw === "string" ? raw.trim() : "";
    if (!value && field.kind === "secret") value = stored(config, field.key);
    if (!value) {
      if (field.required) return { ok: false, field: field.key, reason: "missing" };
      continue;
    }
    if (value.length > MAX_LENGTH || (field.kind === "url" && !isSetupUrl(value))) {
      return { ok: false, field: field.key, reason: "invalid" };
    }
    values[field.key] = field.kind === "url" ? value.replace(/\/+$/, "") : value;
  }
  return { ok: true, values };
}

/** Ce que voit le formulaire : les valeurs non secrètes, et pour chaque secret s'il est posé. */
export function describeSetup(meta: PluginSetupMeta, config: Config): Omit<PluginSetupState, "setup"> {
  const values: Record<string, string> = {};
  const secrets: Record<string, boolean> = {};
  for (const field of meta.fields) {
    if (field.kind === "secret") secrets[field.key] = stored(config, field.key) !== "";
    else values[field.key] = stored(config, field.key);
  }
  return {
    values,
    secrets,
    configured: meta.fields.every((field) => !field.required || stored(config, field.key) !== ""),
    enabled: config[SETUP_ENABLE_KEY] === true,
  };
}

/** La configuration après un test réussi : les champs du formulaire, et l'intégration active. Le reste est gardé. */
export function applySetupValues(config: Config, values: Record<string, string>): Config {
  return { ...config, ...values, [SETUP_ENABLE_KEY]: true };
}

/**
 * Le verdict de la route de test, lu sans rien supposer du plugin. Une route
 * absente (module serveur pas encore chargé : le redémarrage n'a pas eu lieu)
 * se distingue d'une route qui répond autre chose qu'un verdict.
 */
export function readTestVerdict(status: number, body: unknown): Omit<PluginSetupResult, "saved"> {
  if (status === 404) return { ok: false, error: "plugin-not-running", version: null };
  const verdict = isRecord(body) ? body : {};
  const version = typeof verdict.version === "string" && verdict.version.trim() ? verdict.version.trim().slice(0, 40) : null;
  if (status < 200 || status >= 300 || typeof verdict.ok !== "boolean") return { ok: false, error: "test-failed", version: null };
  if (verdict.ok) return { ok: true, error: null, version };
  const code = typeof verdict.error === "string" && CODE_RE.test(verdict.error) ? verdict.error : "test-failed";
  return { ok: false, error: code, version };
}
