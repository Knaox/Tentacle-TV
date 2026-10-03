import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * tv-core ne dépend ni de React Native ni du DOM — la condition pour que la
 * navigation qui y vit serve TOUTES les plateformes : l'Apple TV et Android
 * TV (React Native), la LG (le DOM d'un navigateur). Une seule importation de
 * `react-native` ici, et le paquet ne se charge plus sur la LG ; un seul
 * `window.`, et il ne se charge plus sur un téléviseur React Native.
 *
 * React est permis (des crochets fins : `useSyncExternalStore`) : il tourne
 * partout. Le DOM est aussi refusé par le compilateur (`lib` sans « DOM » dans
 * tsconfig.json) ; ce test le vérifie, et vérifie ce que tsc ne voit pas — un
 * paquet natif importé, même par `@tentacle-tv/shared`.
 */

const PACKAGE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SHARED = resolve(PACKAGE, "../shared");

/** Les paquets interdits : la famille React Native, le DOM de React, la navigation et Expo. */
const FORBIDDEN = /^(react-native(-.+)?|@react-native(-[a-z]+)?\/.+|react-dom(\/.*)?|@react-navigation\/.+|expo(-.+)?|@expo\/.+|nativewind)$/;

/** Les globales du DOM, en ACCÈS (pas un mot dans un commentaire). */
const DOM_GLOBALS = /\b(document|window|navigator|localStorage|sessionStorage)\s*\??\.|\b(HTML\w*Element|KeyboardEvent|MouseEvent|FocusEvent|PointerEvent|requestAnimationFrame)\b/;

const SPECIFIERS = /\bfrom\s+["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']\s*\)|\brequire\(\s*["']([^"']+)["']\s*\)|^\s*import\s+["']([^"']+)["']/gm;

/**
 * La règle de rangement (docs/TV-NAVIGATION.md) : une règle lit des
 * `RemoteIntent`, jamais un `eventType` ; des `RemoteTraits`, jamais
 * `Platform.OS`. Seules les tables de traduction lisent l'événement natif.
 */
const NATIVE_READS = /\beventType\b|\bPlatform\s*\.\s*(OS|isTV|isTVOS|select)\b/;
const TRANSLATION_TABLES = "src/remote/bindings/";

/** Ni React ni minuteur caché (horloge injectable) — sauf ce qui l'était déjà avant le lot de la navigation. */
const REACT_IMPORT = /\bfrom\s+["']react["']/;
const REACT_BEFORE_LOT = ["src/nav/railPinning.ts", "src/player/playerState.ts"];
const HIDDEN_TIMER = /(^|[^.\w])(setTimeout|setInterval|requestAnimationFrame)\s*\(/;
const TIMERS_BEFORE_LOT = ["src/input/keyLock.ts", "src/input/longPress.ts", "src/player/holdMotor.ts", "src/player/playerState.ts", "src/player/scrubMachine.ts"];

function sourcesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourcesUnder(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

function withoutComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

function specifiersOf(file: string): string[] {
  const code = withoutComments(readFileSync(file, "utf8"));
  return [...code.matchAll(SPECIFIERS)].map((m) => m[1] ?? m[2] ?? m[3] ?? m[4]);
}

/** Un import relatif, résolu comme le fait le compilateur (`.ts`, `.tsx`, `index`). */
function resolveRelative(from: string, specifier: string): string | null {
  const base = resolve(dirname(from), specifier);
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

/** Les sources de tv-core et tout ce qu'elles chargent dans le dépôt (shared compris), avec leurs imports externes. */
function closure(): { files: string[]; external: Map<string, string[]> } {
  const seen = new Set<string>();
  const external = new Map<string, string[]>();
  const queue = sourcesUnder(join(PACKAGE, "src"));
  while (queue.length > 0) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const specifier of specifiersOf(file)) {
      if (specifier.startsWith(".")) {
        const target = resolveRelative(file, specifier);
        if (target) queue.push(target);
      } else if (specifier === "@tentacle-tv/shared") {
        queue.push(join(SHARED, "src/index.ts"));
      } else {
        external.set(specifier, [...(external.get(specifier) ?? []), file]);
      }
    }
  }
  return { files: [...seen], external };
}

describe("tv-core reste pur : ni React Native, ni DOM", () => {
  const { files, external } = closure();

  it("parcourt bien ses sources et celles de shared", () => {
    expect(files.some((f) => f.startsWith(join(PACKAGE, "src")))).toBe(true);
    expect(files.some((f) => f.startsWith(join(SHARED, "src")))).toBe(true);
  });

  it("n'importe aucun paquet de React Native, du DOM de React, de navigation ni d'Expo — même par shared", () => {
    const offenders = [...external].filter(([specifier]) => FORBIDDEN.test(specifier));
    expect(offenders.map(([specifier, by]) => `${specifier} ← ${by.map((f) => f.replace(`${PACKAGE}/`, "")).join(", ")}`)).toEqual([]);
  });

  it("n'emploie aucune globale du DOM dans ses sources", () => {
    const offenders = sourcesUnder(join(PACKAGE, "src"))
      .filter((file) => !file.endsWith("purity.test.ts"))
      .flatMap((file) =>
        withoutComments(readFileSync(file, "utf8"))
          .split("\n")
          .flatMap((line, i) => (DOM_GLOBALS.test(line) ? [`${file.replace(`${PACKAGE}/`, "")}:${i + 1}`] : [])),
      );
    expect(offenders).toEqual([]);
  });

  it("ne déclare aucune dépendance native ni DOM", () => {
    const manifest = JSON.parse(readFileSync(join(PACKAGE, "package.json"), "utf8")) as Record<string, Record<string, string> | undefined>;
    const declared = ["dependencies", "peerDependencies", "devDependencies"].flatMap((field) => Object.keys(manifest[field] ?? {}));
    expect(declared.filter((name) => FORBIDDEN.test(name))).toEqual([]);
  });

  /** Les lignes d'un module (hors tests, hors commentaires) qui répondent à `pattern`. */
  const linesMatching = (pattern: RegExp, skip: (relative: string) => boolean): string[] =>
    sourcesUnder(join(PACKAGE, "src"))
      .map((file) => ({ file, relative: file.replace(`${PACKAGE}/`, "") }))
      .filter(({ relative }) => !relative.endsWith(".test.ts") && !skip(relative))
      .flatMap(({ file, relative }) =>
        withoutComments(readFileSync(file, "utf8"))
          .split("\n")
          .flatMap((line, i) => (pattern.test(line) ? [`${relative}:${i + 1}`] : [])),
      );

  it("ses règles ne lisent ni eventType ni Platform.OS — seules les tables de traduction lisent le natif", () => {
    expect(linesMatching(NATIVE_READS, (relative) => relative.startsWith(TRANSLATION_TABLES))).toEqual([]);
  });

  it("aucun module nouveau ne s'appuie sur React", () => {
    expect(linesMatching(REACT_IMPORT, (relative) => REACT_BEFORE_LOT.includes(relative))).toEqual([]);
  });

  it("aucun module nouveau n'arme de minuteur caché : l'horloge s'injecte", () => {
    expect(linesMatching(HIDDEN_TIMER, (relative) => TIMERS_BEFORE_LOT.includes(relative))).toEqual([]);
  });

  it("compile sans la bibliothèque du DOM (tsconfig)", () => {
    const tsconfig = JSON.parse(readFileSync(join(PACKAGE, "tsconfig.json"), "utf8")) as { compilerOptions?: { lib?: string[] } };
    const lib = tsconfig.compilerOptions?.lib ?? [];
    expect(lib.length).toBeGreaterThan(0); // sans `lib`, tsconfig.base.json rendrait le DOM
    expect(lib.filter((entry) => /^dom/i.test(entry))).toEqual([]);
  });
});
