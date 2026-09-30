import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { i18n } from "@tentacle-tv/shared";
import { NavEntryMenu } from "../../../src/redesign/nav/NavEntryMenu";
import { HomeView } from "../../../src/redesign/screens/home/HomeView";
import type { BenchData } from "../data/benchData";
import { benchLibraries, benchMenu, benchMovable, benchNav, type BenchNavOptions } from "../data/navModels";
import { heroOf } from "../data/screenModels";
import { heroItems, rowsOf } from "./homeScenes";
import type { BenchScene } from "./types";

/**
 * La navigation qui tient BEAUCOUP de bibliothèques (24 ici : les trois du
 * compte, puis de quoi remplir) : repliée, dépliée et défilée en haut, au
 * milieu, en bas ; une bibliothèque masquée ; le menu d'appui long ; le mode
 * « déplacer ». Posée sur l'accueil, pour juger le voile et le verre.
 *
 * Au banc, la clé figée est amenée dans la zone de confort de la liste comme
 * le ferait le focus natif — sans animation. La planche `--focus` passe les
 * clés de chaque scène en revue.
 */

const t = (key: string, options?: Record<string, unknown>) => i18n.t(key, options) as string;
const MANY = 24;

/** La clé de la bibliothèque `n` (0 = la première) du banc garni. */
const lib = (data: BenchData, n: number) => benchLibraries(data, MANY)[n]?.key ?? "Home";

function NavScene({ data, activeKey = "Home", options = {}, menu }: {
  data: BenchData;
  activeKey?: string;
  options?: BenchNavOptions;
  /** L'entrée dont le menu d'appui long est ouvert. */
  menu?: string;
}) {
  const nav = benchNav(data, activeKey, { libraries: MANY, ...options, heldKey: menu ?? options.heldKey });
  const rows = useMemo(() => rowsOf(data), [data]);
  const hero = useMemo(() => {
    const items = heroItems(data);
    return items[0] ? heroOf(data, items[0], t("common:resumeWatching"), { index: 0, count: items.length }) : null;
  }, [data]);
  const shown = menu ? benchMenu(nav, menu, (options.hidden?.length ?? 0) > 0) : null;
  return (
    <View style={styles.fill}>
      <HomeView
        nav={nav}
        hero={hero}
        rows={rows}
        palette={hero?.palette ?? { glows: ["#3a3f5c", "#5c4a2e", "#6b4a3a"], deep: "#0d0b0f" }}
      />
      {shown ? <NavEntryMenu title={shown.title} caption={shown.caption} items={shown.items} /> : null}
    </View>
  );
}

/** Déplacée de deux crans vers le bas : l'ordre qu'aurait laissé le mode « déplacer ». */
function movedOrder(data: BenchData, key: string, steps: number): string[] {
  const keys = benchMovable(data, { libraries: MANY }).map((entry) => entry.key);
  const from = keys.indexOf(key);
  const rest = keys.filter((other) => other !== key);
  rest.splice(Math.min(rest.length, from + steps), 0, key);
  return rest;
}

export const NAV_SCENES: BenchScene[] = [
  {
    id: "navigation/peu",
    group: "Navigation",
    label: "Peu de bibliothèques (tout tient)",
    focusKeys: ["nav:Home", "nav:Settings"],
    settleMs: 1400,
    render: (data) => <NavScene data={data} options={{ libraries: data.snapshot.libraries.length, expanded: true }} />,
  },
  {
    id: "navigation/repliee",
    group: "Navigation",
    label: "24 bibliothèques — repliée",
    settleMs: 1400,
    render: (data) => <NavScene data={data} />,
  },
  {
    id: "navigation/repliee-bas",
    group: "Navigation",
    label: "Repliée — la page d'une bibliothèque du bas",
    settleMs: 1400,
    render: (data) => <NavScene data={data} activeKey={lib(data, 20)} />,
  },
  {
    id: "navigation/haut",
    group: "Navigation",
    label: "Dépliée — en haut",
    focusKeys: ["nav:Home", "nav:Recommendations", "nav:Search"],
    settleMs: 1400,
    render: (data) => <NavScene data={data} options={{ expanded: true }} />,
  },
  {
    id: "navigation/milieu",
    group: "Navigation",
    label: "Dépliée — au milieu",
    focusKeys: ["nav:Library_bench-8", "nav:Library_bench-9", "nav:Library_bench-3"],
    settleMs: 1400,
    render: (data) => <NavScene data={data} options={{ expanded: true }} />,
  },
  {
    id: "navigation/bas",
    group: "Navigation",
    label: "Dépliée — en bas, puis le profil",
    focusKeys: ["nav:Library_bench-20", "nav:Settings"],
    settleMs: 1400,
    render: (data) => <NavScene data={data} options={{ expanded: true }} />,
  },
  {
    id: "navigation/masquee",
    group: "Navigation",
    label: "Une bibliothèque masquée — « Tout afficher »",
    focusKeys: ["nav:RailShowAll", "nav:Library_bench-4"],
    settleMs: 1400,
    render: (data) => <NavScene data={data} options={{ expanded: true, hidden: [lib(data, 5)] }} />,
  },
  {
    id: "navigation/menu",
    group: "Navigation",
    label: "Menu d'une entrée (appui long)",
    focusKeys: ["nav:menu:move", "nav:menu:up", "nav:menu:hide", "nav:menu:settings"],
    settleMs: 1400,
    render: (data) => <NavScene data={data} options={{ expanded: true }} menu={lib(data, 8)} />,
  },
  {
    id: "navigation/menu-tete",
    group: "Navigation",
    label: "Menu — l'entrée en tête (Monter estompé), une masquée",
    focusKeys: ["nav:menu:move", "nav:menu:showAll"],
    settleMs: 1400,
    render: (data) => <NavScene data={data} options={{ expanded: true, hidden: [lib(data, 5)] }} menu="Recommendations" />,
  },
  {
    id: "navigation/deplacer",
    group: "Navigation",
    label: "Mode « déplacer »",
    focusKeys: ["nav:Library_bench-2"],
    settleMs: 1400,
    render: (data) => (
      <NavScene
        data={data}
        options={{ expanded: true, movingKey: lib(data, 5), order: movedOrder(data, lib(data, 5), 2) }}
      />
    ),
  },
];

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
