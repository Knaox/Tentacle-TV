/**
 * Octave — une file « le dernier gagne » par clé (envois d'ordre, de tri) : un envoi à la fois ; pendant qu'il
 * part, seul le plus récent attend son tour (les intermédiaires sont remplacés).
 */

export function latestWinsQueue() {
  const running = new Map<string, Promise<void>>();
  const waiting = new Map<string, () => Promise<unknown>>();
  const drain = async (key: string): Promise<void> => {
    for (let task = waiting.get(key); task; task = waiting.get(key)) {
      waiting.delete(key);
      try {
        await task();
      } catch {
        // L'échec d'un envoi ne bloque pas le suivant ; l'appelant relit la vérité du serveur.
      }
    }
    running.delete(key);
  };
  return (key: string, task: () => Promise<unknown>): Promise<void> => {
    waiting.set(key, task);
    let current = running.get(key);
    if (!current) {
      current = drain(key);
      running.set(key, current);
    }
    return current;
  };
}

