import { isRecoWhy, type RecoPageRow, type RecoRowItem, type RecoWhy } from "@tentacle-tv/shared";
import { reasonToText, type ReasonTranslate } from "./recoReasonText";
import { recoRowTitle } from "./recoRowTitles";
import { localeText } from "./frenchElision";

/**
 * Les raisons STRUCTURÉES du contrat (`why`, shared reco/recoPageTypes) mises
 * en mots — le serveur ne donne que des faits, le client parle (espace i18n
 * `reco`, clés `why*`, vouvoiement). Absentes (serveur d'avant, moteur qui ne
 * s'engage pas), on retombe sur les raisons historiques (`reasons`) ; rien ne
 * se dit plutôt qu'une phrase creuse.
 */

export interface RecoWhyTextOptions {
  /** Langue des noms de pays et de langues (`Intl.DisplayNames`), ex. « fr ». */
  locale?: string;
  /** Le titre d'une RANGÉE (formes collectives : « Réalisés par… »). */
  row?: boolean;
}

/** « A », « A et B », « A, B et C » — trois titres au plus. */
function listText(items: readonly string[], t: ReasonTranslate): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return t("whyList2", { a: items[0], b: items[1] });
  return t("whyList3", { a: items[0], b: items[1], c: items[2] });
}

function displayName(code: string, type: "region" | "language", locale?: string): string {
  try {
    const names = new Intl.DisplayNames(locale ? [locale] : undefined, { type });
    return names.of(type === "region" ? code.toUpperCase() : code.toLowerCase()) ?? code;
  } catch {
    // Moteur sans Intl.DisplayNames (vieux navigateurs de téléviseur) : le code.
    return code.toUpperCase();
  }
}

/** Une raison → une phrase (ou le titre d'une rangée), `null` quand elle ne dit rien.
 *  En français, l'élision suit le titre cité (« d'Iron Man », « du Prestige »). */
export function recoWhyText(why: RecoWhy, t: ReasonTranslate, options: RecoWhyTextOptions = {}): string | null {
  const text = whySentence(why, t, options);
  return text === null ? null : localeText(text, options.locale);
}

function whySentence(why: RecoWhy, t: ReasonTranslate, options: RecoWhyTextOptions): string | null {
  const row = options.row === true;
  const via = "via" in why && why.via?.title ? why.via.title : null;
  const withVia = (text: string) => (via ? t("whyWithVia", { text, via }) : text);
  switch (why.kind) {
    case "similarTo": {
      const titles = why.titles.map((ref) => ref.title).filter(Boolean).slice(0, 3);
      if (titles.length === 0) return null;
      const key = why.signal === "loved" ? "whySimilarLoved" : why.signal === "watched" ? "whySimilarWatched" : "whySimilar";
      return t(key, { titles: listText(titles, t) });
    }
    case "person": {
      const name = why.person.name;
      if (!name) return null;
      // « Du réalisateur de Prisoners » : le titre aimé dit mieux qu'un nom.
      if (via && why.role !== "actor") return t(`whyPersonVia_${why.role}`, { via, name });
      return t(`${row ? "whyRowPerson" : "whyPerson"}_${why.role}`, { name });
    }
    case "theme": {
      const label = why.theme.tag ? t(`whyThemeTag_${why.theme.tag}`) : why.theme.label;
      if (!label) return null;
      return why.theme.tag ? withVia(label) : withVia(t("whyTheme", { name: label }));
    }
    case "company": {
      if (!why.company.name) return null;
      const key = why.company.kind === "network" ? "whyNetwork" : "whyStudio";
      return withVia(t(row ? `${key}Row` : key, { name: why.company.name }));
    }
    case "collection":
      return why.collection.name ? t("whyCollection", { name: why.collection.name }) : null;
    case "origin": {
      const text = why.country
        ? t(row ? "whyOriginCountryRow" : "whyOriginCountry", { country: displayName(why.country, "region", options.locale) })
        : t("whyOriginLanguage", { language: displayName(why.language, "language", options.locale) });
      return withVia(text);
    }
    case "genre": {
      const name = t(`genreLabel_${why.genre.id}`, { defaultValue: why.genre.name });
      if (!name) return null;
      return row ? name : t("reasonGenre", { name });
    }
    case "hiddenGem":
      return row ? t("whyRowHiddenGem") : t("whyHiddenGem", { rating: why.rating.toFixed(1) });
    case "acclaimed":
      return row ? t("whyRowAcclaimed") : t("whyAcclaimed", { rating: why.rating.toFixed(1) });
    case "recent":
      return row ? t("whyRowRecent") : t("whyRecent", { year: why.year });
    case "kindredViewers":
      return t(row ? "whyRowKindred" : "whyKindred");
    case "exploration":
      return t(row ? "rowExploration" : "whyExploration");
    default:
      return null;
  }
}

