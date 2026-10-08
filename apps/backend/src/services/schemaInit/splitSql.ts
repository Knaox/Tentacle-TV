/**
 * Découpe un script SQL (MariaDB/MySQL) en instructions, comme le ferait le
 * client `mysql` : un `;` hors chaîne et hors commentaire termine l'instruction.
 *
 * Écrit pour `prisma/core-init.sql` (le schéma MariaDB d'avant SQLite) ; ne
 * sert plus qu'à LIRE une source MariaDB pendant sa migration, et partira
 * avec elle (docs/sqlite/DECISION.md § 3). Les commentaires disparaissent : un `;` dans un commentaire ne coupe rien, pas
 * plus qu'un `;` entre apostrophes, guillemets ou accents graves.
 */
type State = "code" | "single" | "double" | "backtick" | "line" | "block";

const QUOTES: Record<string, State> = { "'": "single", '"': "double", "`": "backtick" };
const CLOSERS: Partial<Record<State, string>> = { single: "'", double: '"', backtick: "`" };

/** `--` n'ouvre un commentaire que suivi d'un blanc (règle MySQL) ou en fin de texte. */
function opensDashComment(sql: string, i: number): boolean {
  if (sql[i] !== "-" || sql[i + 1] !== "-") return false;
  const next = sql[i + 2];
  return next === undefined || next === " " || next === "\t" || next === "\n" || next === "\r";
}

export function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = "";
  let state: State = "code";

  const flush = () => {
    const text = current.trim();
    if (text) statements.push(text);
    current = "";
  };

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    switch (state) {
      case "code":
        if (opensDashComment(sql, i) || ch === "#") {
          state = "line";
        } else if (ch === "/" && sql[i + 1] === "*") {
          state = "block";
          i++;
        } else if (ch === ";") {
          flush();
        } else {
          if (QUOTES[ch]) state = QUOTES[ch];
          current += ch;
        }
        break;
      case "line":
        // Le saut de ligne reste : il sépare ce qui précède de ce qui suit.
        if (ch === "\n") {
          state = "code";
          current += ch;
        }
        break;
      case "block":
        if (ch === "*" && sql[i + 1] === "/") {
          state = "code";
          current += " ";
          i++;
        }
        break;
      default: {
        current += ch;
        // Antislash : le caractère suivant est pris tel quel (pas dans les accents graves).
        if (ch === "\\" && state !== "backtick" && i + 1 < sql.length) {
          current += sql[++i];
        } else if (ch === CLOSERS[state]) {
          // Quote doublée ('' ou ``) : toujours dans la chaîne.
          if (sql[i + 1] === ch) current += sql[++i];
          else state = "code";
        }
      }
    }
  }
  flush();
  return statements;
}
