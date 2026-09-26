import { useSyncExternalStore } from "react";
import { getI18n, useTranslation as useTranslationOriginal } from "react-i18next?original";
import type { i18n as I18n } from "i18next";

export * from "react-i18next?original";

/**
 * `useTranslation`, partagé au lieu d'être refait à chaque montage.
 *
 * Le hook de react-i18next 16 recopie, à CHAQUE composant monté, tous les
 * descripteurs de l'instance i18next pour en faire un habillage, lui fabrique
 * une fonction `t` et l'abonne aux évènements de l'instance. Une grille de
 * bibliothèque monte une rangée de cartes à chaque pas, et chaque carte appelle
 * le hook plusieurs fois : mesuré sur la C3, ~15 ms par appui entre le hook et
 * les traductions qu'il recalcule.
 *
 * Ici la fonction `t` — celle d'i18next, `getFixedT` — et l'habillage sont
 * fabriqués UNE fois par langue et par espace de noms, et partagés ; les
 * traductions sans option (la plupart) sont mémorisées. Un changement de
 * langue invalide tout et rend tous les abonnés, comme le hook d'origine
 * (`languageChanged`). Toutes les ressources sont embarquées à
 * l'initialisation (`initI18n`) : il n'y a rien à attendre, `ready` suit
 * l'initialisation.
 *
 * Les options du hook d'origine qui changent le résultat — langue imposée,
 * préfixe de clé, autre instance — entrent dans la clé de partage.
 */

type Result = ReturnType<typeof useTranslationOriginal>;
type Namespaces = Parameters<typeof useTranslationOriginal>[0];

let version = 0;
const bound = new Set<I18n>();
const listeners = new Set<() => void>();
const results = new Map<string, Result>();
const wrappers = new Map<string, I18n>();

function bump(): void {
  version += 1;
  results.clear();
  listeners.forEach((listener) => listener());
}

function bind(i18n: I18n): void {
  if (bound.has(i18n)) return;
  bound.add(i18n);
  i18n.on("languageChanged", bump);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const snapshot = (): number => version;

/**
 * L'habillage que le hook d'origine rend à la place de l'instance : une copie
 * de ses propriétés, dont l'identité change avec la langue — ce qui fait
 * recalculer ce qui en dépend. Une par langue, partagée.
 */
function wrapperFor(i18n: I18n): I18n {
  const language = i18n.language;
  let wrapper = wrappers.get(language);
  if (!wrapper) {
    const descriptors = Object.getOwnPropertyDescriptors(i18n);
    wrapper = Object.create(Object.getPrototypeOf(i18n), descriptors) as I18n;
    Object.defineProperty(wrapper, "__original", { value: i18n });
    wrappers.set(language, wrapper);
  }
  return wrapper;
}

function build(i18n: I18n, language: string, namespace: string, keyPrefix?: string): Result {
  const fixed = i18n.getFixedT(language, namespace, keyPrefix);
  const memo = new Map<string, unknown>();
  const call = fixed as unknown as (...args: unknown[]) => unknown;
  const t = (key: unknown, options?: unknown, ...rest: unknown[]): unknown => {
    if (typeof key !== "string" || options !== undefined || rest.length > 0) {
      return call(key, options, ...rest);
    }
    if (memo.has(key)) return memo.get(key);
    const value = call(key);
    memo.set(key, value);
    return value;
  };
  // Ce que porte la fonction d'origine (`lng`, `ns`, `keyPrefix`…), et que
  // certains appelants relisent — propriétés posées à l'exécution, hors du type.
  Object.assign(t, fixed as unknown as Record<string, unknown>);
  const ready = !!(i18n.isInitialized || (i18n as { initializedStoreOnce?: boolean }).initializedStoreOnce);
  const i18nWrapper = wrapperFor(i18n);
  return Object.assign([t, i18nWrapper, ready], { t, i18n: i18nWrapper, ready }) as unknown as Result;
}

export const useTranslation = ((ns?: Namespaces, options?: Parameters<typeof useTranslationOriginal>[1]) => {
  const i18n = (options?.i18n ?? getI18n()) as I18n;
  bind(i18n);
  const current = useSyncExternalStore(subscribe, snapshot, snapshot);
  const list = typeof ns === "string" ? [ns] : ns ? [...ns] : [];
  const namespace = String(list[0] ?? i18n.options.defaultNS ?? "translation");
  const language = options?.lng ?? i18n.language;
  const keyPrefix = options?.keyPrefix;
  const key = `${current}|${language}|${namespace}|${keyPrefix ?? ""}`;
  let result = results.get(key);
  if (!result) {
    result = build(i18n, language, namespace, keyPrefix);
    results.set(key, result);
  }
  return result;
}) as typeof useTranslationOriginal;
