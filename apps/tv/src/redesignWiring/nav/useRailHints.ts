import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { railHintEntry, railOrganizeHintEntry, railSettingsHintShown } from "@tentacle-tv/tv-core";
import type { FocusStore } from "../../platform/tvos/focus/focusStore";

export interface RailHints {
  /** « Maintenir OK : organiser », à côté de cette entrée. */
  organize: { entryKey: string; label: string } | null;
  /** « ◀ Réglages », à hauteur du profil. */
  settings: { label: string } | null;
}

/**
 * QUAND dire les astuces du rail — la règle est dans tv-core (`nav/railHint` :
 * « organiser » à côté de l'entrée organisable focalisée, « ◀ Réglages » ailleurs
 * que sur le profil ; tout de suite, à chaque fois). Ici, son application :
 * l'entrée du rail qui a le focus, suivie. Hors du rail, elle reste `null` :
 * un focus qui parcourt le contenu ne redessine rien (même valeur, aucun
 * rendu).
 */
export function useRailHints(focus: FocusStore, state: { railFocused: boolean; moving: boolean; menuOpen: boolean }): RailHints {
  const { t } = useTranslation("nav");
  const { railFocused, moving, menuOpen } = state;
  const [entryKey, setEntryKey] = useState<string | null>(() => railHintEntry(focus.focusedKey()));

  useEffect(
    () =>
      focus.subscribe((key, focused) => {
        if (focused) setEntryKey(railHintEntry(key));
      }),
    [focus],
  );

  const organizeEntry = railOrganizeHintEntry({ entryKey, moving, menuOpen });
  const settingsShown = railSettingsHintShown({ entryKey, moving, menuOpen, railFocused });
  const organizeLabel = t("railHintOrganize");
  const settingsLabel = t("railProfile");
  const organize = useMemo(
    () => (organizeEntry && railFocused ? { entryKey: organizeEntry, label: organizeLabel } : null),
    [organizeEntry, railFocused, organizeLabel],
  );
  const settings = useMemo(() => (settingsShown ? { label: settingsLabel } : null), [settingsShown, settingsLabel]);
  return useMemo(() => ({ organize, settings }), [organize, settings]);
}
