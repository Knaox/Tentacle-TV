// Passe 1 de la neutralisation : relève, SANS rien écrire ni afficher, ce qu'il faudra
// remplacer — identifiants de comptes (ordre d'apparition), noms par compte, secrets,
// hôtes et adresses de la production. Tout reste en mémoire.
import { statements, parseInsert, decodeValue } from "./dumpStream.mjs";
import { isUserIdColumn, ID_PATTERN } from "./userIds.mjs";
import { undashed } from "./fakes.mjs";
import { NAME_COLUMNS, SECRET_COLUMNS, DEVICE_NAME_COLUMNS, CONFIG_REWRITE, CONFIG_REGENERATE } from "./neutralizeRules.mjs";

const IPV4 = /\b\d{1,3}(?:\.\d{1,3}){3}\b/g;

export async function collect(path) {
  const ids = []; // identifiants d'origine, minuscules sans tirets, ordre d'apparition
  const seen = new Set();
  const addId = (v) => {
    const id = undashed(v);
    if (!seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  };
  const namesById = new Map();
  const sensitive = new Set(); // littéraux qui ne doivent plus apparaître nulle part
  const hosts = new Set();
  const ips = new Set();
  const deviceNames = new Set();
  let adminId = null;
  let adminName = null;

  for await (const stmt of statements(path)) {
    const ins = parseInsert(stmt);
    if (!ins) continue;
    const { table, columns } = ins;
    const at = (name) => columns.indexOf(name);
    for (const raw of ins.rows) {
      const row = raw.map(decodeValue);
      row.forEach((v, i) => {
        if (typeof v === "string" && isUserIdColumn(table, columns[i]) && ID_PATTERN.test(v)) addId(v);
      });
      for (const [col, idCol] of Object.entries(NAME_COLUMNS[table] ?? {})) {
        const name = row[at(col)];
        const id = row[at(idCol)];
        if (typeof name !== "string" || typeof id !== "string" || name.trim().length < 2) continue;
        const key = undashed(id);
        if (!namesById.has(key)) namesById.set(key, new Set());
        namesById.get(key).add(name.trim());
      }
      for (const col of SECRET_COLUMNS[table] ?? []) {
        const v = row[at(col)];
        if (typeof v === "string" && v.length >= 8) sensitive.add(v);
      }
      for (const col of DEVICE_NAME_COLUMNS[table] ?? []) {
        const v = row[at(col)];
        if (typeof v === "string" && v.trim()) deviceNames.add(v);
      }
      if (table !== "server_config") continue;
      const [key, value] = [row[at("key")], row[at("value")]];
      if (key.startsWith("user_lang_")) addId(key.slice("user_lang_".length));
      if (key === "admin_jellyfin_id") {
        adminId = undashed(value);
        addId(value);
      }
      if (key === "admin_username") adminName = value;
      if (key in CONFIG_REWRITE || CONFIG_REGENERATE.includes(key)) {
        if (/^https?:\/\//i.test(value)) {
          const host = new URL(value).hostname;
          if (host && host !== "localhost") hosts.add(host.toLowerCase());
        } else if (value.length >= 8) sensitive.add(value);
      }
      for (const ip of value.match(IPV4) ?? []) ips.add(ip);
    }
  }
  // Un hôte de la production peut être une adresse IP : elle rejoint les adresses.
  for (const h of [...hosts]) if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) ips.add(h);
  if (adminId && adminName) {
    if (!namesById.has(adminId)) namesById.set(adminId, new Set());
    namesById.get(adminId).add(adminName);
  }
  return { ids, adminId, namesById, sensitive, hosts, ips, deviceNames };
}
