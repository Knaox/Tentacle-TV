// Lecture EN FLUX d'un export SQL MariaDB (phpMyAdmin ou mariadb-dump) : jamais le
// fichier entier en mémoire (800 Mo). Découpe en instructions au `;` de premier niveau,
// puis découpe les INSERT en lignes et en valeurs, en gardant le TEXTE BRUT de chaque
// valeur : une valeur qu'on ne touche pas ressort octet pour octet.
//
// Ce module ne lit ni n'écrit aucune valeur ailleurs que dans le flux qu'on lui donne :
// aucun journal, aucune trace — les données d'un dump de production n'en sortent pas.
import { createReadStream } from "node:fs";

/** Découpe un flux texte en instructions SQL complètes (le `;` final compris). */
export async function* statements(path) {
  const stream = createReadStream(path, { encoding: "utf8", highWaterMark: 1 << 20 });
  let buf = "";
  let start = 0;
  // État du lexeur, conservé d'un morceau à l'autre.
  let mode = "code"; // code | squote | dquote | btick | lineComment | blockComment
  let i = 0;
  for await (const chunk of stream) {
    buf = buf.slice(start) + chunk;
    i -= start;
    start = 0;
    for (; i < buf.length; i++) {
      const c = buf[i];
      if (mode === "squote" || mode === "dquote") {
        if (c === "\\") {
          if (i + 1 >= buf.length) break; // l'échappement attend le morceau suivant
          i++;
          continue;
        }
        if (c === (mode === "squote" ? "'" : '"')) mode = "code";
        continue;
      }
      if (mode === "btick") {
        if (c === "`") mode = "code";
        continue;
      }
      if (mode === "lineComment") {
        if (c === "\n") mode = "code";
        continue;
      }
      if (mode === "blockComment") {
        if (c === "*" && buf[i + 1] === "/") {
          mode = "code";
          i++;
        }
        continue;
      }
      if (c === "'") mode = "squote";
      else if (c === '"') mode = "dquote";
      else if (c === "`") mode = "btick";
      else if (c === "-" && buf[i + 1] === "-" && /\s/.test(buf[i + 2] ?? " ")) mode = "lineComment";
      else if (c === "#") mode = "lineComment";
      else if (c === "/" && buf[i + 1] === "*") mode = "blockComment";
      else if (c === ";") {
        yield buf.slice(start, i + 1);
        start = i + 1;
      }
    }
  }
  const rest = buf.slice(start);
  if (rest.trim()) yield rest;
}

// Les commentaires de phpMyAdmin (« -- Déchargement des données… ») précèdent l'INSERT.
const INSERT_HEAD =
  /^((?:\s+|--[^\n]*\n|\/\*[\s\S]*?\*\/)*)INSERT\s+(?:IGNORE\s+)?INTO\s+`([^`]+)`\s*(?:\(([^)]*)\))?\s*VALUES\s*/i;

/** Analyse un INSERT : table, colonnes, puis lignes de valeurs BRUTES. `null` sinon. */
export function parseInsert(stmt) {
  const m = INSERT_HEAD.exec(stmt);
  if (!m) return null;
  const columns = m[3] ? [...m[3].matchAll(/`([^`]+)`/g)].map((x) => x[1]) : null;
  // Le préfixe (commentaires et blancs) ressort tel quel.
  return { prefix: m[1], table: m[2], columns, rows: parseTuples(stmt, m[0].length) };
}

/** Lit `(v, v, …), (…);` à partir de `pos` ; chaque valeur garde son texte source. */
function parseTuples(s, pos) {
  const rows = [];
  let i = pos;
  while (i < s.length) {
    while (i < s.length && /[\s,]/.test(s[i])) i++;
    if (s[i] === ";" || i >= s.length) break;
    if (s[i] !== "(") throw new Error(`tuple attendu à ${i}`);
    i++;
    const row = [];
    for (;;) {
      while (/\s/.test(s[i])) i++;
      const from = i;
      if (s[i] === "'") {
        i++;
        while (s[i] !== "'") i += s[i] === "\\" ? 2 : 1;
        i++;
        // Deux apostrophes collées = une apostrophe dans la chaîne.
        while (s[i] === "'") {
          i++;
          while (s[i] !== "'") i += s[i] === "\\" ? 2 : 1;
          i++;
        }
      } else {
        while (s[i] !== "," && s[i] !== ")") i++;
      }
      row.push(s.slice(from, i).trim());
      while (/\s/.test(s[i])) i++;
      if (s[i] === ",") {
        i++;
        continue;
      }
      if (s[i] === ")") {
        i++;
        break;
      }
      throw new Error(`fin de valeur inattendue à ${i}`);
    }
    rows.push(row);
  }
  return rows;
}

const UNESCAPE = { 0: "\0", b: "\b", n: "\n", r: "\r", t: "\t", Z: "\x1a" };

/** Texte brut d'une valeur → valeur JS (`null`, chaîne, ou nombre gardé en texte). */
export function decodeValue(raw) {
  if (/^NULL$/i.test(raw)) return null;
  if (raw[0] !== "'") return { number: raw };
  let out = "";
  for (let i = 1; i < raw.length - 1; i++) {
    const c = raw[i];
    if (c === "\\") {
      const n = raw[++i];
      // \% et \_ gardent leur barre (règle de MariaDB hors LIKE).
      out += n in UNESCAPE ? UNESCAPE[n] : n === "%" || n === "_" ? `\\${n}` : n;
    } else if (c === "'" && raw[i + 1] === "'") {
      out += "'";
      i++;
    } else out += c;
  }
  return out;
}

/** Chaîne JS → littéral SQL MariaDB. */
export function encodeString(value) {
  return `'${value
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\0/g, "\\0")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\x1a/g, "\\Z")}'`;
}

/** Réécrit un INSERT analysé, lignes éventuellement transformées. */
export function formatInsert({ prefix, table, columns, rows }) {
  const cols = columns ? ` (${columns.map((c) => `\`${c}\``).join(", ")})` : "";
  const body = rows.map((r) => `(${r.join(", ")})`).join(",\n");
  return `${prefix}INSERT INTO \`${table}\`${cols} VALUES\n${body};`;
}
