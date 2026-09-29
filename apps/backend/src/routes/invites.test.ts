/**
 * Les routes /api/invites de bout en bout : auth réelle (Jellyfin bouchonné
 * via le fetch global, motif tickets.test.ts), Prisma en mémoire. Ce qui est
 * vérifié : qui a créé l'invitation, qui l'a utilisée, les bornes de création
 * — et qu'elles restent celles de `@tentacle-tv/shared`, que le formulaire
 * du web applique avant l'envoi.
 */

import { existsSync, readFileSync } from "fs";
import { dirname, join } from "path";
import Fastify from "fastify";
import { ZodError } from "zod";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { modernJellyfinToken } from "../../test/jellyfinFakeAuth";

interface InviteRow {
  id: string; key: string; maxUses: number; currentUses: number;
  createdAt: Date; expiresAt: Date | null; createdBy: string | null;
}
interface UsageRow { id: string; inviteKeyId: string; jellyfinUserId: string; username: string; usedAt: Date }

const invites = new Map<string, InviteRow>();
const usages: UsageRow[] = [];
const findManyArgs: unknown[] = [];
let seq = 0;

vi.mock("../services/configStore", () => ({ getJellyfinUrl: () => "http://jf.test" }));
vi.mock("../services/jwt", () => ({
  verifyImpersonationToken: async () => null,
  verifyDeviceToken: async () => null,
  hashToken: (value: string) => value,
}));
vi.mock("../services/db", () => ({
  hasPrisma: () => true,
  getPrisma: () => ({
    inviteKey: {
      create: async (args: { data: Omit<InviteRow, "id" | "currentUses" | "createdAt" | "expiresAt"> & { expiresAt?: Date } }) => {
        const row: InviteRow = {
          id: `inv${++seq}`, currentUses: 0, createdAt: new Date(), ...args.data,
          expiresAt: args.data.expiresAt ?? null,
        };
        invites.set(row.id, row);
        return row;
      },
      findMany: async (args: unknown) => {
        findManyArgs.push(args);
        return [...invites.values()]
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .map((row) => ({ ...row, usages: usages.filter((u) => u.inviteKeyId === row.id) }));
      },
      findUnique: async (args: { where: { id: string } }) => invites.get(args.where.id) ?? null,
      delete: (args: { where: { id: string } }) => ({ op: "deleteKey", id: args.where.id }),
    },
    inviteUsage: {
      deleteMany: (args: { where: { inviteKeyId: string } }) => ({ op: "deleteUsages", id: args.where.inviteKeyId }),
    },
    // La transaction reçoit les deux opérations préparées, dans l'ordre.
    $transaction: async (ops: Array<{ op: string; id: string }>) => {
      for (const { op, id } of ops) {
        if (op === "deleteUsages") {
          for (let i = usages.length - 1; i >= 0; i--) if (usages[i].inviteKeyId === id) usages.splice(i, 1);
        } else if (usages.some((u) => u.inviteKeyId === id)) {
          throw new Error("violation de clé étrangère");
        } else {
          invites.delete(id);
        }
      }
      return ops;
    },
  }),
}));

import { INVITE_EXPIRY_HOURS_LIMIT, INVITE_MAX_USES_LIMIT, inviteRoutes } from "./invites";

const USERS: Record<string, { Id: string; Name: string; Policy: { IsAdministrator: boolean } }> = {
  "jeton-root": { Id: "a-root", Name: "root", Policy: { IsAdministrator: true } },
  "jeton-alice": { Id: "u-alice", Name: "alice", Policy: { IsAdministrator: false } },
};
const as = (token: string) => ({ "x-emby-token": token });

beforeEach(() => {
  invites.clear(); usages.length = 0; findManyArgs.length = 0; seq = 0;
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).includes("/Users/Me")) {
      const token = modernJellyfinToken(init?.headers);
      const user = USERS[token];
      return user ? new Response(JSON.stringify(user), { status: 200 }) : new Response("{}", { status: 401 });
    }
    return new Response("{}", { status: 404 });
  }));
});
afterEach(() => vi.unstubAllGlobals());

async function makeApp() {
  const app = Fastify();
  app.setErrorHandler((err: unknown, _req, reply) => {
    if (err instanceof ZodError) return reply.status(400).send({ message: "Validation error" });
    return reply.status(500).send({ message: err instanceof Error ? err.message : "Erreur" });
  });
  await app.register(inviteRoutes, { prefix: "/api/invites" });
  return app;
}

