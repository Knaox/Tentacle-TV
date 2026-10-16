import { useEffect, useState } from "react";
import { PIN_SETUP_ENTRY_KEY, pinSetupGuardedKeys } from "@tentacle-tv/tv-core";
import type { FocusStore } from "../focus/focusStore";

/**
 * L'applicateur de l'étape « Code PIN conseillé » (Apple TV ; Android TV par
 * les variantes `.android` du focus) — les décisions sont celles de tv-core
 * (`nav/pinSetupScreen.ts`) ; ce module ne fait que les poser : la garde du
 * clic fantôme, l'entrée réclamée.
 */

/** Les liaisons naissent avec l'écran, avant son premier rendu. */
export function usePinSetupGroups(store: FocusStore): void {
  useState(() => {
    // L'étape paraît sous l'OK qui a ouvert le profil : seul un OK commencé sur une de ses cibles y vaut.
    for (const key of pinSetupGuardedKeys()) store.bind(key, { phantomPressGuard: true });
  });
}

/** L'entrée, réclamée quand l'étape paraît — et de retour du pavé, quand l'écran reprend la main. */
export function usePinSetupEntry(store: FocusStore, active: boolean): void {
  useEffect(() => (active ? store.claim(PIN_SETUP_ENTRY_KEY) : undefined), [active, store]);
}
