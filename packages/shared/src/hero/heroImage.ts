import type { MediaItem } from "../types/media";

/** Une image que la bannière d'accueil peut demander : l'item qui la porte, son type. */
export type HeroImageType = "Backdrop" | "Primary" | "Thumb" | "Banner" | "Art" | "Screenshot" | "Box";

export interface HeroImageRef {
  id: string;
  type: HeroImageType;
  /** Le rang de l'image dans son type (fonds multiples) ; absent : la première. */
  index?: number;
  /** Le tag annoncé, quand la réponse le porte. */
  tag?: string;
}

const firstTag = (tags: string[] | undefined): string | undefined => (tags && tags.length > 0 ? tags[0] : undefined);

/**
 * Les images d'un titre que la bannière peut montrer, dans l'ordre où elle
 * les essaie — la suivante prend le relais quand la précédente échoue (404).
 *
 * Seulement ce que la donnée ANNONCE : jamais une image demandée à l'aveugle
 * (un 404 garanti, et une bannière noire derrière). L'ordre :
 *
 * 1. le visuel LARGE — pour un épisode, celui de sa série d'abord (il n'en
 *    a presque jamais en propre) ; sinon le sien, puis celui de son parent ;
 * 2. la vignette 16:9 (`Thumb`) ;
 * 3. l'affiche (`Primary`) — celle d'un épisode est une image 16:9, puis
 *    celle de sa série.
 *
 * Une liste vide : le titre n'a RIEN à montrer, la bannière ne le choisit pas.
 */
export function heroImageCandidates(item: MediaItem): HeroImageRef[] {
  const out: HeroImageRef[] = [];
  const ownBackdrop = firstTag(item.BackdropImageTags);
  const parentBackdrop = firstTag(item.ParentBackdropImageTags);
  const parentBackdropId = item.ParentBackdropItemId ?? (item.Type === "Episode" ? item.SeriesId : undefined);
  const parent = parentBackdrop && parentBackdropId ? { id: parentBackdropId, type: "Backdrop" as const, tag: parentBackdrop } : null;
  const own = ownBackdrop ? { id: item.Id, type: "Backdrop" as const, tag: ownBackdrop } : null;

  if (item.Type === "Episode") {
    if (parent) out.push(parent);
    if (own) out.push(own);
  } else {
    if (own) out.push(own);
    if (parent && parent.id !== item.Id) out.push(parent);
  }
  const thumb = item.ImageTags?.Thumb;
  if (thumb) out.push({ id: item.Id, type: "Thumb", tag: thumb });
  const primary = item.ImageTags?.Primary;
  if (primary) out.push({ id: item.Id, type: "Primary", tag: primary });
  if (item.Type === "Episode" && item.SeriesId && item.SeriesPrimaryImageTag) {
    out.push({ id: item.SeriesId, type: "Primary", tag: item.SeriesPrimaryImageTag });
  }
  return out;
}

/** Le titre a-t-il au moins une image à montrer dans la bannière ? */
export function hasHeroImage(item: MediaItem): boolean {
  return heroImageCandidates(item).length > 0;
}

/** La clé d'une image essayée — ce qu'on retient d'un échec. */
export function heroImageKey(ref: Pick<HeroImageRef, "id" | "type" | "index">): string {
  return ref.index ? `${ref.id}/${ref.type}/${ref.index}` : `${ref.id}/${ref.type}`;
}

/**
 * La première image du titre qui n'a pas déjà échoué (`failed` : les clés de
 * `heroImageKey`), ou `null` — toutes ont échoué, ou il n'en a aucune.
 */
export function heroImageFor(item: MediaItem, failed: ReadonlySet<string>): HeroImageRef | null {
  return heroImageCandidates(item).find((ref) => !failed.has(heroImageKey(ref))) ?? null;
}
