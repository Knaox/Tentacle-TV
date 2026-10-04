import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Garde-fou : aucun « tirer pour rafraîchir » de l'app ne lit son anneau sur
 * l'état d'une requête. Sur iOS, un `refreshing` posé par programme décale le
 * contenu de la hauteur de l'anneau ; une relève automatique poussait la
 * page, et le décalage restait si elle finissait écran caché (le héros de
 * l'accueil plus bas que sa place). L'anneau suit le geste : `usePullToRefresh`.
 */
const ROOT = join(__dirname, "..", "..");
const QUERY_STATE = /\b(isFetching|isRefetching|isLoading|isPending|fetchStatus)\b/;

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "node_modules" ? [] : sources(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

/** L'expression de chaque `refreshing={…}` du fichier, accolades équilibrées. */
function refreshingExpressions(code: string): string[] {
  const found: string[] = [];
  let at = code.indexOf("refreshing={");
  while (at >= 0) {
    let depth = 0;
    let end = at + "refreshing=".length;
    for (; end < code.length; end++) {
      if (code[end] === "{") depth++;
      else if (code[end] === "}" && --depth === 0) break;
    }
    found.push(code.slice(at + "refreshing={".length, end));
    at = code.indexOf("refreshing={", end);
  }
  return found;
}

describe("tirer pour rafraîchir", () => {
  it("l'anneau ne lit jamais l'état d'une requête", () => {
    const offenders = [join(ROOT, "src"), join(ROOT, "app")]
      .flatMap(sources)
      .flatMap((file) => refreshingExpressions(readFileSync(file, "utf8"))
        .filter((expr) => QUERY_STATE.test(expr))
        .map((expr) => `${relative(ROOT, file)} : refreshing={${expr}}`));
    expect(offenders).toEqual([]);
  });
});
