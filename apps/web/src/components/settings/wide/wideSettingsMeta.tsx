import { createContext, useCallback, useContext } from "react";
import { useTranslation } from "react-i18next";
import {
  WIDE_SETTINGS_BY_ID, isWideSettingVisible, type SettingsI18nRef, type WideSettingId, type WideSettingsContext,
} from "@tentacle-tv/shared";

/**
 * Ce que le web large lit du catalogue partagé, pour UNE ligne : son libellé,
 * la phrase qui dit ce qu'elle fait, sa portée, et son ancre. La coquille
 * (`SettingsLayout`) calcule le contexte une fois et le pose ici ; les pages
 * le lisent sans le recalculer.
 */
export const WideSettingsCtx = createContext<WideSettingsContext | null>(null);

export function useWideSettings(): WideSettingsContext | null {
  return useContext(WideSettingsCtx);
}

/** Une ligne existe-t-elle ici ? Hors coquille (un test, une page montée seule) : oui. */
export function useWideSettingVisible(id: WideSettingId): boolean {
  const ctx = useWideSettings();
  return ctx === null || isWideSettingVisible(WIDE_SETTINGS_BY_ID[id], ctx);
}

/** Le texte d'une référence du catalogue, dans la langue de l'interface. */
export function useCatalogText(): (ref: SettingsI18nRef) => string {
  const { t } = useTranslation(["settingsWeb"]);
  return useCallback((ref: SettingsI18nRef) => t(`${ref.ns}:${ref.key}`), [t]);
}

export function useWideSettingMeta(id: WideSettingId) {
  const text = useCatalogText();
  const entry = WIDE_SETTINGS_BY_ID[id];
  return { label: text(entry.label), description: text(entry.description), scope: entry.scope };
}

/** L'ancre DOM d'une ligne : `#<id>` dans l'adresse y mène (`useSettingHashScroll`). */
export const settingDomId = (id: string) => `setting-${id}`;

/** Les attributs d'ancre d'un bloc qui porte un réglage sans passer par `SettingItem`. */
export function settingAnchor(id: WideSettingId): { id: string; "data-setting": WideSettingId } {
  return { id: settingDomId(id), "data-setting": id };
}

/**
 * L'ancre que l'adresse vise (`#<id>`, sans le dièse), posée par la coquille
 * qui lit le routeur : une ligne n'a pas à dépendre du routeur pour le savoir.
 */
export const SettingTargetCtx = createContext<string | null>(null);

/** L'adresse vise-t-elle cette ligne (arrivée depuis la recherche ou un lien) ? */
export function useSettingTargeted(id: WideSettingId): boolean {
  return useContext(SettingTargetCtx) === id;
}
