/**
 * Un geste à la fois par famille (SEC-F-33) : inviter, accepter, créer ou
 * supprimer un invité, retirer, dissoudre changent la COMPOSITION d'une
 * famille ; deux gestes concurrents relisaient la même capacité et
 * dépassaient ensemble les six profils ou les trois invités. Chaque geste
 * s'exécute donc seul sur sa clé (le propriétaire), relit l'état DANS le
 * verrou, puis écrit. Tentacle tourne en un seul processus : le verrou en
 * mémoire suffit ; l'unicité du propriétaire reste, elle, une contrainte de la
 * base.
 *
 * La même file sert, sous d'autres clés, à ouvrir une session de profil
 * (`tv:<jumelage>`, une à la fois par TV) et à juger un PIN (`pin:<profil>`,
 * un essai à la fois par profil).
 */

const queues = new Map<string, Promise<unknown>>();

export function withFamilyLock<T>(ownerUserId: string, task: () => Promise<T>): Promise<T> {
  const key = ownerUserId.replace(/-/g, "").toLowerCase();
  const previous = queues.get(key) ?? Promise.resolve();
  const run = previous.then(task, task);
  const tail = run.catch(() => undefined);
  queues.set(key, tail);
  void tail.then(() => {
    if (queues.get(key) === tail) queues.delete(key);
  });
  return run;
}
