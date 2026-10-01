/**
 * Une base de jumelages EN MÉMOIRE : `paired_devices` et le journal
 * `paired_device_cleanups`, avec les seules opérations Prisma qu'emploient
 * le jumelage, la frappe des jetons propres et la révocation. Une panne de
 * base se simule par `down`.
 */

export interface DeviceRow {
  id: string;
  name: string;
  jellyfinUserId: string;
  username: string;
  tokenHash: string;
  jellyfinAccessToken: string | null;
  jellyfinDeviceId: string | null;
  lastSeen: Date;
  createdAt: Date;
}

export interface CleanupRow {
  id: string;
  jellyfinDeviceId: string;
  tokenHash: string;
  reason: string;
  attempts: number;
  nextAttemptAt: Date;
  createdAt: Date;
}

type Where = Partial<Record<keyof DeviceRow, unknown>>;

function matches<T extends object>(row: T, where: Record<string, unknown> | undefined): boolean {
  if (!where) return true;
  return Object.entries(where).every(([key, value]) => {
    const actual = (row as Record<string, unknown>)[key];
    if (value && typeof value === "object" && "lte" in value) return (actual as Date) <= (value as { lte: Date }).lte;
    return actual === value;
  });
}

function pick<T extends object>(row: T | undefined, select?: Record<string, boolean>): Partial<T> | null {
  if (!row) return null;
  if (!select) return { ...row };
  return Object.fromEntries(Object.keys(select).map((k) => [k, (row as Record<string, unknown>)[k]])) as Partial<T>;
}

export function createPairingDb() {
  const state = { devices: [] as DeviceRow[], cleanups: [] as CleanupRow[], down: false, serial: 0 };
  const guard = () => {
    if (state.down) throw new Error("base tombée");
  };

  const pairedDevice = {
    findUnique: async (args: { where: Where; select?: Record<string, boolean> }) => {
      guard();
      return pick(state.devices.find((d) => matches(d, args.where)), args.select);
    },
    findMany: async (args: { where?: Where } = {}) => {
      guard();
      return state.devices.filter((d) => matches(d, args.where)).map((d) => ({ ...d }));
    },
    create: async (args: { data: Partial<DeviceRow> & { tokenHash: string } }) => {
      guard();
      const row: DeviceRow = {
        id: `pd-${++state.serial}`, name: "TV", jellyfinUserId: "", username: "", jellyfinAccessToken: null,
        jellyfinDeviceId: null, lastSeen: new Date(), createdAt: new Date(), ...args.data,
      };
      state.devices.push(row);
      return { ...row };
    },
    updateMany: async (args: { where: Where; data: Partial<DeviceRow> }) => {
      guard();
      const hit = state.devices.filter((d) => matches(d, args.where));
      for (const d of hit) Object.assign(d, args.data);
      return { count: hit.length };
    },
    update: async (args: { where: Where; data: Partial<DeviceRow> }) => {
      guard();
      const row = state.devices.find((d) => matches(d, args.where));
      if (!row) throw new Error("absent");
      Object.assign(row, args.data);
      return { ...row };
    },
    deleteMany: async (args: { where?: Where } = {}) => {
      guard();
      const before = state.devices.length;
      state.devices = state.devices.filter((d) => !matches(d, args.where));
      return { count: before - state.devices.length };
    },
  };

  const pairedDeviceCleanup = {
    upsert: async (args: { where: { jellyfinDeviceId: string }; create: Partial<CleanupRow>; update: Partial<CleanupRow> }) => {
      guard();
      const row = state.cleanups.find((c) => c.jellyfinDeviceId === args.where.jellyfinDeviceId);
      if (row) {
        Object.assign(row, args.update);
        return { ...row };
      }
      const created: CleanupRow = {
        id: `cl-${++state.serial}`, jellyfinDeviceId: "", tokenHash: "", reason: "", attempts: 0,
        nextAttemptAt: new Date(), createdAt: new Date(), ...args.create,
      };
      state.cleanups.push(created);
      return { ...created };
    },
    findUnique: async (args: { where: { jellyfinDeviceId: string } }) => {
      guard();
      return pick(state.cleanups.find((c) => c.jellyfinDeviceId === args.where.jellyfinDeviceId));
    },
    findMany: async (args: { where?: Record<string, unknown> } = {}) => {
      guard();
      return state.cleanups.filter((c) => matches(c, args.where)).map((c) => ({ ...c }));
    },
    update: async (args: { where: { jellyfinDeviceId: string }; data: Partial<CleanupRow> }) => {
      guard();
      const row = state.cleanups.find((c) => c.jellyfinDeviceId === args.where.jellyfinDeviceId);
      if (!row) throw new Error("absent");
      Object.assign(row, args.data);
      return { ...row };
    },
    deleteMany: async (args: { where: { jellyfinDeviceId: string } }) => {
      guard();
      const before = state.cleanups.length;
      state.cleanups = state.cleanups.filter((c) => c.jellyfinDeviceId !== args.where.jellyfinDeviceId);
      return { count: before - state.cleanups.length };
    },
  };

  const tables = { pairedDevice, pairedDeviceCleanup };
  const client = {
    ...tables,
    /** Interactive : les tables elles-mêmes tiennent lieu de transaction. */
    $transaction: async <T>(fn: (tx: typeof tables) => Promise<T>) => {
      guard();
      return fn(tables);
    },
  };
  return { state, client };
}
