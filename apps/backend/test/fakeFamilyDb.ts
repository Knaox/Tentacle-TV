/**
 * Une base EN MÉMOIRE pour la Famille : les tables et les seules formes de
 * requête Prisma qu'emploient la Famille, le jumelage et la cloche —
 * égalité (null compris), `in`, `not`, `gt/gte/lt/lte`, `select`, `orderBy`,
 * `take`, unicités. Une table par modèle, chacune générique.
 */

type Row = Record<string, unknown>;
type Where = Record<string, unknown>;

interface ModelSpec {
  key?: string[];
  unique?: string[][];
  defaults: () => Row;
}

let serial = 0;
const id = (prefix: string) => `${prefix}-${++serial}`;
const now = () => new Date();

const SPECS: Record<string, ModelSpec> = {
  pairedDevice: {
    unique: [["tokenHash"]],
    defaults: () => ({
      id: id("pd"), name: "TV", jellyfinUserId: "", username: "", jellyfinAccessToken: null, jellyfinDeviceId: null,
      lastSeen: now(), createdAt: now(), parentId: null, profileKind: null, profilesSince: null, legacyTokenHash: null,
      stickyProfileId: null, manageUntil: null,
    }),
  },
  pairedDeviceCleanup: {
    unique: [["jellyfinDeviceId"]],
    defaults: () => ({ id: id("cl"), attempts: 0, nextAttemptAt: now(), createdAt: now() }),
  },
  family: { unique: [["ownerUserId"]], defaults: () => ({ id: id("fam"), ownerColor: null, createdAt: now(), updatedAt: now() }) },
  familyMember: {
    // v2 : une famille par compte — l'unicité de `userId` est celle de la base.
    unique: [["familyId", "userId"], ["userId"]],
    defaults: () => ({ id: id("fm"), color: null, jellyfinName: null, createdBy: null, canCreateGuests: false, canRequestTitles: false, createdAt: now() }),
  },
  familyInvitation: { defaults: () => ({ status: "pending", createdAt: now(), respondedAt: null, snoozedUntil: null }) },
  profilePin: { key: ["userId"], defaults: () => ({ updatedAt: now() }) },
  profilePinAttempt: { key: ["userId"], defaults: () => ({ failures: 0, lockCount: 0, lockedUntil: null, updatedAt: now() }) },
  notification: { defaults: () => ({ id: id("n"), body: null, refId: null, read: false, createdAt: now(), pushedAt: null }) },
  notificationPreference: { key: ["jellyfinUserId"], defaults: () => ({ updatedAt: now() }) },
  pushDevice: { defaults: () => ({ id: id("push"), lastSeen: now(), createdAt: now() }) },
  serverConfig: { key: ["key"], defaults: () => ({}) },
  provisioningCode: { defaults: () => ({ id: id("prov"), enabled: false, createdAt: now(), updatedAt: now() }) },
};

function compare(actual: unknown, condition: unknown): boolean {
  if (condition === null || typeof condition !== "object" || condition instanceof Date) {
    if (condition instanceof Date) return actual instanceof Date && actual.getTime() === condition.getTime();
    return (actual ?? null) === condition;
  }
  const c = condition as Record<string, unknown>;
  if ("in" in c) return (c.in as unknown[]).includes(actual);
  if ("not" in c) return !compare(actual, c.not);
  const value = actual instanceof Date ? actual.getTime() : (actual as number);
  const bound = (key: string) => {
    const raw = c[key];
    return raw instanceof Date ? raw.getTime() : (raw as number);
  };
  if (actual === null || actual === undefined) return false;
  if ("gt" in c && !(value > bound("gt"))) return false;
  if ("gte" in c && !(value >= bound("gte"))) return false;
  if ("lt" in c && !(value < bound("lt"))) return false;
  if ("lte" in c && !(value <= bound("lte"))) return false;
  return true;
}

function matches(row: Row, where: Where | undefined): boolean {
  if (!where) return true;
  return Object.entries(where).every(([key, condition]) => {
    if (condition && typeof condition === "object" && !(condition instanceof Date) && !("in" in condition) && !("not" in condition)
      && !["gt", "gte", "lt", "lte"].some((op) => op in (condition as object))) {
      // Clé composée (`pairingId_userId`) : un objet de champs.
      return matches(row, condition as Where);
    }
    return compare(row[key], condition);
  });
}

function pick(row: Row | undefined, select?: Record<string, boolean>): Row | null {
  if (!row) return null;
  if (!select) return { ...row };
  return Object.fromEntries(Object.keys(select).map((k) => [k, row[k]]));
}

