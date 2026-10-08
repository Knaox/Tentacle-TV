// La Famille après la migration d'une base v1 : les mêmes questions que le banc Famille
// (apps/backend/test/famille-migration/check.sql, en SQL MariaDB), posées à la tentacle.db
// migrée, et la réponse comparée à SON attendu.txt — ligne à ligne.
//
//   node familyCheck.mjs <tentacle.db> <attendu.txt>   → « conforme », ou les lignes qui diffèrent
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

const [path, expectedFile] = process.argv.slice(2);
if (!path || !expectedFile) throw new Error("usage : node familyCheck.mjs <tentacle.db> <attendu.txt>");
const db = new DatabaseSync(path, { readOnly: true });
const QUERIES = [
  `SELECT 'familles', group_concat(id, ',' ORDER BY id) FROM families`,
  `SELECT 'famille ' || familyId, group_concat(userId || ':' || kind || CASE WHEN createdBy IS NULL THEN '' ELSE '<' || createdBy END
     || CASE WHEN canCreateGuests = 0 THEN '' ELSE '+droit' END, ',' ORDER BY kind = 'guest', kind <> 'owner', createdAt)
   FROM family_members GROUP BY familyId ORDER BY familyId`,
  `SELECT 'doublons', COUNT(*) FROM (SELECT userId FROM family_members GROUP BY userId HAVING COUNT(*) > 1)`,
  `SELECT 'familles sans ligne owner', COUNT(*) FROM families f WHERE NOT EXISTS
     (SELECT 1 FROM family_members m WHERE m.familyId = f.id AND m.userId = f.ownerUserId AND m.kind = 'owner')`,
  `SELECT 'nom du proprietaire F1', LENGTH(displayName) FROM family_members WHERE id = 'owner-F1'`,
  `SELECT 'couleur du proprietaire F1', color FROM family_members WHERE id = 'owner-F1'`,
  `SELECT 'invitations', group_concat(id || ':' || status, ',' ORDER BY id) FROM family_invitations`,
  `SELECT 'cloches', group_concat(jellyfinUserId || ':' || type || ':' || refId, ',' ORDER BY id) FROM notifications`,
  `SELECT 'index unique userId', COUNT(*) FROM pragma_index_list('family_members') WHERE name = 'family_members_userId_key' AND "unique" = 1`,
];
const lines = [];
for (const sql of QUERIES) {
  for (const row of db.prepare(sql).all()) lines.push(Object.values(row).map((v) => (v === null ? "NULL" : String(v))).join("\t"));
}
db.close();
const expected = readFileSync(expectedFile, "utf8").trimEnd().split("\n");
const diff = expected.filter((line, i) => line !== lines[i]).length + Math.abs(expected.length - lines.length);
console.log(diff === 0 ? `conforme (${expected.length} lignes)` : `ÉCART sur ${diff} ligne(s) :\n- attendu :\n${expected.join("\n")}\n- obtenu :\n${lines.join("\n")}`);
process.exitCode = diff ? 1 : 0;
