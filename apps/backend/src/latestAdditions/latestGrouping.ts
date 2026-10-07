import type { LatestAdditions } from "./latestAdditionsTypes";

/**
 * La règle des « Derniers ajouts » : une série n'y occupe qu'UNE carte.
 *
 * Les ajouts arrivent du plus récent au plus ancien. Le premier ajout d'une
 * série — épisode, saison ou la série elle-même — ouvre SA carte, à sa place ;
 * les suivants s'y rangent, quel que soit ce qui les sépare. Une carte qui ne
 * rassemble qu'un épisode reste cet épisode : il n'y a rien à regrouper, et sa
 * légende (« S02E05 · Titre ») en dit plus qu'un compte. Les films, et tout ce
 * qui n'appartient à aucune série, gardent leur carte et leur place.
 *
 * Un DOSSIER (la série, une saison) n'est une nouveauté que s'il est arrivé
 * avec le dernier ajout du groupe — dans les 24 h qui le précèdent, ce que
 * Jellyfin 12.1 appelle « ajoutés ensemble ». Sur une bibliothèque calme, la
 * rangée remonte des mois en arrière : le dossier d'une série installée de
 * longue date y tombe, et ne doit lui faire dire ni « Nouvelle série », ni
 * transformer en carte de série un épisode qui arrive seul.
 *
 * La rangée s'arrête au premier ajout qui ouvrirait une carte de trop : ce qui
 * est plus ancien n'est plus « dans la rangée », et ne compte pas parmi les
 * nouveautés d'une série. Une série regroupée laisse donc de la place aux
 * suivantes — la rangée garde sa longueur, complétée par les ajouts d'après,
 * regroupés de la même façon.
 *
 * Un dossier VIDE — une série ou une saison arrivée sans AUCUN épisode réel
 * (les épisodes « manquants », annoncés sans fichier, ne sont pas dans
 * l'inventaire) — n'ouvre pas de carte : il n'y a rien à regarder. Sauf si le
 * compte a coché dans Jellyfin « Afficher les épisodes manquants dans les
 * saisons » (`keepEmptyFolders`) : Jellyfin montre alors ces séries partout,
 * la rangée aussi. Un groupe resté sans épisode ne compte pas parmi les
 * cartes : la rangée garde sa longueur avec les ajouts suivants.
 *
 * Pourquoi pas le `GroupItems` de Jellyfin (`/Items/Latest`) : il change de
 * règle à chaque version — 10.10 regroupe dans une fenêtre fixe (une saison
 * entière y réduit la rangée à quelques cartes), 10.11 regroupe par NOM de
 * série, 12.1 rend des SAISONS et ne regroupe que dans les 24 h du dernier
 * ajout. Ici, la même règle pour tous les serveurs.
 *
 * Ce fichier n'importe que le contrat et se teste seul.
 */

/** Ce que l'inventaire (la requête légère) dit d'un ajout. */
export interface ScannedAddition {
  Id?: string;
  Type?: string;
  SeriesId?: string | null;
  SeasonId?: string | null;
  /** Le numéro d'une saison, celui d'un épisode dans la sienne. */
  IndexNumber?: number | null;
  /** Le numéro de la saison d'un épisode. */
  ParentIndexNumber?: number | null;
  DateCreated?: string | null;
}

export type LatestCard =
  | { kind: "item"; id: string }
  | { kind: "series"; seriesId: string; additions: LatestAdditions };

/** La série d'un ajout : la sienne pour un épisode ou une saison, elle-même pour une série. */
function seriesOf(addition: ScannedAddition): string | null {
  if (addition.Type === "Series") return addition.Id ?? null;
  if (addition.Type === "Episode" || addition.Type === "Season") return addition.SeriesId || null;
  return null;
}

type Slot = { kind: "item"; id: string } | { kind: "series"; seriesId: string; members: ScannedAddition[] };

/** Un groupe de série sans aucun épisode réel : seulement des dossiers (série, saisons). */
const isEmptyFolder = (slot: Slot): boolean => slot.kind === "series" && !slot.members.some((m) => m.Type === "Episode");

export interface LatestPlanOptions {
  /** Le compte affiche les épisodes manquants (Jellyfin) : les dossiers vides gardent leur carte. */
  keepEmptyFolders?: boolean;
}

/**
 * Les cartes de la rangée, `cards` au plus, dans l'ordre de leur ajout le plus
 * récent. `scanned` doit être trié du plus récent au plus ancien.
 */
