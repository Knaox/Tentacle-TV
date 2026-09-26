/**
 * Le fond au focus, en DEUX EMPLACEMENTS fixes.
 *
 * **Pourquoi plus de pile de calques.** La version précédente montait un
 * `<img>` par image et démontait l'ancien à la fin du fondu. Chaque changement
 * de carte créait donc un calque de compositeur plein écran, puis en détruisait
 * un autre — et Chromium, à chaque changement de la liste des calques,
 * rastérisait de nouveau tout ce qui les entoure : le voile, le décor de
 * marque, la bannière et son bruit. Mesuré sur la C3 : ~280 tuiles et près
 * d'une seconde de processeur graphique par carte visée, le fondu lui-même
 * saccadé à 30 images par seconde.
 *
 * Ici les deux `<img>` existent tant que le fond est à l'écran, chacun dans son
 * calque, dans un ordre qui ne change jamais : `slots[0]` dessous, `slots[1]`
 * dessus. Changer d'image ne fait que changer une adresse — seul l'emplacement
 * qui la reçoit se rastérise.
 *
 * **Le fondu enchaîné reste le même à l'œil.** L'entrante arrive tantôt
 * dessus, tantôt dessous. Dessus, elle monte en opacité (`in`). Dessous, elle
 * est posée pleine et c'est la sortante, dessus, qui s'efface avec la même
 * courbe (`handoff`) : le mélange vaut `α·entrante + (1−α)·sortante` dans les
 * deux cas, puisqu'une opacité qui descend de 1 à 0 en ease-out vaut exactement
 * `1 − α` quand celle qui monte vaut `α`.
 *
 * Module pur : la décision se lit d'un bloc et se teste (`backdropSlots.test.ts`).
 */

/**
 * - `hidden` : transparent, rien à composer ;
 * - `shown` : pleine opacité, au repos ;
 * - `in` : entre en fondu, de 0 à 1 ;
 * - `handoff` : s'efface pour révéler l'entrante posée dessous ;
 * - `out` : s'efface sans relève — plus rien à montrer.
 */
export type SlotPhase = "hidden" | "shown" | "in" | "handoff" | "out";

export interface BackdropSlot {
  url: string | null;
  /** L'image est arrivée — chargée ET décodée. */
  ready: boolean;
  phase: SlotPhase;
}

export type SlotIndex = 0 | 1;

export interface BackdropSlots {
  /** Dessous puis dessus : l'ordre du document, donc l'ordre d'empilement. */
  slots: [BackdropSlot, BackdropSlot];
  /** L'emplacement de l'image voulue, ou `null` quand on n'en veut plus. */
  target: SlotIndex | null;
}

const EMPTY: BackdropSlot = { url: null, ready: false, phase: "hidden" };

export const INITIAL_SLOTS: BackdropSlots = { slots: [EMPTY, EMPTY], target: null };

const other = (index: SlotIndex): SlotIndex => (index === 0 ? 1 : 0);

function put(state: BackdropSlots, index: SlotIndex, slot: BackdropSlot): BackdropSlots {
  const slots: BackdropSlots["slots"] = index === 0 ? [slot, state.slots[1]] : [state.slots[0], slot];
  return { ...state, slots };
}

/** Un fondu en cours est mené à son terme d'un coup : l'entrante tient l'écran seule. */
function settleCrossfade(state: BackdropSlots): BackdropSlots {
  let next = state;
  if (next.slots[1].phase === "in") {
    next = put(next, 1, { ...next.slots[1], phase: "shown" });
    if (next.slots[0].phase === "shown") next = put(next, 0, { ...next.slots[0], phase: "hidden" });
  }
  if (next.slots[0].phase === "in") next = put(next, 0, { ...next.slots[0], phase: "shown" });
  if (next.slots[1].phase === "handoff") next = put(next, 1, { ...next.slots[1], phase: "hidden" });
  return next;
}

/**
 * Le fondu de l'emplacement `index`, dont l'image est prête. Dessous et sous
 * une image pleine : posée d'emblée, et c'est celle du dessus qui s'efface.
 */