describe("création", () => {
  it("retient l'administrateur qui invite, et rend la clé avec son échéance", async () => {
    const app = await makeApp();
    const before = Date.now();
    const res = await app.inject({
      method: "POST", url: "/api/invites", headers: as("jeton-root"), payload: { maxUses: 5, expiresInHours: 72 },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json() as { id: string; key: string; maxUses: number; expiresAt: string };
    expect(body.key).toMatch(/^[0-9a-f]{16}$/);
    expect(body.maxUses).toBe(5);
    const expiresIn = Date.parse(body.expiresAt) - before;
    expect(expiresIn).toBeGreaterThanOrEqual(72 * 3_600_000);
    expect(expiresIn).toBeLessThan(72 * 3_600_000 + 60_000);
    expect(invites.get(body.id)?.createdBy).toBe("root");
  });

  it("sans durée, l'invitation n'expire pas", async () => {
    const app = await makeApp();
    const res = await app.inject({ method: "POST", url: "/api/invites", headers: as("jeton-root"), payload: { maxUses: 1 } });
    expect(res.statusCode).toBe(201);
    expect(res.json().expiresAt).toBeNull();
  });

  it("refuse une saisie hors bornes — NaN compris, que JSON transforme en null", async () => {
    const app = await makeApp();
    const cases = [
      { maxUses: 0 }, { maxUses: INVITE_MAX_USES_LIMIT + 1 }, { maxUses: 2.5 },
      { maxUses: 1, expiresInHours: 0 }, { maxUses: 1, expiresInHours: INVITE_EXPIRY_HOURS_LIMIT + 1 },
      JSON.parse(JSON.stringify({ maxUses: NaN })),
    ];
    for (const payload of cases) {
      const res = await app.inject({ method: "POST", url: "/api/invites", headers: as("jeton-root"), payload });
      expect(res.statusCode, JSON.stringify(payload)).toBe(400);
    }
    expect(invites.size).toBe(0);
  });

  it("reste fermée à un compte qui n'est pas administrateur", async () => {
    const app = await makeApp();
    const res = await app.inject({ method: "POST", url: "/api/invites", headers: as("jeton-alice"), payload: { maxUses: 1 } });
    expect(res.statusCode).toBe(403);
    expect(invites.size).toBe(0);
  });
});

describe("liste", () => {
  it("dit qui a créé chaque invitation et quels comptes elle a ouverts, dans l'ordre d'arrivée", async () => {
    const app = await makeApp();
    const created = (await app.inject({
      method: "POST", url: "/api/invites", headers: as("jeton-root"), payload: { maxUses: 3, expiresInHours: 24 },
    })).json() as { id: string };
    usages.push(
      { id: "us1", inviteKeyId: created.id, jellyfinUserId: "u-bob", username: "bob", usedAt: new Date("2026-09-26T10:00:00Z") },
      { id: "us2", inviteKeyId: created.id, jellyfinUserId: "u-eve", username: "eve", usedAt: new Date("2026-09-26T11:00:00Z") },
    );
    // Une invitation d'avant 1.19.3 : personne n'avait renseigné son auteur.
    invites.set("legacy", {
      id: "legacy", key: "0123456789abcdef", maxUses: 1, currentUses: 0,
      createdAt: new Date("2026-01-01T00:00:00Z"), expiresAt: null, createdBy: null,
    });

    const res = await app.inject({ method: "GET", url: "/api/invites", headers: as("jeton-root") });
    expect(res.statusCode).toBe(200);
    const [recent, legacy] = res.json() as Array<Record<string, unknown>>;
    expect(recent).toMatchObject({ id: created.id, maxUses: 3, currentUses: 0, createdBy: "root" });
    expect(recent.usages).toEqual([
      { username: "bob", usedAt: "2026-09-26T10:00:00.000Z", jellyfinUserId: "u-bob" },
      { username: "eve", usedAt: "2026-09-26T11:00:00.000Z", jellyfinUserId: "u-eve" },
    ]);
    expect(legacy).toMatchObject({ id: "legacy", createdBy: null, expiresAt: null, usages: [] });
    // L'ordre des usages est demandé à la base, pas laissé au hasard de l'insertion.
    expect(findManyArgs[0]).toMatchObject({ include: { usages: { orderBy: { usedAt: "asc" } } } });
  });
});

describe("suppression", () => {
  it("efface l'invitation et sa trace d'utilisation, les comptes restent", async () => {
    const app = await makeApp();
    const { id } = (await app.inject({
      method: "POST", url: "/api/invites", headers: as("jeton-root"), payload: { maxUses: 2 },
    })).json() as { id: string };
    usages.push({ id: "us1", inviteKeyId: id, jellyfinUserId: "u-bob", username: "bob", usedAt: new Date() });

    const res = await app.inject({ method: "DELETE", url: `/api/invites/${id}`, headers: as("jeton-root") });
    expect(res.statusCode).toBe(200);
    expect(invites.has(id)).toBe(false);
    expect(usages).toHaveLength(0);
  });

  it("répond 404 à une invitation inconnue", async () => {
    const app = await makeApp();
    const res = await app.inject({ method: "DELETE", url: "/api/invites/inconnue", headers: as("jeton-root") });
    expect(res.statusCode).toBe(404);
  });
});

/** La racine du dépôt, trouvée depuis le cwd (pnpm place le cwd dans le paquet). */
function repoRoot(): string {
  let folder = process.cwd();
  while (!existsSync(join(folder, "pnpm-workspace.yaml"))) {
    const parent = dirname(folder);
    if (parent === folder) throw new Error("racine du dépôt introuvable");
    folder = parent;
  }
  return folder;
}

describe("miroir des bornes", () => {
  it("les bornes du serveur sont celles de @tentacle-tv/shared", () => {
    const source = readFileSync(join(repoRoot(), "packages/shared/src/adminInvites/invites.ts"), "utf8");
    const read = (name: string) => Number(source.match(new RegExp(`export const ${name} = (\\d+);`))?.[1]);
    expect(read("INVITE_MAX_USES_LIMIT")).toBe(INVITE_MAX_USES_LIMIT);
    expect(read("INVITE_EXPIRY_HOURS_LIMIT")).toBe(INVITE_EXPIRY_HOURS_LIMIT);
  });
});
