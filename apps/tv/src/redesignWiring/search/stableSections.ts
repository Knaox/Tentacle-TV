import { stabilizeList, type StableList } from "@tentacle-tv/tv-core";
import type { CardModel } from "../../redesign/cards/cardTypes";
import type { SearchSectionModel, SearchTopModel } from "../../redesign/screens/search/searchViewModel";
import { sameCard } from "../cards/sameCard";

/**
 * Les rangées d'une frappe, en reprenant tout ce qui n'a pas changé depuis la
 * précédente (tv-core `stabilizeList`) : la carte d'un titre déjà montré
 * garde son OBJET (`sameCard`), une rangée dont aucune carte n'a bougé garde
 * son TABLEAU, le meilleur résultat inchangé garde son modèle. Les rangées et
 * les cartes sont mémoïsées : sans cela, chaque réponse (des objets neufs)
 * redessinait toutes les cartes de la colonne. Rien de visible ne change :
 * seule l'identité des modèles.
 */

export interface StableSectionsMemory {
  /** Les cartes de chaque rangée, par clé de rangée. */
  cards: Map<string, StableList<CardModel>>;
  /** Les rangées déjà montrées, par clé. */
  sections: Map<string, SearchSectionModel>;
}

export function createStableSectionsMemory(): StableSectionsMemory {
  return { cards: new Map(), sections: new Map() };
}

const cardKey = (card: CardModel) => card.id;

/** Deux listes de petits modèles plats (personnes, pastilles) de mêmes valeurs. */
function sameRecords<T extends object>(a: readonly T[], b: readonly T[]): boolean {
  return a.length === b.length && a.every((value, i) => {
    const other = b[i] as Record<string, unknown>;
    const entries = Object.entries(value);
    return entries.length === Object.keys(other).length && entries.every(([key, field]) => other[key] === field);
  });
}

function sameTop(a: SearchTopModel, b: SearchTopModel): boolean {
  if (a.kind === "person" && b.kind === "person") {
    return a.id === b.id && a.name === b.name && a.imageUri === b.imageUri && a.detail === b.detail && a.action === b.action && a.palette === b.palette;
  }
  if (a.kind !== "title" || b.kind !== "title") return false;
  return (
    a.id === b.id &&
    a.title === b.title &&
    a.logoUri === b.logoUri &&
    a.backdropUri === b.backdropUri &&
    a.reason === b.reason &&
    a.progress === b.progress &&
    a.palette === b.palette &&
    a.meta.length === b.meta.length &&
    a.meta.every((item, i) => JSON.stringify(item) === JSON.stringify(b.meta[i]))
  );
}

/** Une rangée sans cartes (meilleur résultat, personnes, pastilles) inchangée. */
function sameSection(old: SearchSectionModel | undefined, section: SearchSectionModel): boolean {
  if (old?.key === "top" && section.key === "top") return old.label === section.label && sameTop(old.top, section.top);
  if (old?.key === "people" && section.key === "people") return old.title === section.title && sameRecords(old.people, section.people);
  if (old?.key === "facets" && section.key === "facets") return old.title === section.title && sameRecords(old.facets, section.facets);
  return false;
}

/** Rend `next` où chaque modèle inchangé est remplacé par son précédent ; met la mémoire à jour. */
export function stabilizeSections(memory: StableSectionsMemory, next: readonly SearchSectionModel[]): SearchSectionModel[] {
  const cards = new Map<string, StableList<CardModel>>();
  const sections = new Map<string, SearchSectionModel>();
  const out = next.map((section): SearchSectionModel => {
    const old = memory.sections.get(section.key);
    let kept = section;
    if ("cards" in section) {
      const list = stabilizeList(memory.cards.get(section.key), section.cards, cardKey, sameCard);
      cards.set(section.key, list);
      const same = old !== undefined && "cards" in old && old.cards === list.items && old.title === section.title && old.count === section.count;
      kept = same ? old : { ...section, cards: list.items as CardModel[] };
    } else if (old !== undefined && sameSection(old, section)) {
      kept = old;
    }
    sections.set(section.key, kept);
    return kept;
  });
  memory.cards = cards;
  memory.sections = sections;
  return out;
}
