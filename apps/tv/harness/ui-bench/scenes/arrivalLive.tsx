import { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import type { MyTitle } from "@tentacle-tv/shared";
import { MY_TITLES_REFRESH } from "@tentacle-tv/tv-core";
import { MediaCard } from "../../../src/redesign/cards/MediaCard";
import { REQUESTS_DOCK_HEIGHT, RequestsDock } from "../../../src/redesign/requests/RequestsDock";
import { RequestsPanelView } from "../../../src/redesign/requests/RequestsPanelView";
import { HomeView } from "../../../src/redesign/screens/home/HomeView";
import { colors } from "../../../src/redesign/theme/tokens";
import { absentOf } from "../../../src/redesignWiring/vigie/absentStates";
import type { ArrivalReading } from "../../../src/redesignWiring/vigie/arrivalModels";
import { requestItemModel, requestsCountText, requestsDockModel } from "../../../src/redesignWiring/vigie/requestModels";
import { t as tf } from "../data/absentModels";
import { benchMine, t } from "../data/arrivalModels";
import type { BenchData } from "../data/benchData";
import { benchNav } from "../data/navModels";
import { heroOf } from "../data/screenModels";
import { heroItems, rowsOf } from "./homeScenes";

/**
 * Le DIRECT au banc : un faux serveur qui avance tout seul — relu toutes les
 * 10 s comme le vrai (`MY_TITLES_REFRESH.liveMs`), chaque titre en route au
 * rythme de son temps restant ; à 100 %, il entre dans la bibliothèque
 * (« Mise en bibliothèque »), puis sort de la liste — il est arrivé —, et la
 * boucle repart. Entre deux lectures, les vues avancent seules (une seconde).
 * Le banc ne demande rien à personne.
 */

/** Un titre du faux serveur : d'où il part, et le temps qu'il met à arriver. */
export interface LiveSpec {
  title: MyTitle;
  /** Le pour cent de départ. */
  from: number;
  /** De `from` à 100 %, en secondes. */
  durationS: number;
  /** Le temps passé « en mise en bibliothèque », puis hors de la liste avant de repartir (s). */
  importS: number;
  awayS: number;
  /** Il ne bouge pas (en attente, bloqué) : le serveur le rend tel quel. */
  still?: boolean;
}

/** Un titre qui attend sans bouger. */
const stillSpec = (title: MyTitle): LiveSpec => ({ title, from: 0, durationS: 1, importS: 0, awayS: 0, still: true });

/** Ce que dirait le vrai serveur de ce titre, `elapsedS` après le départ ; `null` : sorti de la liste. */
function serverAt(spec: LiveSpec, elapsedS: number): MyTitle | null {
  if (spec.still) return spec.title;
  const loop = spec.durationS + spec.importS + spec.awayS;
  const e = elapsedS % loop;
  if (e < spec.durationS) {
    const percent = spec.from + ((100 - spec.from) * e) / spec.durationS;
    return { ...spec.title, state: "arriving", percent: Math.round(percent * 10) / 10, etaSeconds: Math.max(1, Math.round(spec.durationS - e)) };
  }
  if (e < spec.durationS + spec.importS) return { ...spec.title, state: "importing", percent: null, etaSeconds: null };
  return null;
}

/** Le faux serveur, relu toutes les 10 s (et une fois au départ) : la liste, et l'heure de la lecture. */
export function useLiveFeed(specs: LiveSpec[]): { titles: MyTitle[]; reading: ArrivalReading } {
  const [start] = useState(Date.now);
  const read = () => {
    const at = Date.now();
    const titles = specs.map((spec) => serverAt(spec, (at - start) / 1000)).filter((title): title is MyTitle => title !== null);
    return { titles, reading: { at, live: true } };
  };
  const [feed, setFeed] = useState(read);
  useEffect(() => {
    const timer = setInterval(() => setFeed(read()), MY_TITLES_REFRESH.liveMs);
    return () => clearInterval(timer);
    // Le faux serveur ne change pas d'un rendu à l'autre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return feed;
}

/** Une affiche qui avance seule (le temps restant court pour qu'elle se voie bouger), et trois autres états. */
export const liveCardSpecs = (data: BenchData, durationS: number): LiveSpec[] => [
  { title: benchMine(data, 21, "arriving", 0, durationS), from: 0, durationS, importS: 6, awayS: 5 },
  { title: benchMine(data, 22, "arriving", 0, durationS, "series", 3), from: 35, durationS: durationS * 2, importS: 6, awayS: 5 },
];

/** Une rangée de cartes absentes, en direct (la saga, la recherche « À demander »). */
export function LiveCards({ data, durationS }: { data: BenchData; durationS: number }) {
  const specs = useMemo(() => liveCardSpecs(data, durationS), [data, durationS]);
  const { titles, reading } = useLiveFeed(specs);
  return (
    <View style={styles.page}>
      <View style={styles.row}>
        {specs.map((spec, i) => {
          const mine = titles.find((title) => title.key === spec.title.key);
          const card = {
            id: `direct:${i}`,
            title: spec.title.title,
            subtitle: spec.title.year ? String(spec.title.year) : undefined,
            posterUri: spec.title.imageUrl ?? undefined,
            markers: { communityRating: null, userScore: null, statuses: [], device: null },
            absent: absentOf(tf, mine, null, reading, !mine),
          };
          return <MediaCard key={spec.title.key} card={card} variant="poster" focusKey={`direct:${i}`} />;
        })}
      </View>
    </View>
  );
}

/** La fenêtre en direct : chaque ligne avance seule ; une demande arrivée prend sa couleur, puis sort. */
export function LivePanel({ data, durationS }: { data: BenchData; durationS: number }) {
  const specs = useMemo(() => [
    ...liveCardSpecs(data, durationS),
    stillSpec(benchMine(data, 23, "pending", null, null, "movies", 1)),
    stillSpec(benchMine(data, 25, "blocked", null, null, "movies", 6)),
  ], [data, durationS]);
  const { titles, reading } = useLiveFeed(specs);
  const items = titles.map((title) => requestItemModel(title, t, reading));
  return (
    <View style={StyleSheet.absoluteFill}>
      <LiveHome data={data} titles={titles} reading={reading} expanded={false} />
      <RequestsPanelView
        title={t("requests:dockLabel")}
        subtitle={requestsCountText(titles, t)}
        items={items}
        emptyText={t("requests:empty")}
        loadingText={t("requests:loading")}
      />
    </View>
  );
}

/** L'accueil, sa navigation et l'aperçu des demandes en direct (rail replié ou ouvert). */
export function LiveHome({ data, titles, reading, expanded }: { data: BenchData; titles: MyTitle[]; reading: ArrivalReading; expanded: boolean }) {
  const rows = useMemo(() => rowsOf(data), [data]);
  const hero = useMemo(() => {
    const items = heroItems(data);
    return items[0] ? heroOf(data, items[0], t("common:resumeWatching"), { index: 0, count: items.length }) : null;
  }, [data]);
  const dock = requestsDockModel(titles, t, reading);
  const nav = {
    ...benchNav(data, "Home", { expanded, libraries: data.snapshot.libraries.length }),
    accessory: { height: REQUESTS_DOCK_HEIGHT, node: <RequestsDock model={dock} /> },
  };
  return <HomeView nav={nav} hero={hero} rows={rows} palette={hero?.palette ?? { glows: ["#3a3f5c", "#5c4a2e", "#6b4a3a"], deep: "#0d0b0f" }} />;
}

/** Le rail en direct : l'aperçu met devant ce qui bouge. */
export function LiveRail({ data, durationS, expanded }: { data: BenchData; durationS: number; expanded: boolean }) {
  const specs = useMemo(() => [...liveCardSpecs(data, durationS), stillSpec(benchMine(data, 24, "pending", null, null, "movies", 1))], [data, durationS]);
  const { titles, reading } = useLiveFeed(specs);
  return <LiveHome data={data} titles={titles} reading={reading} expanded={expanded} />;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bgTop, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", gap: 56 },
});
