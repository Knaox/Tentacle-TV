import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { DEFAULT_FILTERS } from "../../../src/hooks/libraryCatalogParams";
import { NEUTRAL_PALETTE } from "../../../src/redesign/color/artworkPalette";
import { FocusPreviewProvider } from "../../../src/redesign/focus/focusPreview";
import { HomeView } from "../../../src/redesign/screens/home/HomeView";
import { LibraryView } from "../../../src/redesign/screens/library/LibraryView";
import type { BenchData } from "../data/benchData";
import { filterCatalog, libraryOf } from "../data/libraryModels";
import { cardOf, yearOf } from "../data/models";
import { navOf } from "../data/screenModels";
import { rowsOf } from "./homeScenes";
import type { BenchScene } from "./types";

/**
 * Le banc de MESURE de la lumière (`bench.mjs gpu`) : un focus qui change
 * SEUL, dans l'app, toutes les 400 ms — la carte grandit, sa lueur paraît, la
 * lumière du fond passe à celle de l'œuvre suivante. Un mouvement
 * déterministe : sous une forte charge du Mac, un focus piloté depuis le
 * relais n'arrive pas au même rythme d'un tour à l'autre (mesuré le
 * 2026-10-02 : du simple au décuple sur le même code). Avant / après se
 * comparent sur ces deux scènes, en alternance.
 */

const EVERY_MS = 400;

/** `<préfixe>:<i>`, en aller-retour sur `count` éléments. */
function useCyclingKey(prefix: string, count: number): string {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    let step = 1;
    const timer = setInterval(() => {
      setIndex((i) => {
        if (i + step < 0 || i + step >= count) step = -step;
        return i + step;
      });
    }, EVERY_MS);
    return () => clearInterval(timer);
  }, [count]);
  return `${prefix}:${index}`;
}

function GridMeasure({ data }: { data: BenchData }) {
  const { t } = useTranslation();
  const lib = libraryOf(data, "movies");
  const cards = useMemo(() => filterCatalog(data, lib?.id, DEFAULT_FILTERS).map((item) => cardOf(data, item, yearOf(item))), [data, lib?.id]);
  const key = useCyclingKey("grid", 6);
  const palette = cards[Number(key.slice(5))]?.palette ?? NEUTRAL_PALETTE;
  return (
    <FocusPreviewProvider forcedKey={key}>
      <LibraryView
        nav={navOf(data, lib ? `Library_${lib.id}` : "Home")}
        title={lib?.name ?? t("common:movie")}
        count={t("library:titles", { count: cards.length })}
        pills={[]}
        activeFilters={[]}
        labels={{ activeFilters: t("library:activeFilters"), clearAll: t("library:clearAll") }}
        cards={cards}
        palette={palette}
      />
    </FocusPreviewProvider>
  );
}

function RowMeasure({ data }: { data: BenchData }) {
  const rows = useMemo(() => rowsOf(data), [data]);
  const resume = rows.find((row) => row.key === "resume");
  const key = useCyclingKey("resume", Math.min(5, resume?.cards.length ?? 0));
  const palette = resume?.cards[Number(key.slice(7))]?.palette ?? NEUTRAL_PALETTE;
  return (
    <FocusPreviewProvider forcedKey={key}>
      <HomeView nav={navOf(data, "Home")} hero={null} rows={rows} palette={palette} />
    </FocusPreviewProvider>
  );
}

export const LIGHT_MEASURE_SCENES: BenchScene[] = [
  {
    id: "mesure/lumiere-grille",
    group: "Mesure",
    label: "Lumière — le focus change seul dans la grille des films (400 ms)",
    settleMs: 1300,
    render: (data) => <GridMeasure data={data} />,
  },
  {
    id: "mesure/lumiere-rangee",
    group: "Mesure",
    label: "Lumière — le focus change seul dans « Reprendre » (400 ms)",
    settleMs: 1300,
    render: (data) => <RowMeasure data={data} />,
  },
];
