/**
 * Une table `notification` en mémoire pour les tests des routes de la cloche :
 * le sous-ensemble de Prisma qu'elles appellent (filtre par compte et par
 * `read`, tri par date puis identifiant décroissants, `take`, curseur).
 */

export interface FakeNotification {
  id: string;
  jellyfinUserId: string;
  type: string;
  title: string;
  body: string | null;
  refId: string | null;
  target: string | null;
  state: string | null;
  read: boolean;
  createdAt: Date;
}

interface Where {
  id?: string | { in: string[] };
  jellyfinUserId?: string;
  read?: boolean;
}

function matches(n: FakeNotification, where: Where = {}): boolean {
  if (where.jellyfinUserId !== undefined && n.jellyfinUserId !== where.jellyfinUserId) return false;
  if (where.read !== undefined && n.read !== where.read) return false;
  if (typeof where.id === "string" && n.id !== where.id) return false;
  if (where.id && typeof where.id === "object" && !where.id.in.includes(n.id)) return false;
  return true;
}

/** Le plus récent d'abord ; à date égale, l'identifiant le plus grand. */
function newestFirst(a: FakeNotification, b: FakeNotification): number {
  return b.createdAt.getTime() - a.createdAt.getTime() || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0);
}

export function fakeNotificationStore(store: { rows: FakeNotification[] }) {
  return {
    findMany: async (args: { where?: Where; take?: number; cursor?: { id: string }; skip?: number }) => {
      let rows = store.rows.filter((n) => matches(n, args.where)).sort(newestFirst);
      if (args.cursor) {
        const at = rows.findIndex((n) => n.id === args.cursor?.id);
        rows = at < 0 ? [] : rows.slice(at);
      }
      rows = rows.slice(args.skip ?? 0);
      return args.take === undefined ? rows : rows.slice(0, args.take);
    },
    findUnique: async (args: { where: { id: string } }) => store.rows.find((n) => n.id === args.where.id) ?? null,
    count: async (args: { where?: Where }) => store.rows.filter((n) => matches(n, args.where)).length,
    update: async (args: { where: { id: string }; data: Partial<FakeNotification> }) => {
      const n = store.rows.find((r) => r.id === args.where.id);
      if (n) Object.assign(n, args.data);
      return n;
    },
    updateMany: async (args: { where?: Where; data: Partial<FakeNotification> }) => {
      const hit = store.rows.filter((n) => matches(n, args.where));
      for (const n of hit) Object.assign(n, args.data);
      return { count: hit.length };
    },
    delete: async (args: { where: { id: string } }) => {
      store.rows = store.rows.filter((n) => n.id !== args.where.id);
    },
    deleteMany: async (args: { where?: Where }) => {
      const before = store.rows.length;
      store.rows = store.rows.filter((n) => !matches(n, args.where));
      return { count: before - store.rows.length };
    },
  };
}