export function planLatestCards(scanned: readonly ScannedAddition[], cards: number, options: LatestPlanOptions = {}): LatestCard[] {
  const keepEmpty = options.keepEmptyFolders === true;
  const slots: Slot[] = [];
  const bySeries = new Map<string, Slot & { kind: "series" }>();
  // Un dossier vide peut encore recevoir ses épisodes plus loin dans l'inventaire
  // (Jellyfin date un dossier APRÈS ses fichiers, mais pas toujours) : il ne
  // compte pour la longueur de la rangée qu'une fois rempli, et, la rangée
  // pleine, il est le seul à recueillir encore des ajouts plus anciens.
  const counted = () => (keepEmpty ? slots.length : slots.filter((slot) => !isEmptyFolder(slot)).length);
  let full = false;
  for (const addition of scanned) {
    if (!addition.Id) continue;
    const seriesId = seriesOf(addition);
    const open = seriesId ? bySeries.get(seriesId) : undefined;
    if (open) {
      if (!full || isEmptyFolder(open)) open.members.push(addition);
      continue;
    }
    if (full || counted() >= cards) {
      full = true;
      if (keepEmpty) break;
      continue;
    }
    if (seriesId) {
      const slot = { kind: "series" as const, seriesId, members: [addition] };
      bySeries.set(seriesId, slot);
      slots.push(slot);
    } else {
      slots.push({ kind: "item", id: addition.Id });
    }
  }
  const shown = keepEmpty ? slots : slots.filter((slot) => !isEmptyFolder(slot));
  return shown.slice(0, cards).map(toCard);
}

/** « Ajoutés ensemble » : la fenêtre d'un dossier nouveau, avant le dernier ajout du groupe. */
export const FRESH_FOLDER_WINDOW_MS = 24 * 60 * 60 * 1000;

const isFolder = (m: ScannedAddition): boolean => m.Type === "Series" || m.Type === "Season";

/** Les dossiers arrivés avec le dernier ajout du groupe — `members` du plus récent au plus ancien. */
function freshFolders(members: readonly ScannedAddition[]): ScannedAddition[] {
  const latest = Date.parse(members[0]?.DateCreated ?? "");
  if (!Number.isFinite(latest)) return [];
  return members.filter((m) => isFolder(m) && latest - Date.parse(m.DateCreated ?? "") <= FRESH_FOLDER_WINDOW_MS);
}

function toCard(slot: Slot): LatestCard {
  if (slot.kind === "item") return slot;
  const episodes = slot.members.filter((m) => m.Type === "Episode");
  const fresh = freshFolders(slot.members);
  if (episodes.length === 1 && fresh.length === 0) return { kind: "item", id: episodes[0].Id as string };
  return { kind: "series", seriesId: slot.seriesId, additions: describe(slot.members, episodes, fresh) };
}

const ascending = (numbers: Iterable<number>): number[] => [...new Set(numbers)].sort((a, b) => a - b);

const isNumber = (value: number | null | undefined): value is number => typeof value === "number" && Number.isFinite(value);

/**
 * Ce que le groupe apporte de neuf — `members` du plus récent au plus ancien,
 * `episodes` les siens, `fresh` ses dossiers arrivés avec le dernier ajout.
 */
function describe(
  members: readonly ScannedAddition[],
  episodes: readonly ScannedAddition[],
  fresh: readonly ScannedAddition[],
): LatestAdditions {
  const seasons = members.filter((m) => m.Type === "Season");
  // L'ajout le plus récent qui SITUE une saison : un épisode (la sienne) ou une saison.
  const anchor = members.find((m) => m.Type === "Episode" || m.Type === "Season");
  const anchorSeasonId = anchor?.Type === "Season" ? anchor.Id : anchor?.SeasonId;
  const anchorSeasonNumber = anchor?.Type === "Season" ? anchor.IndexNumber : anchor?.ParentIndexNumber;
  return {
    EpisodeCount: episodes.length,
    SeasonNumbers: ascending([
      ...episodes.map((e) => e.ParentIndexNumber).filter(isNumber),
      ...seasons.map((s) => s.IndexNumber).filter(isNumber),
    ]),
    // Les spéciaux n'ouvrent pas une « nouvelle saison » : leur dossier naît au premier bonus.
    NewSeasonNumbers: ascending(
      fresh.filter((m) => m.Type === "Season").map((s) => s.IndexNumber).filter(isNumber).filter((n) => n > 0),
    ),
    NewSeries: fresh.some((m) => m.Type === "Series"),
    LatestDate: members[0]?.DateCreated ?? null,
    LatestSeasonId: anchorSeasonId ?? null,
    LatestSeasonNumber: isNumber(anchorSeasonNumber) ? anchorSeasonNumber : null,
  };
}

/** Les identifiants à demander pour rendre les cartes : séries regroupées et ajouts gardés. */
export function latestCardIds(plan: readonly LatestCard[]): string[] {
  return plan.map((card) => (card.kind === "series" ? card.seriesId : card.id));
}
