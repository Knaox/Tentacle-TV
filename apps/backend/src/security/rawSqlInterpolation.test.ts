import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative, resolve } from "path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * Garde de non-régression contre l'injection SQL (audit du chantier SQLite).
 *
 * Tout appel `$queryRawUnsafe` / `$executeRawUnsafe` du backend, tout
 * `Prisma.raw(…)`, et tout gabarit passé à `node:sqlite` ou au pilote MariaDB
 * de la migration, est relu dans l'arbre syntaxique :
 * - une chaîne littérale passe toujours ;
 * - un gabarit `…${x}…` ne passe que si CHAQUE interpolation est une
 *   construction de marques `?` (`liste.map(() => "?").join(…)`), un
 *   identifiant cité (`quoteIdent`, `quoteId`, `assertIdentifier`), une
 *   constante en MAJUSCULES, ou figure dans la liste ci-dessous, justifiée ;
 * - un texte venu d'une variable (Prisma brut) ne passe que s'il y figure.
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
  // `tentacle db query` : SA raison d'être est d'exécuter le SQL tapé à la
  // console. Ce texte n'est compilé que sous `EXPLAIN` pour en refuser toute
  // écriture (refuseNonRead), sur une base ouverte en lecture seule.
  "cli/dbQueryCommand.ts": {
    source: "la requête de l'administrateur, compilée sous EXPLAIN pour refuser toute écriture",
  },
  // La migration MariaDB → SQLite (1.25) : noms lus dans information_schema,
  // donc NON fiables, toujours cités (`quoteIdent` / `quoteId`) avant d'entrer.
  "dbMigration/copy/tableCopy.ts": {
    "plan.verb": "type fermé : \"INSERT\" | \"INSERT OR IGNORE\"",
    'names.join(", ")': "colonnes cibles passées par quoteIdent juste au-dessus",
  },
  "dbMigration/legacySource/mariadbReader.ts": {
    select: "colonnes passées par quoteId ; le fuseau de CONVERT_TZ par conn.escape",
    order: "colonnes de clé passées par quoteId",
    clause: "afterKey : colonnes par quoteId, valeurs en marques ?",
  },
};

/** Une interpolation qui ne produit que des marques `?` (et des séparateurs). */
const PLACEHOLDER_BUILDER = /^[\w.]+\.map\(\s*\(\)\s*=>\s*["'`](?:\?|\(\?(?:,\s*\?)*\))["'`]\s*\)\.join\(\s*["'`][,\s]*["'`]\s*\)$/;

/**
 * Un identifiant CITÉ par une aide qui double le guillemet (`quoteIdent`,
 * `quoteId`) ou refuse tout ce qui n'est pas un nom simple (`assertIdentifier`),
 * seul ou sur une liste jointe ; ou une constante du module (MAJUSCULES).
 */
const QUOTED_IDENTIFIER = /^(?:(?:quoteIdent|quoteId|assertIdentifier)\([\w.[\]]+\)|[\w.]+\.map\((?:quoteIdent|quoteId|assertIdentifier)\)\.join\(\s*["'`][,\s]*["'`]\s*\)|[A-Z][A-Z0-9_]*)$/;

const RAW_METHODS = new Set(["$queryRawUnsafe", "$executeRawUnsafe"]);

/**
 * Les autres portes du SQL : `node:sqlite` (`prepare`, `exec`) et le pilote
 * MariaDB de la migration (`query`, `rows`, `execute`). Leurs noms sont communs
 * (`RegExp.exec`…) : seul un GABARIT y est relu, jamais une variable.
 */
const TEMPLATE_SINKS = new Set(["prepare", "exec", "query", "execute", "rows"]);

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

type SinkKind = "raw" | "template" | null;

function sinkKind(node: ts.Node): SinkKind {
  if (!ts.isCallExpression(node)) return null;
  const callee = node.expression;
  if (!ts.isPropertyAccessExpression(callee)) return null;
  const name = callee.name.text;
  if (RAW_METHODS.has(name)) return "raw";
  if (name === "raw" && ts.isIdentifier(callee.expression) && callee.expression.text === "Prisma") return "raw";
  return TEMPLATE_SINKS.has(name) ? "template" : null;
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
    const kind = sinkKind(node);
    if (kind && ts.isCallExpression(node) && node.arguments.length > 0) {
      const first = node.arguments[0];
      const expressions = kind === "raw" || ts.isTemplateExpression(first) ? interpolatedExpressions(first, sf) : [];
      for (const expression of expressions) {
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
  return findings.filter((f) =>
    !PLACEHOLDER_BUILDER.test(f.expression)
    && !QUOTED_IDENTIFIER.test(f.expression)
    && !(f.expression in (REVIEWED[f.file] ?? {})));
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

  it("node:sqlite et le pilote MariaDB : identifiants cités admis, valeurs refusées", () => {
    const code = [
      "db.prepare(`INSERT INTO ${quoteIdent(t)} (${cols.map(quoteIdent).join(\", \")}) VALUES (?)`);",
      "db.exec(`PRAGMA journal_mode = WAL`);",
      "db.exec(`DELETE FROM ${TABLE} WHERE k = '${key}'`);",
      "conn.query(`SELECT * FROM ${quoteId(t)} WHERE id = ${id}`);",
      "pattern.exec(text);",
      "db.exec(migration.sql);",
    ].join("\n");
    expect(unreviewed(scanSource("c.ts", code)).map((f) => f.expression)).toEqual(["key", "id"]);
  });
});