function order(rows: Row[], orderBy?: Record<string, "asc" | "desc">): Row[] {
  if (!orderBy) return rows;
  const [[field, dir]] = Object.entries(orderBy);
  const value = (row: Row) => (row[field] instanceof Date ? (row[field] as Date).getTime() : (row[field] as number) ?? 0);
  return [...rows].sort((a, b) => (dir === "desc" ? value(b) - value(a) : value(a) - value(b)));
}

function table(name: string, rows: Row[], state: { down: boolean }) {
  const spec = SPECS[name];
  const guard = () => {
    if (state.down) throw new Error("base tombée");
  };
  const conflicts = (candidate: Row, except?: Row) =>
    [...(spec.unique ?? []), ...(spec.key ? [spec.key] : [])].some((fields) =>
      rows.some((row) => row !== except && fields.every((f) => row[f] !== undefined && row[f] === candidate[f])),
    );
  const create = (data: Row) => {
    const row = { ...spec.defaults(), ...data };
    if (conflicts(row)) throw Object.assign(new Error("contrainte unique"), { code: "P2002" });
    rows.push(row);
    return row;
  };
  return {
    findUnique: async (a: { where: Where; select?: Record<string, boolean> }) => (guard(), pick(rows.find((r) => matches(r, a.where)), a.select)),
    findFirst: async (a: { where?: Where; orderBy?: Record<string, "asc" | "desc">; select?: Record<string, boolean> } = {}) =>
      (guard(), pick(order(rows.filter((r) => matches(r, a.where)), a.orderBy)[0], a.select)),
    findMany: async (a: { where?: Where; select?: Record<string, boolean>; orderBy?: Record<string, "asc" | "desc">; take?: number } = {}) => {
      guard();
      const found = order(rows.filter((r) => matches(r, a.where)), a.orderBy);
      return (a.take ? found.slice(0, a.take) : found).map((r) => pick(r, a.select) as Row);
    },
    count: async (a: { where?: Where } = {}) => (guard(), rows.filter((r) => matches(r, a.where)).length),
    create: async (a: { data: Row }) => (guard(), { ...create(a.data) }),
    createMany: async (a: { data: Row[] }) => (guard(), { count: a.data.map(create).length }),
    update: async (a: { where: Where; data: Row }) => {
      guard();
      const row = rows.find((r) => matches(r, a.where));
      if (!row) throw Object.assign(new Error("absent"), { code: "P2025" });
      const next = { ...row, ...a.data };
      if (conflicts(next, row)) throw Object.assign(new Error("contrainte unique"), { code: "P2002" });
      Object.assign(row, a.data);
      return { ...row };
    },
    updateMany: async (a: { where?: Where; data: Row }) => {
      guard();
      const hit = rows.filter((r) => matches(r, a.where));
      for (const row of hit) Object.assign(row, a.data);
      return { count: hit.length };
    },
    upsert: async (a: { where: Where; create: Row; update: Row }) => {
      guard();
      const row = rows.find((r) => matches(r, a.where));
      if (row) return { ...Object.assign(row, a.update) };
      return { ...create(a.create) };
    },
    deleteMany: async (a: { where?: Where } = {}) => {
      guard();
      const before = rows.length;
      const kept = rows.filter((r) => !matches(r, a.where));
      rows.splice(0, rows.length, ...kept);
      return { count: before - rows.length };
    },
    delete: async (a: { where: Where }) => {
      guard();
      const index = rows.findIndex((r) => matches(r, a.where));
      if (index < 0) throw Object.assign(new Error("absent"), { code: "P2025" });
      return rows.splice(index, 1)[0];
    },
  };
}

export function createFamilyDb() {
  const state = { down: false };
  const data: Record<string, Row[]> = Object.fromEntries(Object.keys(SPECS).map((name) => [name, []]));
  const tables = Object.fromEntries(Object.keys(SPECS).map((name) => [name, table(name, data[name], state)])) as Record<
    string,
    ReturnType<typeof table>
  >;
  type Tables = Record<string, ReturnType<typeof table>>;
  const transaction = async (arg: unknown) => {
    if (typeof arg === "function") return (arg as (tx: Tables) => Promise<unknown>)(tables);
    return Promise.all(arg as Promise<unknown>[]);
  };
  const client = Object.assign({}, tables, { $transaction: transaction }) as Tables & { $transaction: typeof transaction };
  return { state, data, client };
}
