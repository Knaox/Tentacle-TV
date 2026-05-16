import { createHash } from "crypto";
import { z } from "zod";
import {
  deleteConfigValue,
  getConfigValue,
  setConfigValue,
} from "./configStore";

/**
 * Persistence layer for the global Tentacle TV theme (server-wide, admin-only).
 *
 * Storage uses the existing `ServerConfig` key/value model. Keys are namespaced
 * with `theme_active_*` so future per-user themes can live under
 * `theme_user_<id>_*` without colliding.
 */

const KEY_NAME = "theme_active_name";
const KEY_TOKENS_OVERRIDE = "theme_active_tokens_override";
const KEY_CSS_SOURCE = "theme_active_css_source";
const KEY_CSS_CONTENT = "theme_active_css_content";
const KEY_CSS_URL = "theme_active_css_url";
const KEY_CSS_HASH = "theme_active_css_hash";

const DEFAULT_THEME_ID = "tentacle-active";
const DEFAULT_THEME_NAME = "Tentacle Default";

const MAX_CSS_BYTES = 2 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 10_000;
const MAX_URL_LENGTH = 4096;
const MAX_NAME_LENGTH = 80;

const leaf = z.string().min(1).max(1024);
const oneLevel = z.record(z.string().regex(/^[a-zA-Z0-9_-]+$/), leaf);
const twoLevel = z.record(z.string().regex(/^[a-zA-Z0-9_-]+$/), oneLevel);

/**
 * Bounded schema for `PartialThemeTokens` (see `packages/theme/src/types.ts`).
 * Permissive on key names (any matching the category structure) but rejects
 * unknown top-level groups and caps leaf length so the table doesn't grow
 * unbounded. Frontend handles defaulting via `mergeTheme(DEFAULT_THEME, …)`.
 */
