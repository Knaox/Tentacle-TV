import { useEffect, useState } from "react";
import { CHOICE_ENTRY_RELEASE_MS, createChoiceEntry } from "@tentacle-tv/tv-core";
import { setFocusLocked } from "../focus/focusLocks";
import type { FocusStore } from "../focus/focusStore";
import { useChoiceEntryClaim } from "./choiceEntryClaim";

/**
 * Applique le verrou d'entrée d'une liste en `Modal` (tv-core
 * `panels/choiceEntry`) : la machine dit quelles clés verrouiller et libérer,
 * et quand ; ce crochet le pose sur tvOS — `isTVSelectable` par le port du
 * focus, AVANT que la liste ne se rende (`setFocusLocked`), et sur les nœuds
 * déjà montés.
 *
 * Rend un compteur qui change à chaque libération : la liste se redessine pour
 * relire ses liaisons. Commun aux listes en Modal (grand panneau, feuille des
 * saisons, listes de choix des réglages, listes de filtres).
 */
export function useChoiceEntry(focus: FocusStore, keys: readonly string[], entryKey: string | null): number {
  const [releases, setReleases] = useState(0);
  const [entry] = useState(createChoiceEntry);
  // Pendant le RENDU : la liste ne doit pas se rendre avec ses anciens verrous.
  const locks = entry.enter(keys, entryKey);
  if (locks) {
    for (const key of locks.unlock) setFocusLocked(focus, key, false);
    for (const key of locks.lock) setFocusLocked(focus, key, true);
  }
  // Android : la Modal ne focalise rien d'elle-même — l'entrée est réclamée.
  useChoiceEntryClaim(focus, entryKey);
  useEffect(() => {
    if (!entryKey) return undefined;
    const free = (freed: readonly string[] | null) => {
      if (!freed) return;
      for (const key of freed) setFocusLocked(focus, key, false);
      setReleases((count) => count + 1);
    };
    const unsubscribe = focus.subscribe((key, focused) => {
      if (focused) free(entry.focused(key));
    });
    const timer = setTimeout(() => free(entry.timedOut()), CHOICE_ENTRY_RELEASE_MS);
    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, [focus, entryKey, entry]);
  return releases;
}
