import type { FocusStore } from "../focus/focusStore";

/**
 * Le GROUPE du rail (`RAIL_GROUP_KEY`, tv-core) sur tvOS : lié à rien — le
 * moteur de tvOS ne vise jamais ce que le rail ouvert recouvre, et ses
 * raccourcis (`RailShortcuts`) tiennent les bouts. Android TV a sa variante
 * (`railGroup.android.ts`).
 */
export function useRailGroup(_focus: FocusStore): void {}
