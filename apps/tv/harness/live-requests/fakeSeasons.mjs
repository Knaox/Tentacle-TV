// Les SAISONS des séries du banc, comme Vigie les dirait (`titles.seasons`,
// `titles.gaps`) — voir README.md. Les noms sont ceux de TMDB tels que
// Jellyseerr les relaie à Vigie, souvent en anglais (« Season 2 »,
// « Specials ») : la TV doit les dire dans ses mots (« Saison 2 »,
// « Spéciaux »), avec le vrai nom d'une saison qui en a un.
//
// GTO (tv:62057, dans l'instantané) : la bibliothèque n'a que la saison 1 ;
// il lui manque les spéciaux, la saison 2 et la saison 3 (au vrai nom) — à
// demander —, et la saison 4, déjà demandée par quelqu'un d'autre.

export const SERIES = {
  "tv:62057": [
    { number: 0, name: "Specials", episodeCount: 3 },
    { number: 1, name: "Season 1", episodeCount: 43, available: true },
    { number: 2, name: "Season 2", episodeCount: 12 },
    { number: 3, name: "Shonan 14 Days", episodeCount: 9 },
    { number: 4, name: "Season 4", episodeCount: 10, elsewhere: true },
  ],
};

/** Les saisons d'une série et où elles en sont ; `requested` : celles que le compte a demandées au banc. */
export function seasonsOf(key, requested) {
  return (SERIES[key] ?? []).map((season) => {
    const badge = season.available
      ? { label: "Disponible", tone: "success" }
      : season.elsewhere || requested.has(season.number) ? { label: "Demandée", tone: "info" } : null;
    return { number: season.number, name: season.name, episodeCount: season.episodeCount, badge, requestable: badge === null };
  });
}

/** Ce qui manque à la série (`titles.gaps`) : ni là, ni là en partie. */
export function gapsOf(key, requested) {
  return seasonsOf(key, requested).filter((season) => season.badge?.tone !== "success");
}

/* Ce qui l'emporte quand deux demandes portent sur le même titre : ce qui bouge (Vigie, `myTitles`). */
const RANK = { pending: 1, blocked: 2, importing: 3, arriving: 4 };

/** Un titre par clé, comme Vigie : ses saisons s'additionnent, ce qui bouge l'emporte. Après le filtre d'origine. */
export function onePerTitle(items) {
  const byKey = new Map();
  for (const item of items) {
    const known = byKey.get(item.key);
    if (!known) {
      byKey.set(item.key, { ...item });
      continue;
    }
    known.seasons = known.seasons && item.seasons ? [...new Set([...known.seasons, ...item.seasons])].sort((a, b) => a - b) : null;
    if (RANK[item.state] > RANK[known.state]) Object.assign(known, { state: item.state, percent: item.percent, etaSeconds: item.etaSeconds });
  }
  return [...byKey.values()];
}
