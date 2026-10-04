import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useTentacleConfig } from "@tentacle-tv/api-client";
import { NAV_PREFIX, RAIL_HINT_SHOWN_KEY, isNavKey, railHintDelay, railHintShownAfter, readRailHintShown } from "@tentacle-tv/tv-core";
import type { FocusStore } from "../../platform/tvos/focus/focusStore";

/**
 * QUAND dire « Maintenir OK : organiser » — la règle est dans tv-core
 * (`nav/railHint` : sur une entrée organisable, après un temps de focus sur
 * elle, les premières fois seulement) ; ici, son application : le focus du
 * rail suivi, la minuterie, et le compte des passages rangé sur l'appareil
 * (une fois par passage dans le rail). Rend l'entrée à côté de laquelle
 * l'indication paraît et son libellé, ou null.
 */
export function useRailOrganizeHint(
  focus: FocusStore,
  state: { railFocused: boolean; moving: boolean; menuOpen: boolean },
): { entryKey: string; label: string } | null {
  const { t } = useTranslation("nav");
  const { storage } = useTentacleConfig();
  const { railFocused, moving, menuOpen } = state;
  const [entryKey, setEntryKey] = useState<string | null>(null);
  // Le passage dans le rail a-t-il déjà compté ?
  const counted = useRef(false);

  useEffect(() => {
    if (!railFocused) counted.current = false;
  }, [railFocused]);

  useEffect(() => {
    setEntryKey(null);
    let timer: ReturnType<typeof setTimeout> | null = null;
    // La clé focalisée suivie : le flou d'une AUTRE (arrivé après le focus de la suivante) ne l'annule pas.
    let current: string | null = null;
    const schedule = (key: string | null) => {
      current = key;
      if (timer) clearTimeout(timer);
      timer = null;
      setEntryKey(null);
      const entry = key && isNavKey(key) ? key.slice(NAV_PREFIX.length) : null;
      const delay = railHintDelay({ entryKey: entry, moving, menuOpen, shown: readRailHintShown(storage.getItem(RAIL_HINT_SHOWN_KEY)) });
      if (delay === null || entry === null) return;
      timer = setTimeout(() => {
        timer = null;
        const shown = readRailHintShown(storage.getItem(RAIL_HINT_SHOWN_KEY));
        storage.setItem(RAIL_HINT_SHOWN_KEY, String(railHintShownAfter(shown, counted.current)));
        counted.current = true;
        setEntryKey(entry);
      }, delay);
    };
    const unsubscribe = focus.subscribe((key, focused) => {
      if (focused) schedule(key);
      else if (key === current) schedule(null);
    });
    return () => {
      unsubscribe();
      if (timer) clearTimeout(timer);
    };
  }, [focus, storage, moving, menuOpen]);

  const label = t("railHintOrganize");
  const shown = railFocused ? entryKey : null;
  return useMemo(() => (shown ? { entryKey: shown, label } : null), [shown, label]);
}
