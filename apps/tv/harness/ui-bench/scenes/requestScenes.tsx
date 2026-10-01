import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { i18n, type MyTitle } from "@tentacle-tv/shared";
import { ProgressPie } from "../../../src/redesign/brand/ProgressPie";
import { requestRowKey } from "../../../src/redesign/requests/RequestRow";
import { REQUESTS_DOCK_HEIGHT, REQUESTS_DOCK_KEY, RequestsDock } from "../../../src/redesign/requests/RequestsDock";
import { REQUESTS_CLOSE_KEY, RequestsPanelView } from "../../../src/redesign/requests/RequestsPanelView";
import { HomeView } from "../../../src/redesign/screens/home/HomeView";
import { colors, fonts } from "../../../src/redesign/theme/tokens";
import { requestItemModel, requestsCountText, requestsDockModel } from "../../../src/redesignWiring/vigie/requestModels";
import { RequestsPanel } from "../../../src/redesignWiring/vigie/RequestsPanel";
import type { BenchData } from "../data/benchData";
import { benchNav } from "../data/navModels";
import { benchAllStates, benchLong, benchOne, benchTwo } from "../data/requestModels";
import { heroOf } from "../data/screenModels";
import { heroItems, rowsOf } from "./homeScenes";
import type { BenchScene } from "./types";

/**
 * Les demandes en cours (Vigie, Apple TV), sur des titres FACTICES : l'aperçu
 * dans le bloc du profil — une affiche, plusieurs en éventail, aucune —, replié
 * et ouvert ; la fenêtre avec chaque état, une longue liste, vide, en
 * chargement ; une demande qui sort ; le camembert seul. Les mots passent par
 * les mêmes fonctions que l'app (`redesignWiring/vigie/requestModels`).
 *
 * « Câblée » : la vraie fenêtre (`RequestsPanel`, Modal et verrous du focus),
 * à éprouver en focus NATIF — la croix en entrée, OK sur elle ou Menu ferme,
 * BAS ne descend dans les lignes que si la liste défile.
 */

const t = (key: string, options?: Record<string, unknown>) => i18n.t(key, options) as string;

/** L'accueil, sa navigation et l'aperçu des demandes (`titles` : `null` = pas encore lus). */
function Home({ data, titles, expanded }: { data: BenchData; titles: MyTitle[] | null; expanded: boolean }) {
  const rows = useMemo(() => rowsOf(data), [data]);
  const hero = useMemo(() => {
    const items = heroItems(data);
    return items[0] ? heroOf(data, items[0], t("common:resumeWatching"), { index: 0, count: items.length }) : null;
  }, [data]);
  const dock = requestsDockModel(titles, t);
  const nav = {
    ...benchNav(data, "Home", { expanded, libraries: data.snapshot.libraries.length }),
    accessory: { height: REQUESTS_DOCK_HEIGHT, node: <RequestsDock model={dock} /> },
  };
  return (
    <HomeView nav={nav} hero={hero} rows={rows} palette={hero?.palette ?? { glows: ["#3a3f5c", "#5c4a2e", "#6b4a3a"], deep: "#0d0b0f" }} />
  );
}

function Panel({ titles }: { titles: MyTitle[] | null }) {
  const items = titles?.map((title) => requestItemModel(title, t)) ?? null;
  return (
    <RequestsPanelView
      title={t("requests:dockLabel")}
      subtitle={requestsCountText(titles, t)}
      items={items}
      emptyText={t("requests:empty")}
      loadingText={t("requests:loading")}
    />
  );
}

function PanelScene({ data, titles }: { data: BenchData; titles: MyTitle[] | null }) {
  return (
    <View style={StyleSheet.absoluteFill}>
      <Home data={data} titles={titles} expanded={false} />
      <Panel titles={titles} />
    </View>
  );
}

/** Une demande arrive (elle sort de la liste), puis revient (elle entre) — toutes les 2,5 s. */
function ExitScene({ data }: { data: BenchData }) {
  const all = useMemo(() => benchAllStates(data), [data]);
  const [arrived, setArrived] = useState(false);
  useEffect(() => {
    const timer = setInterval(() => setArrived((value) => !value), 2500);
    return () => clearInterval(timer);
  }, []);
  const titles = arrived ? all.filter((title) => title.state !== "importing") : all;
  return <PanelScene data={data} titles={titles} />;
}

/** La vraie fenêtre, dans sa Modal ; fermée, Menu rend le catalogue. */
function WiredScene({ data, long }: { data: BenchData; long: boolean }) {
  const titles = useMemo(() => (long ? benchLong(data) : benchAllStates(data)), [data, long]);
  const [open, setOpen] = useState(true);
  const close = useCallback(() => setOpen(false), []);
  return (
    <View style={StyleSheet.absoluteFill}>
      <Home data={data} titles={titles} expanded={false} />
      {open && titles.length > 0 ? <RequestsPanel titles={titles} onClose={close} /> : null}
    </View>
  );
}