export const partialThemeTokensSchema = z
  .object({
    color: z
      .object({
        surface: oneLevel.optional(),
        brand: oneLevel.optional(),
        text: oneLevel.optional(),
        cta: oneLevel.optional(),
        border: oneLevel.optional(),
        status: twoLevel.optional(),
      })
      .strict()
      .optional(),
    blur: oneLevel.optional(),
    shadow: oneLevel.optional(),
    radius: oneLevel.optional(),
    motion: z
      .object({
        easing: oneLevel.optional(),
        duration: oneLevel.optional(),
        hoverDelay: leaf.optional(),
        hoverScale: leaf.optional(),
      })
      .strict()
      .optional(),
    layout: oneLevel.optional(),
    component: oneLevel.optional(),
    spacing: oneLevel.optional(),
    typography: z
      .object({
        fontFamily: oneLevel.optional(),
        fontSize: oneLevel.optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export type PartialThemeTokens = z.infer<typeof partialThemeTokensSchema>;

export type CssSource = "inline" | "url";

export interface ThemeState {
  id: string;
  name: string;
  tokens: PartialThemeTokens;
  customCss: {
    source: CssSource | null;
    url: string | null;
    hash: string | null;
    hasContent: boolean;
  };
}

const hashCss = (css: string): string =>
  createHash("sha256").update(css, "utf8").digest("hex").slice(0, 16);

const parseTokensJson = (raw: string | undefined): PartialThemeTokens => {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    const result = partialThemeTokensSchema.safeParse(parsed);
    return result.success ? result.data : {};
  } catch {
    return {};
  }
};

export function getThemeState(): ThemeState {
  const sourceRaw = getConfigValue(KEY_CSS_SOURCE);
  const source: CssSource | null =
    sourceRaw === "inline" || sourceRaw === "url" ? sourceRaw : null;
  const content = getConfigValue(KEY_CSS_CONTENT);
  return {
    id: DEFAULT_THEME_ID,
    name: getConfigValue(KEY_NAME) ?? DEFAULT_THEME_NAME,
    tokens: parseTokensJson(getConfigValue(KEY_TOKENS_OVERRIDE)),
    customCss: {
      source,
      url: source === "url" ? getConfigValue(KEY_CSS_URL) ?? null : null,
      hash: getConfigValue(KEY_CSS_HASH) ?? null,
      hasContent: !!(source && content),
    },
  };
}

export function getActiveCustomCss(): { content: string; hash: string } | null {
  const content = getConfigValue(KEY_CSS_CONTENT);
  const hash = getConfigValue(KEY_CSS_HASH);
  if (!content || !hash) return null;
  return { content, hash };
}

export async function setThemeName(name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) {
    await deleteConfigValue(KEY_NAME);
    return;
  }
  if (trimmed.length > MAX_NAME_LENGTH) {
    throw new Error(`Theme name exceeds ${MAX_NAME_LENGTH} characters`);
  }
  await setConfigValue(KEY_NAME, trimmed);
}

export async function setTokensOverride(
  tokens: PartialThemeTokens,
): Promise<void> {
  await setConfigValue(KEY_TOKENS_OVERRIDE, JSON.stringify(tokens));
}

export async function clearTokensOverride(): Promise<void> {
  await deleteConfigValue(KEY_TOKENS_OVERRIDE);
}

export async function setCustomCssInline(content: string): Promise<string> {
  const byteLen = Buffer.byteLength(content, "utf8");
  if (byteLen > MAX_CSS_BYTES) {
    throw new Error(
      `CSS content exceeds ${MAX_CSS_BYTES} bytes (got ${byteLen})`,
    );
  }
  const hash = hashCss(content);
  await setConfigValue(KEY_CSS_SOURCE, "inline");
  await setConfigValue(KEY_CSS_CONTENT, content);
  await setConfigValue(KEY_CSS_HASH, hash);
  await deleteConfigValue(KEY_CSS_URL);
  return hash;
}

export async function setCustomCssUrl(url: string): Promise<string> {
  validateRemoteUrl(url);
  const css = await fetchRemoteCssWithLimits(url);
  const hash = hashCss(css);
  await setConfigValue(KEY_CSS_SOURCE, "url");
  await setConfigValue(KEY_CSS_URL, url);
  await setConfigValue(KEY_CSS_CONTENT, css);
  await setConfigValue(KEY_CSS_HASH, hash);
  return hash;
}

export async function clearCustomCss(): Promise<void> {
  await deleteConfigValue(KEY_CSS_SOURCE);
  await deleteConfigValue(KEY_CSS_CONTENT);
  await deleteConfigValue(KEY_CSS_URL);
  await deleteConfigValue(KEY_CSS_HASH);
}

function validateRemoteUrl(url: string): void {
  if (url.length > MAX_URL_LENGTH) {
    throw new Error(`URL length exceeds ${MAX_URL_LENGTH} characters`);
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Invalid URL");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("URL must use http or https");
  }
}

async function fetchRemoteCssWithLimits(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { Accept: "text/css, text/plain, */*" },
    });
    if (!res.ok) {
      throw new Error(`Remote fetch failed: HTTP ${res.status}`);
    }
    const declared = Number(res.headers.get("content-length") ?? "0");
    if (declared > MAX_CSS_BYTES) {
      throw new Error(
        `Remote content too large: ${declared} bytes > ${MAX_CSS_BYTES}`,
      );
    }
    const body = res.body;
    if (!body) {
      const text = await res.text();
      const len = Buffer.byteLength(text, "utf8");
      if (len > MAX_CSS_BYTES) {
        throw new Error(`Remote content too large: ${len} bytes`);
      }
      return text;
    }
    const reader = body.getReader();
    const chunks: Buffer[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > MAX_CSS_BYTES) {
        await reader.cancel().catch(() => {});
        throw new Error(`Remote content too large: >${MAX_CSS_BYTES} bytes`);
      }
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks).toString("utf8");
  } finally {
    clearTimeout(timer);
  }
}
