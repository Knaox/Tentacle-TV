import { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { i18n } from "@tentacle-tv/shared";
import { TV_STAGE } from "@tentacle-tv/theme";
import { AmbientBackdrop } from "../../../src/redesign/background/AmbientBackdrop";
import { HeroBanner } from "../../../src/redesign/hero/HeroBanner";
import { HomeView } from "../../../src/redesign/screens/home/HomeView";
import type { BenchData } from "../data/benchData";
import { heroOf, navOf } from "../data/screenModels";
import { heroItems, rowsOf } from "./homeScenes";
import { MOTION_PLAYER_SCENE } from "./motionPlayer";
import type { BenchScene } from "./types";

/**
 * Le MOUVEMENT, à regarder et à mesurer (`bench.mjs fps`) : ce qui ne bouge
 * pas tout seul dans les autres scènes.
 * - `mouvement/heros` : le héros qui tourne toutes les 3,5 s sur les vraies
 *   reprises (8 s dans l'app) — image en fondu enchaîné, texte qui sort et
 *   rentre, halo qui passe d'une lumière à l'autre, fond vivant qui suit ;
 * - `mouvement/navigation` : la navigation de l'accueil qui se déplie et se
 *   replie toutes les 1,2 s, sur le vrai contenu (le verre floute ce qui
 *   passe dessous) ;
 * - `mouvement/lecteur` : l'habillage du lecteur, ses sorties et ses panneaux
 *   (`motionPlayer.tsx`).
 * Le focus figé du banc n'y joue pas : rien n'y est focalisé par défaut.
 */

const t = (key: string) => i18n.t(key) as string;
const LEFT = TV_STAGE.contentLeft;
const ROTATE_MS = 3_500;

function RotatingHero({ data }: { data: BenchData }) {
  const items = useMemo(() => {
    const resume = data.list("resume");
    return (resume.length ? resume : data.list("movies")).slice(0, 5);
  }, [data]);
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (items.length < 2) return undefined;
    const timer = setInterval(() => setIndex((i) => (i + 1) % items.length), ROTATE_MS);
    return () => clearInterval(timer);
  }, [items.length]);
  const hero = useMemo(
    () => (items[index] ? heroOf(data, items[index], t("common:resumeWatching"), { index, count: items.length }) : null),
    [data, items, index],
  );
  if (!hero) return null;
  return (
    <View style={styles.root}>
      <AmbientBackdrop palette={hero.palette} />
      <View style={styles.hero}>
        <HeroBanner hero={hero} width={1920 - LEFT - 56} />
      </View>
    </View>
  );
}

const TOGGLE_MS = 1_200;

function UnfoldingNav({ data }: { data: BenchData }) {
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    const timer = setInterval(() => setExpanded((open) => !open), TOGGLE_MS);
    return () => clearInterval(timer);
  }, []);
  const nav = useMemo(() => navOf(data, "Home", expanded), [data, expanded]);
  const rows = useMemo(() => rowsOf(data), [data]);
  const hero = useMemo(() => {
    const items = heroItems(data);
    return items[0] ? heroOf(data, items[0], t("common:resumeWatching"), { index: 0, count: items.length }) : null;
  }, [data]);
  return <HomeView nav={nav} hero={hero} rows={rows} palette={hero?.palette ?? { glows: ["#3a3f5c", "#5c4a2e", "#6b4a3a"], deep: "#0d0b0f" }} />;
}

export const MOTION_SCENES: BenchScene[] = [
  {
    id: "mouvement/heros",
    group: "Mouvement",
    label: "Le héros qui tourne (toutes les 3,5 s)",
    settleMs: 1500,
    images: (data) =>
      data
        .list("resume")
        .slice(0, 5)
        .map((item) => heroOf(data, item).backdropUri)
        .filter((uri): uri is string => Boolean(uri)),
    render: (data) => <RotatingHero data={data} />,
  },
  {
    id: "mouvement/navigation",
    group: "Mouvement",
    label: "La navigation qui se déplie (toutes les 1,2 s)",
    settleMs: 1500,
    render: (data) => <UnfoldingNav data={data} />,
  },
  MOTION_PLAYER_SCENE,
];

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  hero: { marginLeft: LEFT, marginTop: TV_STAGE.hero.top },
});
