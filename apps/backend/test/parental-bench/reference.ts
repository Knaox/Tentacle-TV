/**
 * La RÉFÉRENCE : ce que Jellyfin montre à un compte, lu par SON jeton (jamais la
 * clé d'API, qui voit tout). Tout titre de la bibliothèque que Tentacle rend à ce
 * compte doit en faire partie ; ce que l'administrateur voit en plus est INTERDIT
 * au compte, par son id, son nom ou son identifiant TMDB.
 */

import type { BenchAccount, JellyfinBench } from "./jellyfinBench";

export interface RefItem {
  id: string;
  name: string;
  type: string;
  tmdbKey: string | null;
}

export interface Reference {
  account: BenchAccount;
  /** Tout ce que l'administrateur voit (le catalogue complet du banc). */
  all: RefItem[];
  /** Ids (minuscules, sans tirets) que Jellyfin montre au compte, bibliothèques comprises. */
  visible: Set<string>;
  /** Ce que l'administrateur voit et pas le compte. */
  forbidden: RefItem[];
  /** `movie:550` / `tv:1396` des films et séries interdits. */
  forbiddenTmdb: Set<string>;
  /** `movie:…` / `tv:…` des films et séries permis. */
  visibleTmdb: Set<string>;
}

export const norm = (id: string): string => id.toLowerCase().replace(/-/g, "");

type JfItem = { Id: string; Name: string; Type: string; ProviderIds?: Record<string, string> };

async function itemsFor(jf: JellyfinBench, account: BenchAccount): Promise<RefItem[]> {
  const params = "Recursive=true&IncludeItemTypes=Movie,Series,Season,Episode&Fields=ProviderIds";
  const res = await fetch(`${jf.url}/Items?${params}&userId=${account.id}`, {
    headers: { Authorization: `MediaBrowser Client="Banc parental", Device="banc", DeviceId="ref-${account.name}", Version="1", Token="${account.token}"` },
  });
  if (!res.ok) throw new Error(`Référence de ${account.name} illisible (${res.status})`);
  const body = (await res.json()) as { Items: JfItem[] };
  const views = await fetch(`${jf.url}/UserViews?userId=${account.id}`, {
    headers: { Authorization: `MediaBrowser Client="Banc parental", Device="banc", DeviceId="ref-${account.name}", Version="1", Token="${account.token}"` },
  }).then((r) => r.json() as Promise<{ Items: JfItem[] }>);
  return [...body.Items, ...views.Items].map((item) => {
    const tmdb = item.ProviderIds?.Tmdb;
    const kind = item.Type === "Movie" ? "movie" : item.Type === "Series" ? "tv" : null;
    return { id: norm(item.Id), name: item.Name, type: item.Type, tmdbKey: tmdb && kind ? `${kind}:${tmdb}` : null };
  });
}

export async function buildReference(jf: JellyfinBench, account: BenchAccount): Promise<Reference> {
  const [all, mine] = await Promise.all([itemsFor(jf, jf.admin), itemsFor(jf, account)]);
  const visible = new Set(mine.map((i) => i.id));
  const forbidden = all.filter((i) => !visible.has(i.id));
  const tmdbOf = (list: RefItem[]) => new Set(list.flatMap((i) => (i.tmdbKey ? [i.tmdbKey] : [])));
  return { account, all, visible, forbidden, forbiddenTmdb: tmdbOf(forbidden), visibleTmdb: tmdbOf(mine) };
}

const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Les fuites d'une réponse : un id interdit (avec ou sans tirets), ou le NOM d'un
 * film ou d'une série interdits (mot entier). Saisons et épisodes se jugent par id
 * (« Season 1 » n'est pas un nom). Ce que la REQUÊTE contenait déjà (`echo` : l'id
 * demandé, le terme cherché) n'est pas une fuite : le client le connaissait.
 */
export function leaksIn(text: string, ref: Reference, echo = ""): string[] {
  const flat = text.toLowerCase().replace(/-/g, "");
  const asked = echo.toLowerCase().replace(/-/g, "");
  const found = new Set<string>();
  for (const item of ref.forbidden) {
    if (asked.includes(item.id) || asked.includes(item.name.toLowerCase())) continue;
    if (flat.includes(item.id)) found.add(`${item.type} « ${item.name} » (id)`);
    else if ((item.type === "Movie" || item.type === "Series") && new RegExp(`(^|[^\\p{L}\\p{N}])${escape(item.name)}($|[^\\p{L}\\p{N}])`, "iu").test(text)) {
      found.add(`${item.type} « ${item.name} » (nom)`);
    }
  }
  return [...found];
}
