// Passe 2 de la neutralisation : réécrit chaque ligne. D'abord les colonnes connues
// (noms, secrets, appareils, texte libre, `server_config`), puis, sur TOUTE valeur texte,
// les remplacements globaux : identifiants de comptes, hôtes et adresses de la production,
// et — hors tables de cache — les noms des personnes.
import crypto from "node:crypto";
import { decodeValue, encodeString } from "./dumpStream.mjs";
import { dashed, undashed, escapeRe } from "./fakes.mjs";
import {
  NAME_COLUMNS,
  SECRET_COLUMNS,
  DEVICE_NAME_COLUMNS,
  FREE_TEXT_COLUMNS,
  CONFIG_REWRITE,
  CONFIG_REGENERATE,
  CACHE_TABLES,
} from "./neutralizeRules.mjs";

const ID_ANYWHERE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9a-f]{32}/gi;

export function createRewriter({ found, bench, faker, pinHash }) {
  // Identifiants : l'administrateur de la production → celui du banc ; les autres, dans
  // l'ordre d'apparition, → bench01, bench02…
  const idMap = new Map();
  const pool = [...bench.users];
  for (const id of found.ids) {
    if (id === found.adminId) idMap.set(id, bench.admin);
    else {
      const next = pool.shift();
      if (!next) throw new Error(`le banc n'a pas assez de comptes (${found.ids.length} identifiants)`);
      idMap.set(id, next);
    }
  }
  const benchName = (id) => (typeof id === "string" ? idMap.get(undashed(id))?.name : undefined) ?? "bench-inconnu";

  const nameMap = new Map();
  for (const [id, names] of found.namesById) {
    for (const n of names) if (!nameMap.has(n.toLowerCase())) nameMap.set(n.toLowerCase(), benchName(id));
  }
  const names = [...nameMap.keys()].filter((n) => n.length >= 3).sort((a, b) => b.length - a.length);
  const nameRe = names.length
    ? new RegExp(`(?<![\\p{L}\\p{N}])(?:${names.map(escapeRe).join("|")})(?![\\p{L}\\p{N}])`, "giu")
    : null;

  const literals = [...found.hosts, ...found.ips].sort((a, b) => b.length - a.length);
  const literalRe = literals.length ? new RegExp(literals.map(escapeRe).join("|"), "gi") : null;
  const ipReplacement = new Map([...found.ips].map((ip, i) => [ip, `192.0.2.${10 + i}`]));
  const replaceLiteral = (m) => ipReplacement.get(m) ?? "prod-host.sqlbench.test";

  const devices = new Map([...found.deviceNames].map((d, i) => [d, `Appareil ${i + 1}`]));
  const counters = new Map();
  const numbered = (prefix) => {
    const n = (counters.get(prefix) ?? 0) + 1;
    counters.set(prefix, n);
    return `${prefix} ${n}`;
  };

  function globalText(table, s) {
    let out = s.replace(ID_ANYWHERE, (m) => {
      const target = idMap.get(undashed(m));
      if (!target) return m;
      const id = m.includes("-") ? dashed(target.id) : target.id;
      return m === m.toUpperCase() && /[A-F]/.test(m) ? id.toUpperCase() : id;
    });
    if (literalRe) out = out.replace(literalRe, replaceLiteral);
    if (nameRe && !CACHE_TABLES.has(table)) out = out.replace(nameRe, (m) => nameMap.get(m.toLowerCase()) ?? m);
    return out;
  }

  function configValue(key, value) {
    if (key in CONFIG_REWRITE) return CONFIG_REWRITE[key](bench);
    if (key === "jwt_secret") return crypto.randomBytes(64).toString("hex");
    if (key === "device_id_secret") return crypto.randomBytes(value.length / 2 || 32).toString("hex");
    if (CONFIG_REGENERATE.includes(key)) return faker.sameShape(value);
    return value;
  }

  /** Réécrit une ligne brute ; ne réencode que les valeurs qui changent. */
  function row(table, columns, raw) {
    const at = (c) => columns.indexOf(c);
    const out = [...raw];
    const set = (i, v) => {
      out[i] = v === null ? "NULL" : encodeString(v);
    };
    const value = (i) => decodeValue(raw[i]);
    const touched = new Set();
    const put = (i, v) => {
      set(i, v);
      touched.add(i);
    };

    for (const [col, idCol] of Object.entries(NAME_COLUMNS[table] ?? {})) {
      if (typeof value(at(col)) === "string") put(at(col), benchName(value(at(idCol))));
    }
    for (const col of SECRET_COLUMNS[table] ?? []) {
      const v = value(at(col));
      if (typeof v === "string") put(at(col), faker.sameShape(v));
    }
    for (const col of DEVICE_NAME_COLUMNS[table] ?? []) {
      const v = value(at(col));
      if (typeof v === "string" && v.trim()) put(at(col), devices.get(v));
    }
    for (const [col, prefix] of Object.entries(FREE_TEXT_COLUMNS[table] ?? {})) {
      if (typeof value(at(col)) === "string") put(at(col), numbered(prefix));
    }
    if (table === "profile_pins") put(at("pinHash"), pinHash);
    if (table === "server_config") {
      const key = value(at("key"));
      const v = configValue(key, value(at("value")));
      if (v !== value(at("value"))) put(at("value"), v);
    }

    raw.forEach((r, i) => {
      if (r[0] !== "'") return;
      const current = touched.has(i) ? decodeValue(out[i]) : decodeValue(r);
      const next = globalText(table, current);
      if (next !== current || touched.has(i)) set(i, next);
    });
    return out;
  }

  return { row, idMap, nameCount: names.length };
}
