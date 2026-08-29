/**
 * Ce qui se vérifie ici ne se voit jamais à l'écran tant que ça fonctionne :
 * un blocage empilé, ou un blocage jamais rendu, ne se manifeste qu'une heure
 * plus tard, sur la machine de quelqu'un d'autre.
 */

import { describe, expect, it } from "vitest";
import {
  createDisplayWakeLock,
  createSystemWakeLock,
  type SleepBlocker,
  type BlockerKind,
} from "./powerSave";

interface Fake extends SleepBlocker {
  active: () => number[];
  startups: () => number;
  types: () => BlockerKind[];
}

/** `powerSaveBlocker` de bureau, en mémoire. */
function fakeBlocker(): Fake {
  const active = new Set<number>();
  const types: BlockerKind[] = [];
  let next = 1;
  let startups = 0;
  return {
    start(type) {
      startups += 1;
      types.push(type);
      const id = next;
      next += 1;
      active.add(id);
      return id;
    },
    stop(id) {
      active.delete(id);
    },
    isStarted(id) {
      return active.has(id);
    },
    active: () => [...active],
    startups: () => startups,
    types: () => [...types],
  };
}

describe("veille de l'ecran", () => {
  it("pose un blocage, et un seul", () => {
    const blocker = fakeBlocker();
    const wakeLock = createDisplayWakeLock(blocker);

    wakeLock.prevent();
    wakeLock.prevent();
    wakeLock.prevent();

    expect(blocker.startups()).toBe(1);
    expect(blocker.active()).toHaveLength(1);
    expect(blocker.types()).toEqual(["prevent-display-sleep"]);
  });

  it("rend le blocage", () => {
    const blocker = fakeBlocker();
    const wakeLock = createDisplayWakeLock(blocker);

    wakeLock.prevent();
    wakeLock.release();

    expect(blocker.active()).toHaveLength(0);
  });

  it("ne fait rien quand il n'y a rien a rendre", () => {
    const blocker = fakeBlocker();
    const wakeLock = createDisplayWakeLock(blocker);

    wakeLock.release();
    wakeLock.release();

    expect(blocker.startups()).toBe(0);
    expect(blocker.active()).toHaveLength(0);
  });

  it("repose un blocage apres l'avoir rendu", () => {
    const blocker = fakeBlocker();
    const wakeLock = createDisplayWakeLock(blocker);

    wakeLock.prevent();
    wakeLock.release();
    wakeLock.prevent();

    expect(blocker.startups()).toBe(2);
    expect(blocker.active()).toHaveLength(1);
  });

  // Le systeme peut lever un blocage de son cote : le croire encore actif
  // laisserait l'ecran s'eteindre en pleine lecture, sans que rien ne le dise.
  it("repose un blocage que le systeme a leve", () => {
    const blocker = fakeBlocker();
    const wakeLock = createDisplayWakeLock(blocker);

    wakeLock.prevent();
    const applied = blocker.active()[0];
    expect(applied).toBeDefined();
    if (applied !== undefined) blocker.stop(applied);
    wakeLock.prevent();

    expect(blocker.startups()).toBe(2);
    expect(blocker.active()).toHaveLength(1);
  });
});

describe("veille du systeme", () => {
  // C'est CE type qui repousse la mise en veille du PC sans allumer l'ecran.
  // Se tromper de type et le telechargement s'arreterait quand meme, ou bien
  // l'ecran resterait allume toute la nuit pour un transfert.
  it("demande l'anti-suspension, pas l'anti-veille de l'ecran", () => {
    const blocker = fakeBlocker();

    createSystemWakeLock(blocker).prevent();

    expect(blocker.types()).toEqual(["prevent-app-suspension"]);
  });

  it("pose un blocage, et un seul", () => {
    const blocker = fakeBlocker();
    const wakeLock = createSystemWakeLock(blocker);

    wakeLock.prevent();
    wakeLock.prevent();

    expect(blocker.startups()).toBe(1);
  });

  it("rend le blocage", () => {
    const blocker = fakeBlocker();
    const wakeLock = createSystemWakeLock(blocker);

    wakeLock.prevent();
    wakeLock.release();

    expect(blocker.active()).toHaveLength(0);
  });
});

// Les deux blocages partagent le meme `powerSaveBlocker` : un etat commun
// ferait rendre l'anti-veille de l'ecran par la fin d'un telechargement, en
// pleine lecture.
describe("les deux blocages cohabitent", () => {
  it("rendre l'un laisse l'autre pose", () => {
    const blocker = fakeBlocker();
    const display = createDisplayWakeLock(blocker);
    const system = createSystemWakeLock(blocker);

    display.prevent();
    system.prevent();
    system.release();

    expect(blocker.active()).toHaveLength(1);

    display.release();

    expect(blocker.active()).toHaveLength(0);
  });
});
