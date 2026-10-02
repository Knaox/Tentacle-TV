import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { DetailView, type DetailViewProps } from "../../../src/redesign/screens/detail/DetailView";
import { SeasonsSheet } from "../../../src/redesign/screens/requests/SeasonsSheet";
import type { BenchData } from "../data/benchData";
import { BLEACH, gapSearchCard, gapSheet, missingTabs } from "../data/gapModels";
import { searchResponse } from "../data/searchResponses";
import { detailOf, imagesOf } from "./detailScenes";
import { SearchRequestScene } from "./searchRequestScene";
import type { BenchScene } from "./types";

/**
 * Les saisons MANQUANTES d'une série de la bibliothèque (garde Vigie, contrat
 * `titles.gaps`) : Bleach en tête de « À demander » dans la recherche, ses
 * saisons manquantes en onglets grisés au bout de la bande de sa fiche, et la
 * feuille des saisons — ouverte par la carte (rien de coché), ou par l'onglet
 * grisé (sa saison déjà cochée).
 */

const BACK = () => undefined;
const HOLD = () => undefined;

/** La fiche de Bleach, ouverte sur sa dernière saison : les onglets grisés à la suite, en vue. */
function ficheProps(data: BenchData): DetailViewProps {
  const last = data.snapshot.seasons[BLEACH]?.at(-1);
  return detailOf(data, BLEACH, {
    seasonId: last,
    tweak: (props) => ({ ...props, episodes: props.episodes && { ...props.episodes, missing: missingTabs() } }),
  });
}

function FicheScene({ data }: { data: BenchData }) {
  const { i18n: live } = useTranslation();
  const props = useMemo(() => ficheProps(data), [data, live.language]); // eslint-disable-line react-hooks/exhaustive-deps
  return <DetailView {...props} onBack={BACK} onLongPressEpisode={HOLD} />;
}

function SearchScene({ data, sheet }: { data: BenchData; sheet?: number[] }) {
  const { i18n: live } = useTranslation();
  const cards = useMemo(() => gapSearchCard(data), [data, live.language]); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = useMemo(() => (sheet ? gapSheet(sheet) : null), [sheet, live.language]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <SearchRequestScene data={data} query="bleach" response={searchResponse(data, "bleach")} absent={cards} />
      {shown ? <SeasonsSheet sheet={shown} /> : null}
    </>
  );
}

const searchImages = (data: BenchData) => gapSearchCard(data).map((card) => card.posterUri).filter((uri): uri is string => !!uri);

export const GAP_SCENES: BenchScene[] = [
  {
    id: "saisons-manquantes/recherche",
    group: "Saisons manquantes",
    label: "Recherche « bleach » — la série en tête de « À demander »",
    focusKeys: ["absent:0", "top"],
    settleMs: 2400,
    images: searchImages,
    render: (data) => <SearchScene data={data} />,
  },
  {
    id: "saisons-manquantes/fiche",
    group: "Saisons manquantes",
    label: "Fiche — saisons 16 et 17 grisées au bout de la bande",
    focusKeys: ["season:16", "season:15", "season:14"],
    settleMs: 2200,
    images: (data) => imagesOf(ficheProps(data)),
    render: (data) => <FicheScene data={data} />,
  },
  {
    id: "saisons-manquantes/feuille",
    group: "Saisons manquantes",
    label: "Feuille — depuis la recherche, rien de coché",
    focusKeys: ["sheet:season:17", "sheet:apply"],
    settleMs: 2400,
    images: searchImages,
    render: (data) => <SearchScene data={data} sheet={[]} />,
  },
  {
    id: "saisons-manquantes/feuille-onglet",
    group: "Saisons manquantes",
    label: "Feuille — depuis l'onglet grisé : la saison 17 cochée",
    focusKeys: ["sheet:season:17", "sheet:apply"],
    settleMs: 2400,
    images: searchImages,
    render: (data) => <SearchScene data={data} sheet={[17]} />,
  },
];
