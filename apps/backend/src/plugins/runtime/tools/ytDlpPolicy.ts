import { isAbsolute, resolve, sep } from "path";
import { z } from "zod";

/**
 * La politique de yt-dlp pour une EXTENSION (`tools.exec`) : seules les options
 * de cette liste passent, avec des valeurs bornées ; les chemins sont FORCÉS
 * sous le dossier de données de l'extension ; ce qui lance un programme, lit
 * une configuration ou charge du code (`--exec`, `--config-location`,
 * `--plugin-dirs`, `--external-downloader`, `--netrc-cmd`, `--update`…) n'y
 * est pas — donc refusé. Un argument qui n'est pas une option doit être une URL
 * http(s) ou une recherche (`<site>search<N>:<texte>`) : jamais `file://`.
 *
 * Tout appel reçoit en tête `--ignore-config`, `-P <données>`, `--cache-dir`
 * sous les données et `--no-exec` : quoi qu'en pense l'extension.
 */

type OptionKind =
  | { kind: "flag" }
  | { kind: "value"; schema: z.ZodType<string> }
  /** Un fichier ou dossier : relatif aux données, ou absolu SOUS elles. */
  | { kind: "path" }
  /** Un modèle de nom (`-o`) : relatif, sans remontée ni préfixe de type (`temp:`…). */
  | { kind: "template" };

const flag = { kind: "flag" } as const;
const text = (max: number, pattern = /^[^\n\r\0]*$/) => ({ kind: "value" as const, schema: z.string().max(max).regex(pattern) });
const number = (max: number) => text(12, new RegExp(`^\\d{1,${String(max).length}}(\\.\\d{1,3})?[KMG]?$`));

const OPTIONS: Record<string, OptionKind> = {
  "-J": flag, "--dump-single-json": flag, "-j": flag, "--dump-json": flag,
  "--flat-playlist": flag, "--no-playlist": flag, "--yes-playlist": flag,
  "--skip-download": flag, "--simulate": flag, "--no-simulate": flag,
  "-q": flag, "--quiet": flag, "--no-warnings": flag, "--no-progress": flag, "--newline": flag,
  "--no-part": flag, "--no-mtime": flag, "--no-overwrites": flag, "--force-overwrites": flag, "--continue": flag,
  "--ignore-no-formats-error": flag, "--ignore-errors": flag, "--abort-on-error": flag,
  "--no-check-formats": flag, "--prefer-free-formats": flag, "--no-write-comments": flag,
  "--write-info-json": flag, "--no-write-info-json": flag, "--write-thumbnail": flag,
  "-f": text(300), "--format": text(300),
  "-S": text(300), "--format-sort": text(300),
  "--extractor-args": text(500),
  "--match-filter": text(500), "--match-filters": text(500),
  "--playlist-items": text(100, /^[0-9:,-]+$/), "-I": text(100, /^[0-9:,-]+$/),
  "--max-downloads": number(1000), "--socket-timeout": number(600),
  "--retries": number(100), "--fragment-retries": number(100), "--extractor-retries": number(100),
  "--limit-rate": number(10_000), "-r": number(10_000), "--concurrent-fragments": number(16), "-N": number(16),
  "--http-chunk-size": number(10_000), "--max-filesize": number(100_000), "--min-filesize": number(100_000),
  "--print": text(500), "-O": text(500),
  "--user-agent": text(300), "--referer": text(500), "--add-headers": text(500), "--add-header": text(500),
  "--default-search": text(30, /^[a-z0-9]{1,30}$/),
  "--load-info-json": { kind: "path" }, "--batch-file": { kind: "path" }, "-a": { kind: "path" },
  "--cookies": { kind: "path" }, "--download-archive": { kind: "path" },
  "-o": { kind: "template" }, "--output": { kind: "template" },
};

