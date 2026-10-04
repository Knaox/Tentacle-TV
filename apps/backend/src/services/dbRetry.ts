/**
 * Un conflit d'écriture de la base. MariaDB 11 (isolation par instantané,
 * `innodb_snapshot_isolation`) refuse de modifier une ligne qu'une autre
 * transaction a changée depuis la lecture de la sienne (erreur 1020, « Record
 * has changed since last read ») ; MySQL comme MariaDB lèvent 1213 sur un
 * interblocage ; Prisma dit P2034 quand il reconnaît l'un ou l'autre. Rien n'a
 * été écrit : il suffit de RELIRE et de rejouer — jamais de réécrire une
 * lecture périmée.
 */

export function isWriteConflict(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  if (code === "P2034") return true;
  const message = String((error as { message?: unknown } | null)?.message ?? "");
  return /\b(1020|1213)\b|Record has changed since last read|Deadlock found/i.test(message);
}

/** Rejoue `task` — lecture comprise — sur un conflit d'écriture, `attempts` fois au plus. */
export async function retryOnWriteConflict<T>(task: () => Promise<T>, attempts = 3): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await task();
    } catch (error) {
      if (attempt >= attempts || !isWriteConflict(error)) throw error;
      console.log(`[db] conflit d'écriture, nouvel essai (${attempt + 1}/${attempts})`);
    }
  }
}
