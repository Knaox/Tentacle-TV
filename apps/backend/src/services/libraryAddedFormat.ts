import type { LibItem } from "./jellyfinLibrary";
import type { PushLang } from "./pushLang";

// Titres et corps des annonces d'arrivée, dans la langue de l'utilisateur.
// Français : « <média> est sorti·e sur Tentacle TV », avec accord (film et
// épisode au masculin, saison au féminin). Regroupement : plusieurs épisodes
// d'une même saison → « Série — Saison N (X épisodes) » ; un épisode isolé
// reste « Série S01E02 — Titre ». Seuls les films et les épisodes s'annoncent :
// l'item Série arrive avec son premier épisode, et l'annoncer seul faisait
// dire « The Bear est sortie » quand un seul épisode était là.
// Une demande arrivée se dit comme telle : « Votre demande est disponible ».

interface Label {
  text: string;
  gender: "m" | "f";
}

const pad2 = (n: number): string => String(n).padStart(2, "0");
const PREVIEW_MAX = 3;

/** Suffixe « est sorti·e / sont sorti·e·s sur Tentacle TV » selon genre et nombre. */
export function releasedSuffix(gender: "m" | "f", plural: boolean): string {
  const verb = plural
    ? gender === "f" ? "sont sorties" : "sont sortis"
    : gender === "f" ? "est sortie" : "est sorti";
  return `${verb} sur Tentacle TV`;
}

/** Libellé d'un épisode isolé : « Série S01E02 — Titre ». */
function describeEpisode(it: LibItem): Label {
  const series = it.SeriesName ?? it.Name;
  const code =
    it.ParentIndexNumber != null && it.IndexNumber != null
      ? ` S${pad2(it.ParentIndexNumber)}E${pad2(it.IndexNumber)}`
      : "";
  const ep = it.Name && it.Name !== series ? ` — ${it.Name}` : "";
  return { text: `${series}${code}${ep}`, gender: "m" };
}

/** Libellé d'une saison : « Série — Saison N (X épisodes) ». */
function seasonLabel(series: string, seasonNum: number | null, epCount: number, lang: PushLang): Label {
  const word = lang === "en" ? "Season" : "Saison";
  const base = seasonNum != null ? `${series} — ${word} ${seasonNum}` : series;
  const count = epCount >= 2 ? ` (${epCount} ${lang === "en" ? "episodes" : "épisodes"})` : "";
  return { text: `${base}${count}`, gender: "f" };
}

/** Les items arrivés en libellés : films tels quels, épisodes regroupés par saison. */
function buildLabels(items: LibItem[], lang: PushLang): Label[] {
  const groups = new Map<string, { series: string; seasonNum: number | null; eps: LibItem[] }>();
  const labels: Label[] = [];
  for (const it of items) {
    if (it.Type === "Movie") {
      labels.push({ text: it.Name, gender: "m" });
    } else if (it.Type === "Episode") {
      const series = it.SeriesName ?? it.Name;
      const seasonNum = it.ParentIndexNumber ?? null;
      const key = `${series}|${seasonNum}`;
      const g = groups.get(key);
      if (g) g.eps.push(it);
      else groups.set(key, { series, seasonNum, eps: [it] });
    }
  }
  for (const g of groups.values()) {
    labels.push(g.eps.length === 1 ? describeEpisode(g.eps[0]) : seasonLabel(g.series, g.seasonNum, g.eps.length, lang));
  }
  const seen = new Set<string>();
  return labels.filter((l) => l.text && !seen.has(l.text) && seen.add(l.text));
}

function preview(labels: Label[]): string {
  const texts = labels.map((l) => l.text);
  const extra = texts.length > PREVIEW_MAX ? ` +${texts.length - PREVIEW_MAX}` : "";
  return `${texts.slice(0, PREVIEW_MAX).join(" · ")}${extra}`;
}

/** Annonce d'arrivée pour un abonné aux nouveautés. */
export function composeItems(items: LibItem[], lang: PushLang = "fr"): { title: string; body: string } {
  const labels = buildLabels(items, lang);
  if (labels.length === 1) {
    return {
      title: labels[0].text,
      body: lang === "en" ? "Now on Tentacle TV" : releasedSuffix(labels[0].gender, false),
    };
  }
  return {
    title: lang === "en" ? `${labels.length} new additions on Tentacle TV` : `${labels.length} nouveautés sur Tentacle TV`,
    body: preview(labels),
  };
}

/** Annonce d'arrivée pour celui qui l'a demandée. */
export function composeRequested(items: LibItem[], lang: PushLang = "fr"): { title: string; body: string } {
  const labels = buildLabels(items, lang);
  if (labels.length === 1) {
    return {
      title: labels[0].text,
      body: lang === "en" ? "Your request is now on Tentacle TV" : "Votre demande est disponible sur Tentacle TV",
    };
  }
  return {
    title: lang === "en" ? "Your requests are now available" : "Vos demandes sont disponibles",
    body: preview(labels),
  };
}

/**
 * La fiche à ouvrir au tap : le film quand l'annonce n'en porte qu'un, la
 * série quand elle ne parle que d'elle. Plusieurs contenus : pas de cible,
 * l'app s'ouvre à l'accueil.
 */
export function pushTarget(items: LibItem[]): string | undefined {
  const movies = new Set(items.filter((it) => it.Type === "Movie").map((it) => it.Id));
  const series = new Set(items.filter((it) => it.Type === "Episode" && it.SeriesId).map((it) => it.SeriesId as string));
  const episodesWithoutSeries = items.some((it) => it.Type === "Episode" && !it.SeriesId);
  if (episodesWithoutSeries) return undefined;
  if (movies.size === 1 && series.size === 0) return [...movies][0];
  if (movies.size === 0 && series.size === 1) return [...series][0];
  return undefined;
}