/** Des options CONNUES et refusées : nommées dans le refus pour que l'extension sache pourquoi. */
export const DENIED_OPTIONS = [
  "--exec", "--exec-before-download", "--no-exec", "--config-location", "--config-locations", "--ignore-config",
  "--plugin-dirs", "--no-plugin-dirs", "-P", "--paths", "--cache-dir", "--no-cache-dir", "--rm-cache-dir",
  "--external-downloader", "--downloader", "--downloader-args", "--external-downloader-args",
  "--postprocessor-args", "--ppa", "--use-postprocessor", "--ffmpeg-location", "--js-runtimes", "--remote-components",
  "-U", "--update", "--update-to", "--netrc", "--netrc-location", "--netrc-cmd", "--alias", "--print-to-file",
  "--enable-file-urls", "--cookies-from-browser", "--proxy", "--no-check-certificates", "--load-pages",
  "-x", "--extract-audio", "--recode-video", "--remux-video", "--embed-metadata", "--embed-thumbnail", "--split-chapters",
];

const SEARCH = /^[a-z]{2,20}search(date)?(\d{1,3}|all)?:[^\n\r\0]{1,300}$/;
const URL_ARG = /^https?:\/\/[^\s\0]{1,2000}$/;

export type PolicyResult = { ok: true; args: string[] } | { ok: false; reason: string };

function underData(dataDir: string, value: string): string | null {
  if (value.includes("\0") || value.startsWith("~")) return null;
  const base = resolve(dataDir);
  const full = isAbsolute(value) ? resolve(value) : resolve(base, value);
  return full.startsWith(base + sep) ? full : null;
}

function safeTemplate(value: string): boolean {
  if (value.length > 300 || isAbsolute(value) || value.startsWith("~") || value.includes("\\")) return false;
  if (/^[a-z_]+:/i.test(value) || /[\0\n\r]/.test(value)) return false;
  return !value.split("/").some((part) => part === ".." || part === ".");
}

/** Le préfixe imposé à chaque appel d'une extension. */
export function forcedYtDlpArgs(dataDir: string): string[] {
  return ["--ignore-config", "--no-exec", "-P", resolve(dataDir), "--cache-dir", resolve(dataDir, ".yt-dlp-cache")];
}

export function validateYtDlpArgs(args: readonly string[], dataDir: string): PolicyResult {
  const options: string[] = [];
  const positionals: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg.startsWith("-")) {
      if (!URL_ARG.test(arg) && !SEARCH.test(arg)) return { ok: false, reason: "argument refusé (URL http(s) ou recherche seulement)" };
      positionals.push(arg);
      continue;
    }
    const eq = arg.startsWith("--") ? arg.indexOf("=") : -1;
    const name = eq > 0 ? arg.slice(0, eq) : arg;
    const inline = eq > 0 ? arg.slice(eq + 1) : undefined;
    if (DENIED_OPTIONS.includes(name)) return { ok: false, reason: `option refusée : ${name}` };
    const option = OPTIONS[name];
    if (!option) return { ok: false, reason: `option inconnue : ${name}` };
    if (option.kind === "flag") {
      if (inline !== undefined) return { ok: false, reason: `${name} ne prend pas de valeur` };
      options.push(name);
      continue;
    }
    const value = inline ?? args[++i];
    if (value === undefined) return { ok: false, reason: `${name} attend une valeur` };
    if (option.kind === "value") {
      if (!option.schema.safeParse(value).success) return { ok: false, reason: `valeur refusée pour ${name}` };
      options.push(name, value);
    } else if (option.kind === "path") {
      const path = underData(dataDir, value);
      if (!path) return { ok: false, reason: `${name} : chemin hors du dossier de données` };
      options.push(name, path);
    } else {
      if (!safeTemplate(value)) return { ok: false, reason: `${name} : modèle de nom refusé` };
      options.push(name, value);
    }
  }
  // Les URL et recherches après `--` : yt-dlp ne les lira jamais comme des options.
  return { ok: true, args: [...forcedYtDlpArgs(dataDir), ...options, ...(positionals.length > 0 ? ["--", ...positionals] : [])] };
}