function startFade(state: BackdropSlots, index: SlotIndex): BackdropSlots {
  const facing = state.slots[other(index)];
  if (index === 0 && facing.phase === "shown") {
    const under = put(state, 0, { ...state.slots[0], phase: "shown" });
    return put(under, 1, { ...facing, phase: "handoff" });
  }
  return put(state, index, { ...state.slots[index], phase: "in" });
}

/** L'image voulue change — une adresse, ou `null` pour ne plus rien montrer. */
export function want(state: BackdropSlots, url: string | null): BackdropSlots {
  if (url === null) {
    const idle = state.slots.every((slot) => slot.phase === "hidden" || slot.phase === "out");
    if (state.target === null && idle) return state;
    const settled = settleCrossfade(state);
    const slots = settled.slots.map((slot): BackdropSlot =>
      slot.phase === "shown" || slot.phase === "out" ? { ...slot, phase: "out" } : { ...slot, phase: "hidden" },
    ) as BackdropSlots["slots"];
    return { slots, target: null };
  }

  const holder = state.slots.findIndex((slot) => slot.url === url);
  if (holder === 0 || holder === 1) {
    const slot = state.slots[holder];
    // Déjà là, ou déjà en route : rien à faire. C'est ce qui garde le fond
    // IMMOBILE d'un épisode au suivant — même série, même Backdrop.
    if (slot.phase === "shown" || slot.phase === "in") {
      return state.target === holder ? state : { ...state, target: holder };
    }
    if (state.target === holder && !slot.ready) return state;
    // Il s'effaçait : il revient, en fondu, par-dessus ce qui reste.
    if (slot.ready && (slot.phase === "out" || slot.phase === "handoff")) {
      const settled = settleCrossfade(put(state, holder, { ...slot, phase: "hidden" }));
      return { ...put(settled, holder, { ...slot, phase: "in" }), target: holder };
    }
  }

  // Une image neuve : elle va dans l'emplacement qui ne montre rien.
  const settled = settleCrossfade(state);
  const shown = settled.slots.findIndex((slot) => slot.phase === "shown" || slot.phase === "out");
  const kept = settled.slots.findIndex((slot) => slot.url === url);
  // Rien à l'écran : l'emplacement qui la tient déjà, sinon dessus — une
  // entrée en fondu ordinaire.
  const free: SlotIndex =
    shown === 0 || shown === 1 ? other(shown) : kept === 0 || kept === 1 ? kept : 1;
  const current = settled.slots[free];
  if (current.url === url && current.ready) {
    // Déjà décodée dans cet emplacement : le fondu part tout de suite.
    return startFade({ ...settled, target: free }, free);
  }
  return { ...put(settled, free, { url, ready: false, phase: "hidden" }), target: free };
}

/** L'image d'un emplacement est arrivée : le fondu part, si c'est bien celle qu'on veut. */
export function arrived(state: BackdropSlots, index: SlotIndex, url: string): BackdropSlots {
  const slot = state.slots[index];
  if (slot.url !== url || slot.ready) return state;
  const next = put(state, index, { ...slot, ready: true });
  return state.target === index ? startFade(next, index) : next;
}

/** Le fondu d'un emplacement est terminé. */
export function settled(state: BackdropSlots, index: SlotIndex): BackdropSlots {
  const slot = state.slots[index];
  if (slot.phase === "in") {
    const next = put(state, index, { ...slot, phase: "shown" });
    // Recouverte par une image opaque : plus rien à composer dessous.
    if (index === 1 && next.slots[0].phase === "shown") {
      return put(next, 0, { ...next.slots[0], phase: "hidden" });
    }
    return next;
  }
  if (slot.phase === "handoff" || slot.phase === "out") {
    return put(state, index, { ...slot, phase: "hidden" });
  }
  return state;
}

/** Le voile accompagne le fond : dès qu'une image est voulue, jusqu'à la fin de la dernière sortie. */
export function veiled(state: BackdropSlots): boolean {
  return state.target !== null || state.slots.some((slot) => slot.phase !== "hidden");
}
