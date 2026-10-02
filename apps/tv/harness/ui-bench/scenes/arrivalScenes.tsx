import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { i18n, type TitleSeasonsAnswer } from "@tentacle-tv/shared";
import { MediaCard } from "../../../src/redesign/cards/MediaCard";
import type { ArrivalState } from "../../../src/redesign/requests/arrivalTypes";
import { REQUESTS_DOCK_KEY } from "../../../src/redesign/requests/RequestsDock";
import { REQUESTS_CLOSE_KEY, RequestsPanelView } from "../../../src/redesign/requests/RequestsPanelView";
import { SeasonsSheet } from "../../../src/redesign/screens/requests/SeasonsSheet";
import { ActionSheetView } from "../../../src/redesign/screens/sheet/ActionSheetView";
import { colors, fonts } from "../../../src/redesign/theme/tokens";
import { absentOf } from "../../../src/redesignWiring/vigie/absentStates";
import { STILL_READING } from "../../../src/redesignWiring/vigie/arrivalModels";
import { requestItemModel, requestsCountText } from "../../../src/redesignWiring/vigie/requestModels";
import { seasonsSheetModel } from "../../../src/redesignWiring/vigie/seasonsSheetModel";
import { t as tf } from "../data/absentModels";
import { LEVELS, STATES, arrivalCard, benchLiveTitles, benchMine, t } from "../data/arrivalModels";
import type { BenchData } from "../data/benchData";
import { LiveCards, LiveHome, LivePanel, LiveRail } from "./arrivalLive";
import type { BenchScene } from "./types";

/**
 * Les demandes EN DIRECT (Apple TV) : l'affiche d'un titre demandé, grise,
 * qui reprend sa couleur au prorata de l'avancement, le camembert au centre —
 * la même affiche à 0, 25, 50, 75 et 100 %, chaque état, au repos et au focus
 * (`--focus`) ; la fenêtre, le rail, la feuille des saisons, le grand
 * panneau ; et ce qui bouge seul (« en marche », « cycle ») — pour l'œil et
 * pour la mesure (`gpu`). Titres factices, mots et modèles du câblage.
 */

const G = "Demandes en direct";
const CARD_KEYS = [0, 1, 2, 3, 4].map((i) => `direct:${i}`);

