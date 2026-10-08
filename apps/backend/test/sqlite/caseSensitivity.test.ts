import { readdirSync, readFileSync, statSync } from "fs";
import { join, resolve } from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sameUserId } from "../../src/family/familyRules";
import { registerSchema } from "../../src/routes/authAccount";
import { claimSchema } from "../../src/routes/pairing/codes";
import { generateShareToken, normalizeShareToken } from "../../src/services/shareToken";
import { openTestPrisma, type TestPrisma } from "./realPrisma";

/**
 * La casse, cas par cas (docs/sqlite/DECISION.md § 9). MariaDB
 * (`utf8mb4_unicode_ci`, PAD SPACE) ignorait la casse et les espaces finaux ;
 * SQLite compare à la lettre. Chaque valeur saisie est ramenée à sa forme à
 * l'ENTRÉE — jamais de `COLLATE NOCASE`, que `migrate diff` réécrirait.
 */
let db: TestPrisma;
beforeAll(async () => {
  db = await openTestPrisma();
});
afterAll(async () => {
  await db.close();
});

describe("SQLite compare à la lettre", () => {
  it("ni la casse ni l'espace final ne sont ignorés, et deux casses coexistent sous un @unique", async () => {
    await db.prisma.inviteKey.create({ data: { key: "ABC" } });
    expect(await db.prisma.inviteKey.findUnique({ where: { key: "abc" } })).toBeNull();
    expect(await db.prisma.inviteKey.findUnique({ where: { key: "ABC " } })).toBeNull();
    await expect(db.prisma.inviteKey.create({ data: { key: "abc" } })).resolves.toBeTruthy();
  });
});

describe("chaque saisie ramenée à la forme stockée", () => {
  it("clé d'invitation : générée en minuscules, retrouvée tapée en MAJUSCULES et entourée d'espaces", async () => {
    await db.prisma.inviteKey.create({ data: { key: "a1b2c3d4e5f6a7b8" } });
    const body = registerSchema.parse({ inviteKey: "  A1B2C3D4E5F6A7B8 ", username: "bob", password: "secret1" });
    expect(body.inviteKey).toBe("a1b2c3d4e5f6a7b8");
    expect(await db.prisma.inviteKey.findUnique({ where: { key: body.inviteKey } })).not.toBeNull();
  });

  it("jeton de partage : une URL retapée en majuscules retrouve le lien", async () => {
    const token = generateShareToken();
    expect(token).toBe(token.toLowerCase());
    await db.prisma.shareLink.create({ data: { token, ownerUserId: "u1", ownerUsername: "n" } });
    expect(await db.prisma.shareLink.findUnique({ where: { token: normalizeShareToken(token.toUpperCase()) } })).not.toBeNull();
  });

  it("code de jumelage : alphabet majuscule, saisie ramenée en majuscules", async () => {
    await db.prisma.pairingCode.create({ data: { code: "AB2C", expiresAt: new Date(Date.now() + 60_000) } });
    const { code } = claimSchema.parse({ code: "ab2c" });
    expect(await db.prisma.pairingCode.findUnique({ where: { code } })).not.toBeNull();
  });

  it("code de provisionnement : jamais cherché depuis une saisie", () => {
    const src = resolve(__dirname, "../../src");
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (name.endsWith(".ts") && !name.endsWith(".test.ts")) {
          if (/provisioningCode\.find\w*\(\s*\{\s*where:\s*\{\s*code/.test(readFileSync(path, "utf-8"))) hits.push(path);
        }
      }
    };
    walk(src);
    expect(hits).toEqual([]);
  });

  it("identifiants Jellyfin : uniques à la lettre en base, comparés repliés par la Famille", async () => {
    const family = await db.prisma.family.create({ data: { ownerUserId: "f12b22ea00000000000000000000000a", ownerName: "P" } });
    await db.prisma.familyMember.create({
      data: { familyId: family.id, userId: "f12b22ea00000000000000000000000a", kind: "owner", displayName: "P" },
    });
    // Jellyfin rend toujours la même forme (32 hexa minuscules) ; un client qui
    // en enverrait une autre est ramené à la ligne stockée par le repli.
    expect(sameUserId("F12B22EA-0000-0000-0000-00000000000A", "f12b22ea00000000000000000000000a")).toBe(true);
    await expect(
      db.prisma.familyMember.create({ data: { familyId: family.id, userId: "f12b22ea00000000000000000000000a", kind: "member", displayName: "Q" } }),
    ).rejects.toMatchObject({ code: "P2002" });
  });
});
