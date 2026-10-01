import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { i18n } from "@tentacle-tv/shared";
import { NavItem } from "../../../src/redesign/nav/NavItem";
import type { NavAccessory } from "../../../src/redesign/nav/NavRail";
import { HomeView } from "../../../src/redesign/screens/home/HomeView";
import type { BenchData } from "../data/benchData";
import { benchNav } from "../data/navModels";
import { heroOf } from "../data/screenModels";
import { heroItems, rowsOf } from "./homeScenes";
import type { BenchScene } from "./types";

/**
 * Le rail COMPACT : le bloc des pages haut comme ses entrées et centré, le
 * bloc du profil ancré en bas, la largeur ouverte réglée sur le texte le plus
 * long — avec 3 bibliothèques (celles du compte) et 15, replié et ouvert, avec
 * et sans l'élément des demandes en cours au-dessus du profil.
 *
 * L'élément des demandes est ici un GABARIT du banc (une entrée « Mes
 * demandes ») : il occupe la place que le rail lui réserve (`accessory`, 64
 * points) et lit l'état du rail comme le fera le vrai (`useNavFrame`, par
 * `NavItem`). Le vrai élément est celui de la tâche « Demandes en cours ».
 * `--lang=fr,en` pour les deux langues.
 */

const t = (key: string) => i18n.t(key) as string;
const MANY = 15;

/** L'élément des demandes, tel que le banc le simule. */
function RequestsStandIn() {
  const english = i18n.language?.startsWith("en");
  return (
    <NavItem
      itemKey="Requests"
      label={english ? "My requests" : "Mes demandes"}
      caption={english ? "2 in progress" : "2 en cours"}
      icon="clock"
      active={false}
    />
  );
}

const ACCESSORY: NavAccessory = { height: 64, node: <RequestsStandIn /> };

interface RailSceneProps {
  data: BenchData;
  libraries?: number;
  expanded: boolean;
  requests?: boolean;
}

/** Remontée à chaque langue : une planche passe d'une langue à l'autre sans
 *  changer de scène, et l'accueil garde ses textes en mémoire. */
function RailScene(props: RailSceneProps) {
  return <RailSceneBody key={i18n.language} {...props} />;
}

function RailSceneBody({ data, libraries, expanded, requests }: RailSceneProps) {
  const nav = { ...benchNav(data, "Home", { libraries, expanded }), accessory: requests ? ACCESSORY : null };
  const rows = useMemo(() => rowsOf(data), [data]);
  const hero = useMemo(() => {
    const items = heroItems(data);
    return items[0] ? heroOf(data, items[0], t("common:resumeWatching"), { index: 0, count: items.length }) : null;
  }, [data]);
  return (
    <View style={styles.fill}>
      <HomeView
        nav={nav}
        hero={hero}
        rows={rows}
        palette={hero?.palette ?? { glows: ["#3a3f5c", "#5c4a2e", "#6b4a3a"], deep: "#0d0b0f" }}
      />
    </View>
  );
}

const few = (data: BenchData) => data.snapshot.libraries.length;

export const RAIL_SCENES: BenchScene[] = [
  {
    id: "rail/3-replie",
    group: "Rail compact",
    label: "3 bibliothèques — replié",
    focusKeys: ["hero:primary"],
    settleMs: 1400,
    render: (data) => <RailScene data={data} libraries={few(data)} expanded={false} />,
  },
  {
    id: "rail/3-ouvert",
    group: "Rail compact",
    label: "3 bibliothèques — ouvert",
    focusKeys: ["nav:Home", "nav:Settings"],
    settleMs: 1400,
    render: (data) => <RailScene data={data} libraries={few(data)} expanded />,
  },
  {
    id: "rail/3-demandes-replie",
    group: "Rail compact",
    label: "3 bibliothèques, élément des demandes — replié",
    focusKeys: ["hero:primary"],
    settleMs: 1400,
    render: (data) => <RailScene data={data} libraries={few(data)} expanded={false} requests />,
  },
  {
    id: "rail/3-demandes-ouvert",
    group: "Rail compact",
    label: "3 bibliothèques, élément des demandes — ouvert",
    focusKeys: ["nav:Home", "nav:Requests"],
    settleMs: 1400,
    render: (data) => <RailScene data={data} libraries={few(data)} expanded requests />,
  },
  {
    id: "rail/15-replie",
    group: "Rail compact",
    label: "15 bibliothèques — replié",
    focusKeys: ["hero:primary"],
    settleMs: 1400,
    render: (data) => <RailScene data={data} libraries={MANY} expanded={false} />,
  },
  {
    id: "rail/15-ouvert",
    group: "Rail compact",
    label: "15 bibliothèques — ouvert",
    focusKeys: ["nav:Home", "nav:Library_bench-8", "nav:Settings"],
    settleMs: 1400,
    render: (data) => <RailScene data={data} libraries={MANY} expanded />,
  },
  {
    id: "rail/15-demandes-replie",
    group: "Rail compact",
    label: "15 bibliothèques, élément des demandes — replié",
    focusKeys: ["hero:primary"],
    settleMs: 1400,
    render: (data) => <RailScene data={data} libraries={MANY} expanded={false} requests />,
  },
  {
    id: "rail/15-demandes-ouvert",
    group: "Rail compact",
    label: "15 bibliothèques, élément des demandes — ouvert",
    focusKeys: ["nav:Library_bench-8", "nav:Requests"],
    settleMs: 1400,
    render: (data) => <RailScene data={data} libraries={MANY} expanded requests />,
  },
];

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
