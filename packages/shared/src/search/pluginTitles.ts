/**
 * Ce qu'une extension sait dire et faire d'un titre HORS bibliothèque — pur,
 * sans React. Un plugin qui déclare `titles` dans son manifeste (relayé par
 * `/api/plugins/active`, cf. `pluginTitlesMeta.ts` côté serveur) répond, pour
 * un titre identifié par sa clé TMDB (« movie:603 », « tv:1399 ») :
 *
 *   - où il en est : une pastille (« Demandé », « En route »…) ;
 *   - quel geste il offre : le faire sur place (`direct`, un film qu'on
 *     demande d'un geste), ou ouvrir sa page pour un choix (`open`, les
 *     saisons d'une série).
 *
 * Tentacle ne sait RIEN de ce que « demander » veut dire chez le plugin : il
 * valide la forme, affiche les mots du plugin, et relaie le geste. Aucun
 * plugin actif ne déclare `titles` : aucune source, donc aucun bouton.
 */

import type { ExternalTone } from "./pluginSearch";

export type TitleMediaType = "movie" | "tv";
export type TitleKey = `${TitleMediaType}:${number}`;

/** Ce que la source lit d'un plugin actif (`/api/plugins/active`), réduit à ses champs utiles. */
export interface TitlesPlugin {
  pluginId: string;
  configEnabled?: boolean;
  titles?: { state: string; request?: string };
}

export interface TitleProvider {
  pluginId: string;
  statePath: string;
  /** `null` : le plugin dit où en sont les titres, sans offrir de les demander. */
  requestPath: string | null;
}

export interface TitleRequestOffer {
  /** `direct` : sur place ; `open` : la page du plugin, à `href`, pour un choix. */
  mode: "direct" | "open";
  /** Les mots du plugin (« Demander », « Choisir les saisons »). */
  label: string;
  href: string | null;
}

export interface TitleState {
  badge: { label: string; tone: ExternalTone } | null;
  request: TitleRequestOffer | null;
}

export type TitleRequestOutcome =
  | { kind: "done"; ok: boolean; message: string | null; state: TitleState | null }
  | { kind: "open"; href: string };

/** Au plus autant de titres par question au plugin (longueur d'URL). */
export const TITLE_STATE_BATCH = 60;

const SAFE_PATH = /^\/[A-Za-z0-9_\-/]{1,100}$/;
const KEY = /^(movie|tv):([1-9]\d{0,9})$/;
const TONES: readonly ExternalTone[] = ["neutral", "info", "success", "warning"];

function isSafePath(value: unknown): value is string {
  return typeof value === "string" && SAFE_PATH.test(value) && !value.includes("//");
}

function text(value: unknown, max: number): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim().slice(0, max) : null;
}

/* Un lien interne, jamais un autre site : le plugin désigne une de ses pages. */
function safeHref(value: unknown): string | null {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && value.length <= 300
    ? value
    : null;
}

export function titleKey(mediaType: TitleMediaType, tmdbId: number): TitleKey {
  return `${mediaType}:${tmdbId}`;
}

/** « series » (vocabulaire de la recherche) et « tv » (celui de TMDB) désignent la même chose. */
export function titleMediaType(kind: string): TitleMediaType {
  return kind === "movie" ? "movie" : "tv";
}

export function parseTitleKey(key: string): { mediaType: TitleMediaType; tmdbId: number } | null {
  const m = KEY.exec(key);
  if (!m) return null;
  const tmdbId = Number(m[2]);
  return Number.isSafeInteger(tmdbId) ? { mediaType: m[1] as TitleMediaType, tmdbId } : null;
}

/** La source des titres : le premier plugin actif, configuré, qui la déclare. */
export function titleProvider(plugins: readonly TitlesPlugin[]): TitleProvider | null {
  for (const plugin of plugins) {
    const titles = plugin.configEnabled === true ? plugin.titles : undefined;
    if (!titles || !isSafePath(titles.state)) continue;
    return {
      pluginId: plugin.pluginId,
      statePath: titles.state,
      requestPath: isSafePath(titles.request) ? titles.request : null,
    };
  }
  return null;
}

export function titleStateUrl(provider: TitleProvider, keys: readonly TitleKey[], lang: string): string {
  const params = new URLSearchParams({ keys: keys.join(","), lang });
  return `/api/plugins/${encodeURIComponent(provider.pluginId)}${provider.statePath}?${params.toString()}`;
}

export function titleRequestUrl(provider: TitleProvider): string | null {
  return provider.requestPath === null
    ? null
    : `/api/plugins/${encodeURIComponent(provider.pluginId)}${provider.requestPath}`;
}

/** Un état, validé champ par champ. Une offre sans lien quand il en faut un n'en est pas une. */
export function readTitleState(raw: unknown): TitleState | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const b = r.badge && typeof r.badge === "object" ? r.badge as Record<string, unknown> : null;
  const badgeLabel = b ? text(b.label, 40) : null;
  const q = r.request && typeof r.request === "object" ? r.request as Record<string, unknown> : null;
  let request: TitleRequestOffer | null = null;
  if (q && (q.mode === "direct" || q.mode === "open")) {
    const label = text(q.label, 60);
    const href = safeHref(q.href);
    if (label !== null && (q.mode === "direct" || href !== null)) request = { mode: q.mode, label, href };
  }
  return {
    badge: badgeLabel !== null
      ? { label: badgeLabel, tone: TONES.includes(b?.tone as ExternalTone) ? (b?.tone as ExternalTone) : "neutral" }
      : null,
    request,
  };
}

/** La réponse à une question sur des titres : seules les clés demandées comptent. */
export function readTitleStates(raw: unknown, keys: readonly TitleKey[]): Map<TitleKey, TitleState> {
  const out = new Map<TitleKey, TitleState>();
  const items = raw && typeof raw === "object" ? (raw as { items?: unknown }).items : null;
  if (!items || typeof items !== "object" || Array.isArray(items)) return out;
  for (const key of keys) {
    const state = readTitleState((items as Record<string, unknown>)[key]);
    if (state) out.set(key, state);
  }
  return out;
}

/** La réponse au geste « demander ». Illisible : `null`, l'appelant le dit comme un échec. */
export function readTitleRequestOutcome(raw: unknown): TitleRequestOutcome | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const href = safeHref(r.href);
  if (href !== null) return { kind: "open", href };
  if (typeof r.ok !== "boolean") return null;
  return { kind: "done", ok: r.ok, message: text(r.message, 200), state: readTitleState(r.state) };
}
