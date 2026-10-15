import type { Room } from "./roomTypes";

/**
 * Une file d'attente PAR SALLE : une tâche s'exécute tout de suite si rien
 * n'attend, sinon derrière ce qui attend, dans l'ordre d'arrivée. Une tâche
 * `async` ouvre une attente que les suivantes respectent ; sans attente en
 * cours, tout reste synchrone. Chaque file créée est indépendante des autres :
 * les messages du salon (`inRoomOrder`) n'attendent pas les diffusions de
 * l'affinité, ni l'inverse.
 */
export type RoomQueue = (room: Room, task: () => void | Promise<void>, async?: boolean) => void;

interface Queue {
  tail: Promise<void>;
  pending: number;
}

export function createRoomQueue(): RoomQueue {
  const queues = new WeakMap<Room, Queue>();
  return (room, task, async = false) => {
    const queue = queues.get(room);
    if (!queue && !async) {
      task();
      return;
    }
    const current = queue ?? { tail: Promise.resolve(), pending: 0 };
    queues.set(room, current);
    current.pending += 1;
    current.tail = current.tail
      .then(task)
      .catch(() => {})
      .finally(() => {
        current.pending -= 1;
        if (current.pending === 0 && queues.get(room) === current) queues.delete(room);
      });
  };
}
