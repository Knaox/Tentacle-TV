import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative, resolve } from "path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * Garde de non-régression contre l'injection SQL (audit du chantier SQLite).
 *
 * Tout appel `$queryRawUnsafe` / `$executeRawUnsafe` du backend, et tout
 * `Prisma.raw(…)`, est relu dans l'arbre syntaxique :
 * - une chaîne littérale passe toujours ;
 * - un gabarit `…${x}…` ne passe que si CHAQUE interpolation est une
 *   construction de marques `?` (`liste.map(() => "?").join(…)`) ou figure
 *   dans la liste ci-dessous, avec sa justification ;
 * - un texte venu d'une variable ne passe que s'il figure dans la liste.
 *
 * Une valeur ne s'interpole JAMAIS : elle passe en paramètre lié. Un nouvel
 * appel qui interpole fait échouer ce test : on le relit, puis on l'ajoute ici
 * avec la raison pour laquelle aucune entrée extérieure ne peut y entrer.
 */

const SRC = resolve(__dirname, "..");

/** fichier (relatif à src/) → textes d'interpolation (ou d'argument) admis. */
const REVIEWED: Record<string, Record<string, string>> = {
  "services/libraryPresence.ts": {
    cases: "« WHEN ? THEN ? » répété : des marques, aucune valeur",
    marks: "« ?,?,… » : des marques, aucune valeur",
  },
  "services/schemaInit/coreSchema.ts": {
    sql: "instructions de core-init.sql / schema-full.sql, fichiers de l'image",
    name: "nom de variable de session tiré d'une expression \\w+ du script de l'image",
  },
  // L'interface de stockage des extensions (1.25) : le texte SQL est celui de
  // l'extension, qui est du code de confiance (installée depuis un registre
  // vérifié par SHA-256). Les VALEURS y passent toujours en paramètres.
  "services/pluginStorage/prismaExecutor.ts": {
    sql: "texte SQL de l'extension, valeurs liées à part",
  },
};

/** Une interpolation qui ne produit que des marques `?` (et des séparateurs). */
const PLACEHOLDER_BUILDER = /^[\w.]+\.map\(\s*\(\)\s*=>\s*["'`](?:\?|\(\?(?:,\s*\?)*\))["'`]\s*\)\.join\(\s*["'`][,\s]*["'`]\s*\)$/;

const RAW_METHODS = new Set(["$queryRawUnsafe", "$executeRawUnsafe"]);

interface RawSqlFinding {
  file: string;
  line: number;
  /** Le texte de l'interpolation (ou de l'argument non littéral) en cause. */
  expression: string;
}

function listSources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "generated" || name === "node_modules" ? [] : listSources(path);
    return /\.ts$/.test(name) && !/\.test\.ts$/.test(name) ? [path] : [];
  });
}

function isRawCall(node: ts.Node): node is ts.CallExpression {
  if (!ts.isCallExpression(node)) return false;
  const callee = node.expression;
  if (ts.isPropertyAccessExpression(callee)) {
    if (RAW_METHODS.has(callee.name.text)) return true;
    return callee.name.text === "raw" && ts.isIdentifier(callee.expression) && callee.expression.text === "Prisma";
  }
  return false;
}

/** Les expressions qu'un appel brut fait entrer dans le texte SQL. */
function interpolatedExpressions(arg: ts.Expression, sf: ts.SourceFile): string[] {
  if (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)) return [];
  if (ts.isTemplateExpression(arg)) return arg.templateSpans.map((span) => span.expression.getText(sf));
  if (ts.isParenthesizedExpression(arg)) return interpolatedExpressions(arg.expression, sf);
  return [arg.getText(sf)];
}

function scanSource(file: string, text: string): RawSqlFinding[] {
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.ES2022, true);
  const findings: RawSqlFinding[] = [];
  const visit = (node: ts.Node) => {
    if (isRawCall(node) && node.arguments.length > 0) {
      for (const expression of interpolatedExpressions(node.arguments[0], sf)) {
        const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
        findings.push({ file, line, expression: expression.replace(/\s+/g, " ") });
      }
    }
    // Le gabarit étiqueté `$queryRaw\`…\`` lie ses valeurs, sauf `Prisma.raw` (relevé ci-dessus).
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return findings;
}

function unreviewed(findings: RawSqlFinding[]): RawSqlFinding[] {
  return findings.filter((f) => !PLACEHOLDER_BUILDER.test(f.expression) && !(f.expression in (REVIEWED[f.file] ?? {})));
}

describe("SQL brut du backend — aucune valeur interpolée", () => {
  it("chaque interpolation dans un appel brut est une marque `?` ou a été relue", () => {
    const findings = listSources(SRC).flatMap((path) => {
      const file = relative(SRC, path).split("\\").join("/");
      return scanSource(file, readFileSync(path, "utf8"));
    });
    expect(unreviewed(findings).map((f) => `${f.file}:${f.line} → ${f.expression}`)).toEqual([]);
  });

  it("repère une valeur interpolée, même dans un gabarit sur plusieurs lignes", () => {
    const code = [
      "async function f(prisma: any, user: string, ids: string[]) {",
      "  await prisma.$queryRawUnsafe(`SELECT 1`);",
      "  await prisma.$queryRawUnsafe(`SELECT * FROM t WHERE id IN (${ids.map(() => \"?\").join(\",\")})`, ...ids);",
      "  await prisma.$executeRawUnsafe(`DELETE FROM t",
      "    WHERE name = '${user}'`);",
      "  await prisma.$queryRawUnsafe(query);",
      "  await prisma.$queryRaw`SELECT ${Prisma.raw(user)}`;",
      "}",
    ].join("\n");
    const found = unreviewed(scanSource("demo.ts", code)).map((f) => f.expression);
    expect(found).toEqual(["user", "query", "user"]);
  });

  it("une liste de tuples de marques passe, une jointure de valeurs non", () => {
    const ok = "x.$executeRawUnsafe(`INSERT INTO t VALUES ${rows.map(() => \"(?, ?)\").join(\", \")}`)";
    const bad = "x.$executeRawUnsafe(`INSERT INTO t VALUES ${rows.map((r) => `('${r}')`).join(\", \")}`)";
    expect(unreviewed(scanSource("a.ts", ok))).toEqual([]);
    expect(unreviewed(scanSource("b.ts", bad))).toHaveLength(1);
  });
});
