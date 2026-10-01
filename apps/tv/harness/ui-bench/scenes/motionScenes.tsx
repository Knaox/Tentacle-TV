import { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { i18n } from "@tentacle-tv/shared";
import { TV_STAGE } from "@tentacle-tv/theme";
import { AmbientBackdrop } from "../../../src/redesign/background/AmbientBackdrop";
import { HeroBanner } from "../../../src/redesign/hero/HeroBanner";
import type { BenchData } from "../data/benchData";
import { heroOf } from "../data/screenModels";
import type { BenchScene } from "./types";

/**
 * Le MOUVEMENT, à regarder et à mesurer (`bench.mjs fps`) : ce qui ne bouge
 * pas tout seul dans les autres scènes.
 * - `mouvement/heros` : le héros qui tourne toutes les 3,5 s sur les vraies
 *   reprises (8 s dans l'app) — image en fondu enchaîné, texte qui sort et
 *   rentre, halo qui passe d'une lumière à l'autre, fond vivant qui suit.
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
];

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  hero: { marginLeft: LEFT, marginTop: TV_STAGE.hero.top },
});
