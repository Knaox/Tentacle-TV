import type { LibItem } from "./jellyfin";

// Construction des titres/corps de notification d'ajout bibliothèque.
// Formulation : « <média> est sorti·e sur Tentacle TV » avec accord
// grammatical (film/épisode = masculin, série/saison = féminin, pluriel).
// Regroupement : plusieurs épisodes d'une même saison → « Série — Saison N
// (X épisodes) » ; un épisode isolé reste « Série SxxExx ».

interface Label {
  text: string;
  gender: "m" | "f";
}

const pad2 = (n: number): string => String(n).padStart(2, "0");

/** Suffixe « est sorti·e / sont sorti·e·s sur Tentacle TV » selon genre et nombre. */
export function releasedSuffix(gender: "m" | "f", plural: boolean): string {
  const verb = plural
    ? gender === "f" ? "sont sorties" : "sont sortis"
    : gender === "f" ? "est sortie" : "est sorti";
  return `${verb} sur Tentacle TV`;
}

/** Libellé d'un épisode isolé : « Série SxxExx — Titre ». */
function describeEpisode(it: LibItem): Label {
  const series = it.SeriesName ?? it.Name;
  const code =
    it.ParentIndexNumber != null && it.IndexNumber != null
      ? ` S${pad2(it.ParentIndexNumber)}E${pad2(it.IndexNumber)}`
      : "";
  const ep = it.Name && it.Name !== series ? ` — ${it.Name}` : "";
  return { text: `${series}${code}${ep}`, gender: "m" };
}

/** Libellé d'une saison : « Série — Saison N (X épisodes) » (compte si ≥2). */
function seasonLabel(series: string, seasonNum: number | null, epCount: number): Label {
  const base = seasonNum != null ? `${series} — Saison ${seasonNum}` : series;
  const count = epCount >= 2 ? ` (${epCount} épisodes)` : "";
  return { text: `${base}${count}`, gender: "f" };
}

interface SeasonGroup {
  series: string;
  seasonNum: number | null;
  eps: LibItem[];
  explicitSeason: boolean;
}

/** Transforme les items ajoutés en libellés (épisodes regroupés par saison). */
function buildLabels(items: LibItem[]): Label[] {
  const groups = new Map<string, SeasonGroup>();
  const labels: Label[] = [];

  for (const it of items) {
    if (it.Type === "Episode") {
      const series = it.SeriesName ?? it.Name;
      const seasonNum = it.ParentIndexNumber ?? null;
      const key = `${series}|${seasonNum}`;
      const g = groups.get(key);
      if (g) g.eps.push(it);
      else groups.set(key, { series, seasonNum, eps: [it], explicitSeason: false });
    } else if (it.Type === "Season") {
      const series = it.SeriesName ?? it.Name;
      const seasonNum = it.IndexNumber ?? null;
      const key = `${series}|${seasonNum}`;
      const g = groups.get(key);
      if (g) g.explicitSeason = true;
      else groups.set(key, { series, seasonNum, eps: [], explicitSeason: true });
    } else {
      // Movie (masculin) ou Series (féminin).
      labels.push({ text: it.Name, gender: it.Type === "Series" ? "f" : "m" });
    }
  }

  for (const g of groups.values()) {
    if (g.explicitSeason || g.eps.length >= 2) {
      labels.push(seasonLabel(g.series, g.seasonNum, g.eps.length));
    } else if (g.eps.length === 1) {
      labels.push(describeEpisode(g.eps[0]));
    }
  }

  // Déduplication par texte (préserve le premier libellé et son genre).
  const seen = new Set<string>();
  const out: Label[] = [];
  for (const l of labels) {
    if (l.text && !seen.has(l.text)) {
      seen.add(l.text);
      out.push(l);
    }
  }
  return out;
}

/** Titre/corps avec les vrais titres des items ajoutés. */
export function composeItems(items: LibItem[]): { title: string; body: string } {
  const labels = buildLabels(items);
  if (labels.length === 1) {
    return { title: labels[0].text, body: releasedSuffix(labels[0].gender, false) };
  }
  const texts = labels.map((l) => l.text);
  const preview = texts.slice(0, 3).join(" · ");
  const extra = texts.length > 3 ? ` +${texts.length - 3}` : "";
  return { title: `${texts.length} nouveautés sur Tentacle TV`, body: `${preview}${extra}` };
}

/** Repli générique : count monté mais aucun item identifiable (date fichier, WS muet). */
export function composeGeneric(n: number): { title: string; body: string } {
  return {
    title: n === 1 ? "Nouveau sur Tentacle TV" : `${n} nouveautés sur Tentacle TV`,
    body: "Disponible sur Tentacle TV",
  };
}