/** Deux raisons disent-elles la même chose (même graine, même personne, même thème…) ? */
export function sameRecoWhy(a: RecoWhy, b: RecoWhy): boolean {
  if (a.kind !== b.kind) return false;
  switch (a.kind) {
    case "similarTo":
      return a.titles[0]?.key === (b as typeof a).titles[0]?.key;
    case "person":
      return a.person.id === (b as typeof a).person.id;
    case "theme":
      return a.theme.key === (b as typeof a).theme.key;
    case "company":
      return a.company.id === (b as typeof a).company.id;
    case "collection":
      return a.collection.id === (b as typeof a).collection.id;
    case "origin":
      return a.language === (b as typeof a).language && a.country === (b as typeof a).country;
    case "genre":
      return a.genre.id === (b as typeof a).genre.id;
    default:
      return true;
  }
}

/** Les raisons structurées connues d'un titre (un `kind` inconnu est ignoré). */
export function recoWhysOf(item: Pick<RecoRowItem, "why">): RecoWhy[] {
  return Array.isArray(item.why) ? item.why.filter(isRecoWhy) : [];
}

/**
 * LA raison d'un titre, en une phrase : la première raison structurée qui se
 * dit, sinon la première raison historique. Dans une rangée, celle qui
 * répète son titre est sautée (« Parce que vous avez aimé {titre} » sous une
 * rangée qui le dit déjà) — la suivante dit quelque chose de plus.
 */
export function recoItemReasonText(
  item: Pick<RecoRowItem, "why" | "reasons">,
  t: ReasonTranslate,
  options: { locale?: string; row?: Pick<RecoPageRow, "why" | "seedTitle"> } = {},
): string | null {
  const rowWhy = options.row?.why && isRecoWhy(options.row.why) ? options.row.why : null;
  for (const why of recoWhysOf(item)) {
    if (rowWhy && sameRecoWhy(why, rowWhy)) continue;
    const text = recoWhyText(why, t, { locale: options.locale });
    if (text) return text;
  }
  const seed = options.row?.seedTitle;
  for (const reason of item.reasons ?? []) {
    if (seed && reason.kind === "seed" && reason.seedTitle === seed) continue;
    const text = reasonToText(reason, t);
    if (text) return localeText(text, options.locale);
  }
  return null;
}

/** Le titre d'une rangée : son thème (`why`) d'abord, sinon la table des clés. */
export function recoRowTitleText(
  row: Pick<RecoPageRow, "key" | "seedTitle" | "why">,
  t: ReasonTranslate,
  options: { locale?: string } = {},
): string {
  if (row.why && isRecoWhy(row.why)) {
    const text = recoWhyText(row.why, t, { locale: options.locale, row: true });
    if (text) return text;
  }
  const { key, params } = recoRowTitle(row);
  return localeText(t(key, params), options.locale);
}

/** La correspondance d'un titre (entier 0..100), `null` quand le moteur ne s'engage pas. */
export function recoMatchOf(item: Pick<RecoRowItem, "match">): number | null {
  const match = item.match;
  if (typeof match !== "number" || !Number.isFinite(match) || match < 0 || match > 100) return null;
  return Math.round(match);
}
