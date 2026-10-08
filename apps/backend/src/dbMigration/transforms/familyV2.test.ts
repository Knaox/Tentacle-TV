import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { migrateFamilyToV2, type Row } from "./familyV2";
import { mariadbDateTimeToMs } from "../legacySource/sqliteTypes";

// Les fixtures du banc Famille (test/famille-migration) : chaque cas que la v2
// interdit. Le résultat attendu est le MÊME fichier que celui du banc MariaDB
// (`attendu.txt`), relu ligne à ligne : la copie et core-init.sql disent pareil.
const BANC = resolve(__dirname, "../../../test/famille-migration");
const NOW = Date.UTC(2026, 9, 8, 12, 0, 0);

/** Lit les INSERT des fixtures (chaînes, NULL, REPEAT) en lignes. */
function parseFixtures(sql: string): Record<string, Row[]> {
  const tables: Record<string, Row[]> = {};
  for (const m of sql.matchAll(/INSERT INTO (\w+) \(([^)]*)\) VALUES([\s\S]*?);\n/g)) {
    const cols = m[2].split(",").map((c) => c.trim());
    const tuples = m[3].match(/\((?:'(?:[^']|'')*'|[^()']|\([^()]*\))*\)/g) ?? [];
    tables[m[1]] = tuples.map((t) => {
      const values = t.slice(1, -1).match(/'(?:[^']|'')*'|REPEAT\('[^']*', \d+\)|NULL|[^,\s]+/g) ?? [];
      return Object.fromEntries(cols.map((c, i) => [c, decode(values[i])]));
    });
  }
  return tables;
}

function decode(v: string): unknown {
  if (v === "NULL") return null;
  const rep = /^REPEAT\('([^']*)', (\d+)\)$/.exec(v);
  if (rep) return rep[1].repeat(Number(rep[2]));
  const s = v.slice(1, -1).replace(/''/g, "'");
  return /^\d{4}-\d{2}-\d{2} /.test(s) ? mariadbDateTimeToMs(s) : s;
}

/** Une base v1 : les colonnes venues avec la v2 prennent leur défaut, comme le fait la copie. */
function v1Tables() {
  const t = parseFixtures(readFileSync(resolve(BANC, "fixtures-v1.sql"), "utf8"));
  return {
    families: t.families,
    members: t.family_members.map((m): Row => ({ createdBy: null, canCreateGuests: 0, canRequestTitles: 0, ...m })),
    invitations: t.family_invitations.map((i): Row => ({ respondedAt: null, snoozedUntil: null, ...i })),
    notifications: t.notifications.map((n, i): Row => ({ id: `n${i + 1}`, ...n })),
  };
}

/** Les mêmes lectures que `check.sql`, sur le résultat. */
function check(r: ReturnType<typeof migrateFamilyToV2>, notifications: Row[]): string[] {
  const rank = (m: Row) => (m.kind === "guest" ? 2 : m.kind === "owner" ? 0 : 1);
  const lines = [`familles\t${r.families.map((f) => f.id).sort().join(",")}`];
  const ids = [...new Set(r.members.map((m) => String(m.familyId)))].sort();
  for (const id of ids) {
    const rows = r.members
      .filter((m) => m.familyId === id)
      .sort((a, b) => rank(a) - rank(b) || Number(a.createdAt) - Number(b.createdAt))
      .map((m) => `${m.userId}:${m.kind}${m.createdBy ? `<${m.createdBy}` : ""}${m.canCreateGuests ? "+droit" : ""}`);
    lines.push(`famille ${id}\t${rows.join(",")}`);
  }
  const users = r.members.map((m) => m.userId);
  lines.push(`doublons\t${users.length - new Set(users).size}`);
  const noOwner = r.families.filter((f) => !r.members.some((m) => m.familyId === f.id && m.userId === f.ownerUserId && m.kind === "owner"));
  lines.push(`familles sans ligne owner\t${noOwner.length}`);
  const ownerF1 = r.members.find((m) => m.id === "owner-F1")!;
  lines.push(`nom du proprietaire F1\t${String(ownerF1.displayName).length}`, `couleur du proprietaire F1\t${ownerF1.color}`);
  const inv = [...r.invitations].sort((a, b) => String(a.id).localeCompare(String(b.id)));
  lines.push(`invitations\t${inv.map((i) => `${i.id}:${i.status}`).join(",")}`);
  const kept = notifications.filter((n) => !(n.type === "family_invite" && r.closedInvitationIds.has(String(n.refId))));
  lines.push(`cloches\t${kept.map((n) => `${n.jellyfinUserId}:${n.type}:${n.refId}`).join(",")}`);
  return lines;
}

describe("Famille v1 → v2 pendant la copie", () => {
  const expected = readFileSync(resolve(BANC, "attendu.txt"), "utf8")
    .trim()
    .split("\n")
    // L'index unique est un fait du SCHÉMA (migrations du socle), pas de la copie.
    .filter((l) => !l.startsWith("index unique userId"));

  it("donne exactement le résultat du banc MariaDB (attendu.txt)", () => {
    const v1 = v1Tables();
    const r = migrateFamilyToV2(v1, NOW);
    expect(check(r, v1.notifications)).toEqual(expected);
    expect(r.orphansDropped).toBe(0);
  });

  it("rejouée sur son propre résultat (une base déjà en v2), ne change rien", () => {
    const v1 = v1Tables();
    const once = migrateFamilyToV2(v1, NOW);
    const twice = migrateFamilyToV2(once, NOW + 60_000);
    expect(twice.families).toEqual(once.families);
    expect(twice.members).toEqual(once.members);
    expect(twice.invitations).toEqual(once.invitations);
  });

  it("date de réponse des invitations closes = l'instant de la copie, en millisecondes", () => {
    const r = migrateFamilyToV2(v1Tables(), NOW);
    expect(r.invitations.find((i) => i.id === "inv1")!.respondedAt).toBe(NOW);
    expect(r.invitations.find((i) => i.id === "inv4")!.respondedAt).toBeNull();
  });

  it("une ligne orpheline (famille absente) qui doublerait un compte est écartée et comptée", () => {
    const v1 = v1Tables();
    v1.members.push({ id: "orph", familyId: "FX", userId: "c", kind: "member", displayName: "C", color: null,
      jellyfinName: null, createdBy: null, canCreateGuests: 0, canRequestTitles: 0, createdAt: 0 });
    const r = migrateFamilyToV2(v1, NOW);
    expect(r.orphansDropped).toBe(1);
    expect(r.members.filter((m) => m.userId === "c")).toHaveLength(1);
  });
});