function Strip({ data, cards, captions }: { data: BenchData; cards: Array<[ArrivalState, number | null]>; captions: string[] }) {
  return (
    <View style={styles.page}>
      <View style={styles.row}>
        {cards.map(([state, percent], i) => (
          <View key={i} style={styles.cell}>
            <MediaCard card={arrivalCard(data, `direct:${i}`, state, percent, STILL_READING)} variant="poster" focusKey={`direct:${i}`} />
            <Text style={styles.caption}>{captions[i]}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const fr = () => i18n.language.startsWith("fr");
const levelCaptions = () => LEVELS.map(([, p]) => `${p} %`);
const stateCaptions = () => (fr()
  ? ["En attente", "En route · 42 %", "Mise en bibliothèque", "Bloquée", "Arrivée"]
  : ["Pending", "Arriving · 42%", "Adding to library", "Stuck", "Arrived"]);

/** La fenêtre, figée : chaque état, et la ligne d'une demande arrivée (sa couleur, « Disponible »). */
function StillPanel({ data }: { data: BenchData }) {
  const titles = useMemo(() => benchLiveTitles(data), [data]);
  const items = titles.map((title) => requestItemModel(title, t, STILL_READING));
  return (
    <View style={StyleSheet.absoluteFill}>
      <LiveHome data={data} titles={titles} reading={STILL_READING} expanded={false} />
      <RequestsPanelView title={t("requests:dockLabel")} subtitle={requestsCountText(titles, t)} items={items} emptyText={t("requests:empty")} loadingText={t("requests:loading")} />
    </View>
  );
}

/** Une demande sort de la fenêtre en avançant — elle prend sa couleur, puis s'en va —, et revient (toutes les 4 s). */
function ArrivalExit({ data }: { data: BenchData }) {
  const all = useMemo(() => benchLiveTitles(data), [data]);
  const [arrived, setArrived] = useState(false);
  useEffect(() => {
    const timer = setInterval(() => setArrived((value) => !value), 4000);
    return () => clearInterval(timer);
  }, []);
  const titles = arrived ? all.filter((title) => title.state !== "importing") : all;
  const items = titles.map((title) => requestItemModel(title, t, STILL_READING));
  return (
    <View style={StyleSheet.absoluteFill}>
      <LiveHome data={data} titles={titles} reading={STILL_READING} expanded={false} />
      <RequestsPanelView title={t("requests:dockLabel")} subtitle={requestsCountText(titles, t)} items={items} emptyText={t("requests:empty")} loadingText={t("requests:loading")} />
    </View>
  );
}

/** La feuille des saisons d'une série que le compte a demandée (saisons 2 et 3, en route à 42 %). */
function OwnSeasons({ data }: { data: BenchData }) {
  const season = (number: number, requested: boolean, here = false) => ({
    number,
    name: t("requests:seasonFallback", { number }),
    episodeCount: 10,
    badge: here ? { label: fr() ? "Disponible" : "Available", tone: "success" as const } : requested ? { label: fr() ? "Demandée" : "Requested", tone: "info" as const } : null,
    requestable: !requested && !here,
  });
  const answer: TitleSeasonsAnswer = { seasons: [season(1, false, true), season(2, true), season(3, true), season(4, false)], failure: null };
  const mine = { ...benchMine(data, 30, "arriving", 42, null, "series", 3), seasons: [2, 3] };
  return <SeasonsSheet sheet={seasonsSheetModel(tf, mine.title, answer, false, new Set(), null, { mine, reading: STILL_READING })} />;
}

/** Le grand panneau d'un titre absent que le compte attend : son affiche arrive comme sur sa carte. */
function OwnSheet({ data }: { data: BenchData }) {
  const mine = benchMine(data, 31, "arriving", 64);
  const status = absentOf(tf, mine, null, STILL_READING);
  const header = { shape: "poster" as const, title: mine.title, subtitle: [mine.year ? String(mine.year) : null, status.label].filter(Boolean).join(" · "), imageUri: mine.imageUrl ?? undefined, arrival: status.arrival };
  return <ActionSheetView header={header} actions={[]} rating={null} />;
}

const SETTLE = 1800;

export const ARRIVAL_SCENES: BenchScene[] = [
  { id: "direct/niveaux", group: G, label: "Affiche à 0, 25, 50, 75, 100 %", focusKeys: CARD_KEYS, settleMs: SETTLE, render: (data) => <Strip data={data} cards={LEVELS} captions={levelCaptions()} /> },
  { id: "direct/etats", group: G, label: "Chaque état", focusKeys: CARD_KEYS, settleMs: SETTLE, render: (data) => <Strip data={data} cards={STATES} captions={stateCaptions()} /> },
  { id: "direct/fenetre", group: G, label: "Fenêtre — chaque état", focusKeys: [REQUESTS_CLOSE_KEY], settleMs: SETTLE, render: (data) => <StillPanel data={data} /> },
  { id: "direct/fenetre-arrivee", group: G, label: "Fenêtre — arrivée, puis sortie (4 s)", settleMs: 600, render: (data) => <ArrivalExit data={data} /> },
  { id: "direct/rail-replie", group: G, label: "Rail replié — ce qui bouge devant", settleMs: SETTLE, render: (data) => <LiveHome data={data} titles={benchLiveTitles(data)} reading={STILL_READING} expanded={false} /> },
  { id: "direct/rail-ouvert", group: G, label: "Rail ouvert — l'aperçu", focusKeys: [REQUESTS_DOCK_KEY], settleMs: SETTLE, render: (data) => <LiveHome data={data} titles={benchLiveTitles(data)} reading={STILL_READING} expanded /> },
  { id: "direct/saisons", group: G, label: "Saisons de la demande, en route", settleMs: SETTLE, render: (data) => <OwnSeasons data={data} /> },
  { id: "direct/panneau", group: G, label: "Grand panneau — titre demandé", focusKeys: ["sheet:close"], settleMs: SETTLE, render: (data) => <OwnSheet data={data} /> },
  { id: "direct/en-marche", group: G, label: "En marche (mesure)", focusKeys: ["direct:0"], settleMs: 1200, render: (data) => <LiveCards data={data} durationS={300} /> },
  { id: "direct/cycle", group: G, label: "Cycle complet (40 s)", settleMs: 1200, render: (data) => <LiveCards data={data} durationS={40} /> },
  { id: "direct/fenetre-en-marche", group: G, label: "Fenêtre en marche", settleMs: 1200, render: (data) => <LivePanel data={data} durationS={40} /> },
  { id: "direct/rail-en-marche", group: G, label: "Rail en marche", settleMs: 1200, render: (data) => <LiveRail data={data} durationS={40} expanded={false} /> },
];

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bgTop, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", gap: 48 },
  cell: { alignItems: "center", gap: 12 },
  caption: { ...fonts.semibold, fontSize: 24, color: colors.textTertiary, marginTop: 64 },
});
