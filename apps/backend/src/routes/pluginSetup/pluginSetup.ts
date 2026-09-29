/**
 * Le contrat `setup` d'un manifeste de plugin (`plugin.json`) : ce qu'il faut
 * saisir pour brancher le plugin, et comment l'éprouver. Tentacle en fait un
 * formulaire — dans la vue d'ensemble de l'administration — sans rien savoir
 * du plugin : ses champs, ses mots et sa route de test viennent du manifeste.
 *
 *   "setup": {
 *     "title": { "fr": "Connexion à Jellyseerr", "en": "…" },
 *     "description": { "fr": "…", "en": "…" },
 *     "fields": [
 *       { "key": "url", "kind": "url", "required": true, "label": { "fr", "en" },
 *         "placeholder": "http://jellyseerr:5055", "hint": { "fr", "en" } },
 *       { "key": "apiKey", "kind": "secret", "required": true, "label": { "fr", "en" } }
 *     ],
 *     "test": "/admin/test-connection",
 *     "errors": { "invalid-key": { "fr": "…", "en": "…" } }
 *   }
 *
 * `test` est une route du serveur du plugin (sous `/api/plugins/<id>`) :
 * POST { <clé>: <valeur>… } → { ok: boolean, error?: string, version?: string }.
 * Tentacle enregistre les champs dans la configuration du plugin et pose
 * `enabled: true` seulement après un test réussi — l'administrateur n'a plus
 * d'interrupteur à basculer. Un secret ne redescend jamais au navigateur.
 *
 * MIROIR : recopié octet pour octet dans `apps/backend/src/routes/pluginSetup/`
 * (le backend ne dépend pas de `@tentacle-tv/shared`) ; `setupMirror.test.ts`
 * refuse toute divergence. Aucun import.
 */

export type SetupFieldKind = "url" | "secret" | "text";

export interface SetupText {
  fr: string;
  en: string;
}

export interface PluginSetupField {
  /** La clé de configuration du plugin où la valeur est rangée. */
  key: string;
  kind: SetupFieldKind;
  required: boolean;
  label: SetupText;
  placeholder: string | null;
  hint: SetupText | null;
}

export interface PluginSetupMeta {
  title: SetupText | null;
  description: SetupText | null;
  fields: PluginSetupField[];
  /** La route de test, sous la racine du plugin. */
  test: string;
  /** Les mots du plugin pour ses codes d'échec. */
  errors: Record<string, SetupText>;
}

/** `GET /api/plugins/:id/setup`. */
export interface PluginSetupState {
  setup: PluginSetupMeta;
  /** Les valeurs enregistrées des champs NON secrets. */
  values: Record<string, string>;
  /** Pour chaque champ secret : une valeur est enregistrée. La valeur, elle, reste au serveur. */
  secrets: Record<string, boolean>;
  /** Chaque champ requis a sa valeur. */
  configured: boolean;
  /** L'intégration est active (`config.enabled`). */
  enabled: boolean;
}

/** `POST /api/plugins/:id/setup/test` et `POST /api/plugins/:id/setup`. */
export interface PluginSetupResult {
  ok: boolean;
  /**
   * Le code d'échec : celui du plugin (« invalid-key »), ou l'un de Tentacle —
   * `plugin-not-running` (son module serveur n'est pas chargé : redémarrage à
   * faire), `test-failed` (la route a répondu autre chose qu'un verdict).
   */
  error: string | null;
  /** Ce que le test a joint dit sa version, s'il la dit. */
  version: string | null;
  /** Enregistré ET activé (`POST …/setup` seulement). */
  saved: boolean;
}

/** Posée par Tentacle après un test réussi : aucun champ ne peut la déclarer. */
export const SETUP_ENABLE_KEY = "enabled";

const KEY_RE = /^[A-Za-z][A-Za-z0-9_]{0,39}$/;
const SAFE_PATH = /^\/[A-Za-z0-9_\-/]{1,100}$/;
const KINDS: readonly string[] = ["url", "secret", "text"];
const MAX_FIELDS = 6;

type Json = Record<string, unknown>;
const isRecord = (value: unknown): value is Json => typeof value === "object" && value !== null && !Array.isArray(value);

function readText(value: unknown): SetupText | null {
  if (!isRecord(value) || typeof value.fr !== "string" || typeof value.en !== "string") return null;
  const fr = value.fr.trim();
  const en = value.en.trim();
  return fr && en ? { fr: fr.slice(0, 300), en: en.slice(0, 300) } : null;
}

function readField(raw: unknown): PluginSetupField | null {
  if (!isRecord(raw) || typeof raw.key !== "string" || !KEY_RE.test(raw.key) || raw.key === SETUP_ENABLE_KEY) return null;
  if (typeof raw.kind !== "string" || !KINDS.includes(raw.kind)) return null;
  const label = readText(raw.label);
  if (!label) return null;
  return {
    key: raw.key,
    kind: raw.kind as SetupFieldKind,
    required: raw.required === true,
    label,
    placeholder: typeof raw.placeholder === "string" && raw.placeholder.trim() ? raw.placeholder.trim().slice(0, 120) : null,
    hint: readText(raw.hint),
  };
}

/**
 * Le bloc `setup` d'un manifeste, ou `null` s'il manque ou ne se lit pas. Tout
 * ou rien : un formulaire à qui manquerait un champ enregistrerait un plugin à
 * moitié branché.
 */
export function readPluginSetupMeta(raw: unknown): PluginSetupMeta | null {
  if (!isRecord(raw) || typeof raw.test !== "string" || !SAFE_PATH.test(raw.test) || raw.test.includes("//")) return null;
  if (!Array.isArray(raw.fields) || raw.fields.length === 0 || raw.fields.length > MAX_FIELDS) return null;
  const fields = raw.fields.map(readField);
  if (fields.some((field) => field === null)) return null;
  const keys = new Set(fields.map((field) => field?.key));
  if (keys.size !== fields.length) return null;
  const errors: Record<string, SetupText> = {};
  for (const [code, text] of Object.entries(isRecord(raw.errors) ? raw.errors : {})) {
    const message = readText(text);
    if (message && /^[a-z0-9-]{1,40}$/.test(code)) errors[code] = message;
  }
  return {
    title: readText(raw.title),
    description: readText(raw.description),
    fields: fields as PluginSetupField[],
    test: raw.test,
    errors,
  };
}

/** Une adresse absolue en http(s) — la seule forme qu'accepte un champ `url`. */
export function isSetupUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") && url.hostname !== "";
  } catch {
    return false;
  }
}
