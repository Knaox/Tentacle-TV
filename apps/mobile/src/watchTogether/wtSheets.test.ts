import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react", () => ({ useSyncExternalStore: vi.fn() }));
// Le vrai portier, sous l'alias que lit `wtSheets` (vitest ne résout pas `@/`).
vi.mock("@/components/ui/modalGate", async () => await import("../components/ui/modalGate"));
const gate = await import("../components/ui/modalGate");
const sheets = await import("./wtSheets");
const { afterWtSheet, closeWtSheet, currentWtSheet, openWtSheet, peekWtLink, requestWtLink, subscribeWtSheet, takeWtLink } = sheets;

/** La sortie animée d'une `BottomSheet` (ressort + garde-fou ≤ 600 ms). */
const SHEET_EXIT_MS = 320;
/** La sortie « slide » de la modale de l'affinité (`AffinityModalNative`). */
const SLIDE_EXIT_MS = 450;

/**
 * Le banc : chaque feuille du Watch Together se monte et se démonte comme une
 * `BottomSheet` — montée (déclarée au portier) quand le magasin la nomme,
 * démontée APRÈS sa sortie animée. On relève à chaque instant ce qui est
 * présenté : deux modales à la fois, c'est le gel d'iOS.
 */
function bench() {
  const mounted = new Map<string, () => void>();
  let peak = 0;
  const track = (): void => { peak = Math.max(peak, gate.modalsOpen()); };
  const sync = (): void => {
    const want = currentWtSheet();
    if (want && !mounted.has(want)) mounted.set(want, gate.retainModal());
    for (const [name, release] of mounted) {
      if (name === want) continue;
      setTimeout(() => {
        if (currentWtSheet() === name) return;
        mounted.delete(name);
        release();
      }, SHEET_EXIT_MS);
    }
    track();
  };
  const unsubscribe = subscribeWtSheet(sync);

  // La modale de l'affinité : elle attend son tour (`useGatedModal`).
  let affinityRelease: (() => void) | null = null;
  const openAffinity = (): void => {
    gate.whenNoModal(() => { affinityRelease = gate.retainModal(SLIDE_EXIT_MS); track(); });
  };
  const closeAffinity = (): void => { affinityRelease?.(); affinityRelease = null; };

  return {
    shown: (): string[] => [...mounted.keys()].filter((name) => name === currentWtSheet()),
    affinityShown: (): boolean => affinityRelease !== null,
    peak: (): number => peak,
    openAffinity,
    closeAffinity,
    dispose: unsubscribe,
  };
}

describe("wtSheets — une feuille à la fois, enchaînées", () => {
  let b: ReturnType<typeof bench>;
  // Une horloge qui avance d'un test à l'autre : le portier retient l'heure de
  // la dernière sortie (`quietAt`), comme sur l'appareil.
  let clock = Date.now();
  beforeEach(() => { clock += 3_600_000; vi.useFakeTimers({ now: clock }); b = bench(); });
  afterEach(() => {
    closeWtSheet();
    b.closeAffinity();
    vi.runAllTimers();
    b.dispose();
    vi.useRealTimers();
  });

  it("ouvre la feuille du groupe quand rien n'est à l'écran", () => {
    openWtSheet("room");
    vi.advanceTimersByTime(1);
    expect(b.shown()).toEqual(["room"]);
  });

  it("« Inviter » : la feuille d'invitation paraît APRÈS le retrait de celle du groupe, jamais par-dessus", () => {
    openWtSheet("room");
    vi.advanceTimersByTime(1);
    openWtSheet("invite");
    expect(currentWtSheet()).toBeNull();
    vi.advanceTimersByTime(SHEET_EXIT_MS - 1);
    expect(b.shown()).toEqual([]); // la feuille du groupe se retire encore
    vi.advanceTimersByTime(200);
    expect(b.shown()).toEqual(["invite"]);
    expect(b.peak()).toBe(1);
  });

  it("refermer « Inviter » ramène la feuille du groupe, et l'écran redevient libre à la fermeture", () => {
    openWtSheet("invite");
    vi.advanceTimersByTime(1);
    openWtSheet("room");
    vi.advanceTimersByTime(1000);
    expect(b.shown()).toEqual(["room"]);
    closeWtSheet();
    vi.advanceTimersByTime(1000);
    expect(gate.modalsOpen()).toBe(0); // aucun voile ne survit
    expect(b.peak()).toBe(1);
  });

  it("« Trouver quoi regarder » : l'affinité se présente une fois la feuille retirée", () => {
    openWtSheet("room");
    vi.advanceTimersByTime(1);
    closeWtSheet();
    b.openAffinity();
    vi.advanceTimersByTime(SHEET_EXIT_MS - 1);
    expect(b.affinityShown()).toBe(false);
    vi.advanceTimersByTime(200);
    expect(b.affinityShown()).toBe(true);
    expect(b.peak()).toBe(1);
  });

  it("l'affinité refermée : la feuille suivante attend la fin de sa sortie « slide »", () => {
    b.openAffinity();
    vi.advanceTimersByTime(1);
    b.closeAffinity();
    openWtSheet("room");
    vi.advanceTimersByTime(SLIDE_EXIT_MS - 10);
    expect(b.shown()).toEqual([]);
    vi.advanceTimersByTime(20);
    expect(b.shown()).toEqual(["room"]);
  });

  it("« Rejoindre » : le lecteur ne se présente qu'une fois la feuille retirée", () => {
    openWtSheet("room");
    vi.advanceTimersByTime(1);
    const push = vi.fn();
    afterWtSheet(push);
    vi.advanceTimersByTime(SHEET_EXIT_MS - 1);
    expect(push).not.toHaveBeenCalled();
    vi.advanceTimersByTime(200);
    expect(push).toHaveBeenCalledTimes(1);
    expect(gate.modalsOpen()).toBe(0);
  });

  it("une fermeture pendant l'attente annule l'ouverture (« Quitter », salle dissoute)", () => {
    openWtSheet("room");
    vi.advanceTimersByTime(1);
    openWtSheet("invite");
    closeWtSheet();
    vi.advanceTimersByTime(2000);
    expect(b.shown()).toEqual([]);
    expect(gate.modalsOpen()).toBe(0);
  });

  it("deux demandes rapprochées : seule la dernière se présente", () => {
    openWtSheet("room");
    vi.advanceTimersByTime(1);
    openWtSheet("invite");
    openWtSheet("inbox");
    vi.advanceTimersByTime(2000);
    expect(b.shown()).toEqual(["inbox"]);
    expect(b.peak()).toBe(1);
  });
});

describe("wtSheets — liens profonds", () => {
  it("un lien profond se note et ne se prend qu'une fois", () => {
    requestWtLink("affinity");
    expect(peekWtLink()).toBe("affinity");
    expect(takeWtLink()).toBe("affinity");
    expect(takeWtLink()).toBeNull();
  });
});