/** Le camembert seul : chaque avancement, deux tailles, sur la scène et sur le blanc d'un focus. */
function PieBrick() {
  const values = [null, 0, 8, 42, 76, 100];
  return (
    <View style={styles.brick}>
      {[34, 56].map((size) => (
        <View key={size} style={styles.pies}>
          {values.map((value) => <ProgressPie key={`${size}-${value}`} percent={value} size={size} />)}
        </View>
      ))}
      <View style={[styles.pies, styles.white]}>
        {values.map((value) => <ProgressPie key={`dark-${value}`} percent={value} size={34} dark />)}
      </View>
      <Text style={styles.caption}>null · 0 · 8 · 42 · 76 · 100</Text>
    </View>
  );
}

/* Les clés des titres factices sont fixes (`requestModels` du banc) : la planche passe ces lignes en revue. */
const LONG_ROWS = [requestRowKey("tv:9000"), requestRowKey("movie:9001"), requestRowKey("movie:9002")];
const SETTLE = 1600;
const G = "Demandes en cours";

export const REQUEST_SCENES: BenchScene[] = [
  { id: "demandes/rail-plusieurs", group: G, label: "Rail ouvert — plusieurs demandes (éventail, nombre)", focusKeys: [REQUESTS_DOCK_KEY, "nav:Settings"], settleMs: SETTLE, render: (data) => <Home data={data} titles={benchAllStates(data)} expanded /> },
  { id: "demandes/rail-replie", group: G, label: "Rail replié — plusieurs demandes", settleMs: SETTLE, render: (data) => <Home data={data} titles={benchAllStates(data)} expanded={false} /> },
  { id: "demandes/rail-deux", group: G, label: "Rail ouvert — deux demandes", focusKeys: [REQUESTS_DOCK_KEY], settleMs: SETTLE, render: (data) => <Home data={data} titles={benchTwo(data)} expanded /> },
  { id: "demandes/rail-une", group: G, label: "Rail ouvert — une seule demande", focusKeys: [REQUESTS_DOCK_KEY], settleMs: SETTLE, render: (data) => <Home data={data} titles={benchOne(data)} expanded /> },
  { id: "demandes/rail-une-repliee", group: G, label: "Rail replié — une seule demande", settleMs: SETTLE, render: (data) => <Home data={data} titles={benchOne(data)} expanded={false} /> },
  { id: "demandes/rail-vide", group: G, label: "Rail ouvert — aucune demande (état discret)", focusKeys: [REQUESTS_DOCK_KEY], settleMs: SETTLE, render: (data) => <Home data={data} titles={[]} expanded /> },
  { id: "demandes/rail-vide-replie", group: G, label: "Rail replié — aucune demande", settleMs: SETTLE, render: (data) => <Home data={data} titles={[]} expanded={false} /> },
  { id: "demandes/fenetre", group: G, label: "Fenêtre — chaque état", focusKeys: [REQUESTS_CLOSE_KEY], settleMs: SETTLE, render: (data) => <PanelScene data={data} titles={benchAllStates(data)} /> },
  { id: "demandes/fenetre-longue", group: G, label: "Fenêtre — longue liste (elle défile)", focusKeys: [REQUESTS_CLOSE_KEY, ...LONG_ROWS], settleMs: SETTLE, render: (data) => <PanelScene data={data} titles={benchLong(data)} /> },
  { id: "demandes/fenetre-une", group: G, label: "Fenêtre — une seule demande", focusKeys: [REQUESTS_CLOSE_KEY], settleMs: SETTLE, render: (data) => <PanelScene data={data} titles={benchOne(data)} /> },
  { id: "demandes/fenetre-vide", group: G, label: "Fenêtre — rien en file d'attente", focusKeys: [REQUESTS_CLOSE_KEY], settleMs: SETTLE, render: (data) => <PanelScene data={data} titles={[]} /> },
  { id: "demandes/fenetre-chargement", group: G, label: "Fenêtre — pas encore lue", settleMs: SETTLE, render: (data) => <PanelScene data={data} titles={null} /> },
  { id: "demandes/sortie", group: G, label: "Une demande arrivée sort, puis revient (2,5 s)", settleMs: 600, render: (data) => <ExitScene data={data} /> },
  { id: "demandes/camembert", group: G, label: "Le camembert — chaque avancement", settleMs: 600, render: () => <PieBrick /> },
  { id: "demandes/cablee", group: G, label: "Câblée (Modal, focus natif) — chaque état", settleMs: 1800, render: (data) => <WiredScene data={data} long={false} /> },
  { id: "demandes/cablee-longue", group: G, label: "Câblée (Modal, focus natif) — longue liste", settleMs: 1800, render: (data) => <WiredScene data={data} long /> },
];


const styles = StyleSheet.create({
  brick: { flex: 1, alignItems: "center", justifyContent: "center", gap: 48, backgroundColor: colors.bgTop },
  pies: { flexDirection: "row", gap: 56, alignItems: "center", padding: 24, borderRadius: 24 },
  white: { backgroundColor: colors.ctaBg },
  caption: { ...fonts.medium, fontSize: 24, color: colors.textTertiary },
});
